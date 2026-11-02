import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { apiRequest, createTestDatabase, createUsers, expectApiError } from "./harness";
import { createOrderHandlers } from "../lib/order-api";

// Cancellation and one-shot stock release (P0-D).
test("Cancellation semantics / real isolated SQLite", { timeout: 180000 }, async t => {
  const { db, peer, dispose } = await createTestDatabase("cancel");
  try {
    const users = await createUsers(db);
    const handlers = createOrderHandlers(db);
    const peerHandlers = createOrderHandlers(peer);
    let serial = 0;

    async function product(stock: number) {
      return db.product.create({ data: { sku: `SKU-C-${++serial}`, name: "Cancel product", stock, priceCents: 100 } });
    }
    async function makeOrder(customerId: string, lines: { productId: string; quantity: number }[], status = "CREATED") {
      return db.order.create({
        data: {
          orderNumber: `ORD-CANCEL-${++serial}`,
          customerId,
          status: status as "CREATED",
          totalCents: lines.reduce((sum, line) => sum + line.quantity * 100, 0),
          items: { create: lines.map(line => ({ ...line, unitPriceCents: 100 })) },
        },
      });
    }
    const cancel = (id: string, session = users.customerA.session) => handlers.updateStatus(
      apiRequest("http://localhost/api/v1/orders/id/status", { method: "PATCH", body: { to: "CANCELLED" }, session }),
      id,
    );
    async function stockOf(productId: string) {
      return (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock;
    }

    await t.test("CREATED cancel: status only, stock and ledger unchanged", async () => {
      const p = await product(10);
      const order = await makeOrder(users.customerA.id, [{ productId: p.id, quantity: 2 }]);
      const response = await cancel(order.id);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.order.status, "CANCELLED");
      assert.equal(await stockOf(p.id), 10);
      assert.equal(await db.inventoryLog.count({ where: { orderId: order.id } }), 0);
      assert.equal(await db.notification.count({ where: { orderId: order.id, type: "ORDER_CANCELLED" } }), 1);
    });

    await t.test("CONFIRMED cancel: stock restored once + one positive release log per product", async () => {
      const a = await product(10);
      const b = await product(10);
      const order = await makeOrder(users.customerA.id, [
        { productId: a.id, quantity: 2 },
        { productId: b.id, quantity: 3 },
        { productId: a.id, quantity: 1 },
      ]);
      assert.equal((await handlers.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
        method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session,
      }), order.id)).status, 200);
      assert.equal(await stockOf(a.id), 7);
      assert.equal(await stockOf(b.id), 7);
      assert.equal(await db.inventoryLog.count({ where: { orderId: order.id, reason: "ORDER_CONFIRM" } }), 2);

      const response = await cancel(order.id);
      assert.equal(response.status, 200);
      assert.equal(await stockOf(a.id), 10);
      assert.equal(await stockOf(b.id), 10);
      const releases = await db.inventoryLog.findMany({
        where: { orderId: order.id, reason: "ORDER_CANCEL_RELEASE" }, orderBy: { delta: "desc" },
      });
      assert.equal(releases.length, 2, "same SKU aggregated first: two lines merge into one release log");
      assert.deepEqual(releases.map(log => log.delta), [3, 3]);
      assert.ok(releases.every(log => log.actorId === users.customerA.id));
      // The original confirmation deduction logs are kept, not deleted.
      assert.equal(await db.inventoryLog.count({ where: { orderId: order.id, reason: "ORDER_CONFIRM" } }), 2);
    });

    await t.test("repeated cancellation => 409 and never releases twice", async () => {
      const p = await product(10);
      const order = await makeOrder(users.customerA.id, [{ productId: p.id, quantity: 4 }]);
      await handlers.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
        method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session,
      }), order.id);
      assert.equal((await cancel(order.id)).status, 200);
      const stockAfterFirst = await stockOf(p.id);
      assert.equal(stockAfterFirst, 10);
      await expectApiError(await cancel(order.id), 409, "INVALID_STATE_TRANSITION");
      assert.equal(await stockOf(p.id), 10);
      assert.equal(await db.inventoryLog.count({ where: { orderId: order.id, reason: "ORDER_CANCEL_RELEASE" } }), 1);
      assert.equal(await db.notification.count({ where: { orderId: order.id, type: "ORDER_CANCELLED" } }), 1);
    });

    await t.test("concurrent duplicate cancel: one success, one 409, single release", async () => {
      const p = await product(10);
      const order = await makeOrder(users.customerA.id, [{ productId: p.id, quantity: 2 }]);
      await handlers.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
        method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session,
      }), order.id);
      const responses = await Promise.all([
        cancel(order.id),
        peerHandlers.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
          method: "PATCH", body: { to: "CANCELLED" }, session: users.customerA.session,
        }), order.id),
      ]);
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
      assert.equal(await stockOf(p.id), 10);
      assert.equal(await db.inventoryLog.count({ where: { orderId: order.id, reason: "ORDER_CANCEL_RELEASE" } }), 1);
    });

    await t.test("cancel vs picking race: exactly one wins, stock never contradicts status", async () => {
      const p = await product(10);
      const order = await makeOrder(users.customerA.id, [{ productId: p.id, quantity: 2 }]);
      await handlers.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
        method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session,
      }), order.id);
      const responses = await Promise.all([
        cancel(order.id),
        peerHandlers.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
          method: "PATCH", body: { to: "PICKING" }, session: users.staff.session,
        }), order.id),
      ]);
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
      const finalStatus = (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status;
      const stock = await stockOf(p.id);
      if (finalStatus === "CANCELLED") {
        assert.equal(stock, 10, "a successful cancellation must restore the reserved stock");
      } else {
        assert.equal(finalStatus, "PICKING");
        assert.equal(stock, 8, "if picking wins, the stock stays reserved");
        assert.equal(await db.inventoryLog.count({ where: { orderId: order.id, reason: "ORDER_CANCEL_RELEASE" } }), 0);
      }
    });

    await t.test("after PICKING / SHIPPED cancellation is rejected with no stock change", async () => {
      for (const status of ["PICKING", "SHIPPED", "IN_TRANSIT", "DELIVERED"]) {
        const p = await product(10);
        const order = await makeOrder(users.customerA.id, [{ productId: p.id, quantity: 1 }], status);
        if (status !== "PICKING") {
          await db.inventoryLog.create({
            data: { productId: p.id, orderId: order.id, delta: -1, reason: "ORDER_CONFIRM", actorId: users.staff.id },
          });
          await db.product.update({ where: { id: p.id }, data: { stock: { decrement: 1 } } });
        }
        const before = await stockOf(p.id);
        await expectApiError(await cancel(order.id), 409, "INVALID_STATE_TRANSITION");
        assert.equal(await stockOf(p.id), before);
        assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, status);
      }
    });

    await t.test("cross-customer cancellation is 404 and leaves the order intact", async () => {
      const p = await product(10);
      const order = await makeOrder(users.customerA.id, [{ productId: p.id, quantity: 1 }]);
      const response = await cancel(order.id, users.customerB.session);
      const data = await expectApiError(response, 404, "ORDER_NOT_FOUND");
      assert.equal(JSON.stringify(data).includes(order.orderNumber), false);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "CREATED");
      // And no notification is leaked either.
      assert.equal(await db.notification.count({ where: { orderId: order.id } }), 0);
    });

    await t.test("STAFF can only cancel CONFIRMED, not CREATED", async () => {
      const p = await product(10);
      const order = await makeOrder(users.customerA.id, [{ productId: p.id, quantity: 1 }]);
      const response = await cancel(order.id, users.staff.session);
      await expectApiError(response, 409, "INVALID_STATE_TRANSITION");
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "CREATED");
    });

    await t.test("ADMIN cannot cancel at all", async () => {
      const p = await product(10);
      const order = await makeOrder(users.customerA.id, [{ productId: p.id, quantity: 1 }], "CONFIRMED");
      await expectApiError(await cancel(order.id, users.admin.session), 403, "FORBIDDEN");
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "CONFIRMED");
    });

    await t.test("multi-product release failure rolls back status, stock and all logs", async () => {
      const a = await product(10);
      const b = await product(10);
      const order = await makeOrder(users.customerA.id, [
        { productId: a.id, quantity: 2 },
        { productId: b.id, quantity: 2 },
      ]);
      await handlers.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
        method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session,
      }), order.id);
      const before = {
        a: await stockOf(a.id),
        b: await stockOf(b.id),
        logs: await db.inventoryLog.count({ where: { orderId: order.id } }),
        status: (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
      };
      let releases = 0;
      const broken = new Proxy(db, {
        get(target, key) {
          if (key === "$transaction") {
            return (fn: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: object) =>
              target.$transaction(async (tx: Prisma.TransactionClient) => {
                const wrapped = new Proxy(tx, {
                  get(t, k) {
                    if (k === "inventoryLog") {
                      return {
                        create: async (args: { data?: { reason?: string } }) => {
                          if (args?.data?.reason === "ORDER_CANCEL_RELEASE") {
                            releases += 1;
                            if (releases === 2) throw new Error("Injected release failure");
                          }
                          return (t as unknown as { inventoryLog: { create: (a: unknown) => Promise<unknown> } }).inventoryLog.create(args);
                        },
                      };
                    }
                    return Reflect.get(t, k);
                  },
                });
                return fn(wrapped);
              }, options);
          }
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const response = await createOrderHandlers(broken).updateStatus(
        apiRequest("http://localhost/api/v1/orders/id/status", {
          method: "PATCH", body: { to: "CANCELLED" }, session: users.customerA.session,
        }),
        order.id,
      );
      await expectApiError(response, 500, "INTERNAL_ERROR");
      assert.equal(await stockOf(a.id), before.a, "the restore of the first product must also roll back");
      assert.equal(await stockOf(b.id), before.b);
      assert.equal(await db.inventoryLog.count({ where: { orderId: order.id } }), before.logs);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, before.status);
    });
  } finally {
    await dispose();
  }
});
