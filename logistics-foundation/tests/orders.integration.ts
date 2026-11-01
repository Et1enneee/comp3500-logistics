import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { apiRequest, createTestDatabase, createUsers, expectApiError } from "./harness";
import { createOrderHandlers } from "../lib/order-api";

// 确认/状态机/权限：业务断言沿用基线，只把“演示邮箱头”换成真实会话。
test("Order confirmation and status / real isolated SQLite", { timeout: 180000 }, async t => {
  const { db, peer, dispose } = await createTestDatabase("order-confirm");
  try {
    const users = await createUsers(db);
    const handlers = createOrderHandlers(db);
    const peerHandlers = createOrderHandlers(peer);
    let serial = 0;

    async function product(stock: number) {
      return db.product.create({ data: { sku: `SKU-TEST-${++serial}`, name: "Test product", stock, priceCents: 150 } });
    }
    async function makeOrder(lines: { productId: string; quantity: number }[], status = "CREATED") {
      return db.order.create({
        data: {
          orderNumber: `ORD-TEST-${++serial}`,
          customerId: users.customerA.id,
          status: status as "CREATED",
          totalCents: lines.reduce((sum, line) => sum + line.quantity * 150, 0),
          items: { create: lines.map(line => ({ ...line, unitPriceCents: 150 })) },
        },
      });
    }
    function patch(id: string, body: unknown, session = users.staff.session, options: { raw?: boolean; contentType?: string; csrf?: string | null } = {}) {
      return handlers.updateStatus(
        apiRequest("http://localhost/api/v1/orders/id/status", {
          method: "PATCH",
          rawBody: options.raw ? String(body) : JSON.stringify(body),
          session,
          csrf: options.csrf,
          contentType: options.contentType,
        }),
        id,
      );
    }
    async function snapshot(id: string, productIds: string[]) {
      const order = await db.order.findUniqueOrThrow({ where: { id } });
      const products = await db.product.findMany({ where: { id: { in: productIds } }, orderBy: { id: "asc" } });
      const logs = await db.inventoryLog.findMany({ where: { orderId: id }, orderBy: { productId: "asc" } });
      return { order, products, logs };
    }

    const baseProduct = await product(20);
    const base = await makeOrder([{ productId: baseProduct.id, quantity: 2 }]);

    await t.test("GET: missing/empty/blank orderNumber => 400", async () => {
      for (const query of ["", "?orderNumber=", "?orderNumber=%20%20"]) {
        const response = await handlers.getOrder(apiRequest("http://localhost/api/v1/orders" + query, { session: users.staff.session }));
        await expectApiError(response, 400, "INVALID_ARGUMENT");
      }
    });

    await t.test("GET: unauthenticated => 401; nonexistent order => 404", async () => {
      await expectApiError(
        await handlers.getOrder(apiRequest("http://localhost/api/v1/orders?orderNumber=" + base.orderNumber)),
        401, "UNAUTHENTICATED",
      );
      await expectApiError(
        await handlers.getOrder(apiRequest("http://localhost/api/v1/orders?orderNumber=missing", { session: users.staff.session })),
        404, "ORDER_NOT_FOUND",
      );
    });

    await t.test("GET: customer reading another customer's order => 404 (no existence leak)", async () => {
      const response = await handlers.getOrder(apiRequest(
        "http://localhost/api/v1/orders?orderNumber=" + base.orderNumber,
        { session: users.customerB.session },
      ));
      const data = await expectApiError(response, 404, "ORDER_NOT_FOUND");
      assert.equal(JSON.stringify(data).includes(base.orderNumber), false);
      const own = await handlers.getOrder(apiRequest(
        "http://localhost/api/v1/orders?orderNumber=" + base.orderNumber,
        { session: users.customerA.session },
      ));
      assert.equal(own.status, 200);
    });

    await t.test("GET: detail includes SKU/name and never leaks secrets", async () => {
      const response = await handlers.getOrder(apiRequest(
        "http://localhost/api/v1/orders?orderNumber=" + base.orderNumber,
        { session: users.staff.session },
      ));
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.order.id, base.id);
      assert.equal(data.order.status, "CREATED");
      assert.equal(data.order.totalCents, 300);
      assert.equal(data.order.items[0].product.sku, baseProduct.sku);
      assert.equal(data.order.items[0].product.name, baseProduct.name);
      assert.equal(data.order.items[0].quantity, 2);
      assert.equal(data.order.items[0].unitPriceCents, 150);
      const text = JSON.stringify(data);
      assert.equal(text.includes("passwordHash"), false);
      assert.equal(text.includes("password"), false);
    });

    await t.test("PATCH: invalid/empty/malformed body => 400, no mutation", async () => {
      const before = await snapshot(base.id, [baseProduct.id]);
      for (const body of [null, [], {}, { to: "SHIPPED" }, { to: "confirmed" }, { to: 2 }]) {
        await expectApiError(await patch(base.id, body), 400, "INVALID_ARGUMENT");
      }
      const broken = await handlers.updateStatus(
        apiRequest("http://localhost/api/v1/orders/id/status", {
          method: "PATCH", rawBody: "{not-json", session: users.staff.session,
        }),
        base.id,
      );
      await expectApiError(broken, 400, "INVALID_ARGUMENT");
      const textPlain = await handlers.updateStatus(
        apiRequest("http://localhost/api/v1/orders/id/status", {
          method: "PATCH", rawBody: JSON.stringify({ to: "CONFIRMED" }), session: users.staff.session, contentType: "text/plain",
        }),
        base.id,
      );
      await expectApiError(textPlain, 400, "INVALID_ARGUMENT");
      assert.deepEqual(await snapshot(base.id, [baseProduct.id]), before);
    });

    await t.test("PATCH: missing identity => 401; role spoof / wrong role => 403; CSRF => 403", async () => {
      const before = await snapshot(base.id, [baseProduct.id]);
      await expectApiError(await handlers.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
        method: "PATCH", body: { to: "CONFIRMED" },
      }), base.id), 401, "UNAUTHENTICATED");
      await expectApiError(await patch(base.id, { to: "CONFIRMED", role: "STAFF" }, users.customerA.session), 403, "FORBIDDEN");
      await expectApiError(await patch(base.id, { to: "CONFIRMED" }, users.admin.session), 403, "FORBIDDEN");
      await expectApiError(await patch(base.id, { to: "CONFIRMED" }, users.staff.session, { csrf: null }), 403, "CSRF_INVALID");
      assert.deepEqual(await snapshot(base.id, [baseProduct.id]), before);
    });

    await t.test("PATCH: unknown internal ID and ORD-number-as-ID => 404", async () => {
      await expectApiError(await patch("missing-internal-id", { to: "CONFIRMED" }), 404, "ORDER_NOT_FOUND");
      await expectApiError(await patch(base.orderNumber, { to: "CONFIRMED" }), 404, "ORDER_NOT_FOUND");
    });

    await t.test("PATCH: successful confirmation + repeated call has no effects", async () => {
      const response = await patch(base.id, { to: "CONFIRMED" });
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.deepEqual(data, { order: { id: base.id, orderNumber: base.orderNumber, status: "CONFIRMED", totalCents: 300 } });
      const after = await snapshot(base.id, [baseProduct.id]);
      assert.equal(after.order.status, "CONFIRMED");
      assert.equal(after.products[0].stock, 18);
      assert.equal(after.logs.length, 1);
      assert.equal(after.logs[0].delta, -2);
      assert.equal(after.logs[0].reason, "ORDER_CONFIRM");
      assert.equal(after.logs[0].orderId, base.id);
      assert.equal(after.logs[0].productId, baseProduct.id);
      assert.equal(after.logs[0].actorId, users.staff.id);
      await expectApiError(await patch(base.id, { to: "CONFIRMED" }), 409, "INVALID_STATE_TRANSITION");
      assert.deepEqual(await snapshot(base.id, [baseProduct.id]), after);
      // 确认产生了站内通知（P1-A），且不重复。
      const notes = await db.notification.findMany({ where: { orderId: base.id } });
      assert.equal(notes.length, 1);
      assert.equal(notes[0].type, "ORDER_CONFIRMED");
      assert.equal(notes[0].userId, users.customerA.id);
    });

    await t.test("PATCH: every other non-CREATED status is rejected", async () => {
      for (const state of ["PICKING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED"]) {
        const order = await makeOrder([{ productId: baseProduct.id, quantity: 1 }], state);
        const before = await snapshot(order.id, [baseProduct.id]);
        await expectApiError(await patch(order.id, { to: "CONFIRMED" }), 409, "INVALID_STATE_TRANSITION");
        assert.deepEqual(await snapshot(order.id, [baseProduct.id]), before);
      }
    });

    await t.test("PATCH: multi-product success writes one log per product", async () => {
      const a = await product(6);
      const b = await product(9);
      const order = await makeOrder([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 3 }]);
      assert.equal((await patch(order.id, { to: "CONFIRMED" })).status, 200);
      const after = await snapshot(order.id, [a.id, b.id]);
      assert.equal(after.products.find(item => item.id === a.id)!.stock, 4);
      assert.equal(after.products.find(item => item.id === b.id)!.stock, 6);
      assert.equal(after.logs.length, 2);
      assert.deepEqual(after.logs.map(log => log.delta).sort((x, y) => x - y), [-3, -2]);
    });

    await t.test("PATCH: later stock shortage rolls back earlier decrement/log/status", async () => {
      const a = await product(8);
      const b = await product(8);
      const [first, second] = [a, b].sort((x, y) => x.id.localeCompare(y.id));
      await db.product.update({ where: { id: second.id }, data: { stock: 0 } });
      const order = await makeOrder([{ productId: first.id, quantity: 2 }, { productId: second.id, quantity: 1 }]);
      const before = await snapshot(order.id, [a.id, b.id]);
      await expectApiError(await patch(order.id, { to: "CONFIRMED" }), 409, "INSUFFICIENT_STOCK");
      assert.deepEqual(await snapshot(order.id, [a.id, b.id]), before);
    });

    await t.test("PATCH: unexpected ledger failure rolls back entire transaction", async () => {
      const p = await product(6);
      const order = await makeOrder([{ productId: p.id, quantity: 2 }]);
      const before = await snapshot(order.id, [p.id]);
      const broken = new Proxy(db, {
        get(target, key) {
          if (key === "$transaction") {
            return (fn: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: object) =>
              target.$transaction(async (tx: Prisma.TransactionClient) => {
                const wrapped = new Proxy(tx, {
                  get(t, k) {
                    if (k === "inventoryLog") {
                      return { create: async () => { throw new Error("Injected ledger failure"); } };
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
          method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session,
        }),
        order.id,
      );
      await expectApiError(response, 500, "INTERNAL_ERROR");
      assert.deepEqual(await snapshot(order.id, [p.id]), before);
    });

    await t.test("PATCH: duplicate lines aggregate to one reservation/log", async () => {
      const p = await product(10);
      const order = await makeOrder([{ productId: p.id, quantity: 2 }, { productId: p.id, quantity: 3 }]);
      assert.equal((await patch(order.id, { to: "CONFIRMED" })).status, 200);
      const after = await snapshot(order.id, [p.id]);
      assert.equal(after.products[0].stock, 5);
      assert.equal(after.logs.length, 1);
      assert.equal(after.logs[0].delta, -5);
    });

    await t.test("PATCH: individually sufficient duplicate lines can fail aggregate check", async () => {
      const p = await product(4);
      const order = await makeOrder([{ productId: p.id, quantity: 3 }, { productId: p.id, quantity: 2 }]);
      const before = await snapshot(order.id, [p.id]);
      await expectApiError(await patch(order.id, { to: "CONFIRMED" }), 409, "INSUFFICIENT_STOCK");
      assert.deepEqual(await snapshot(order.id, [p.id]), before);
    });

    await t.test("PATCH: stock exactly equal to demand reaches zero, never negative", async () => {
      const p = await product(2);
      const order = await makeOrder([{ productId: p.id, quantity: 2 }]);
      assert.equal((await patch(order.id, { to: "CONFIRMED" })).status, 200);
      assert.equal((await snapshot(order.id, [p.id])).products[0].stock, 0);
    });

    await t.test("PATCH: concurrent duplicate confirmation reserves only once", async () => {
      const p = await product(10);
      const order = await makeOrder([{ productId: p.id, quantity: 3 }]);
      const responses = await Promise.all([
        patch(order.id, { to: "CONFIRMED" }),
        peerHandlers.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
          method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session,
        }), order.id),
      ]);
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
      const after = await snapshot(order.id, [p.id]);
      assert.equal(after.products[0].stock, 7);
      assert.equal(after.logs.length, 1);
      // 并发确认不应产生两条通知。
      assert.equal(await db.notification.count({ where: { orderId: order.id, type: "ORDER_CONFIRMED" } }), 1);
    });

    await t.test("PATCH: two orders compete for limited stock, no overselling", async () => {
      const p = await product(3);
      const a = await makeOrder([{ productId: p.id, quantity: 2 }]);
      const b = await makeOrder([{ productId: p.id, quantity: 2 }]);
      const responses = await Promise.all([
        patch(a.id, { to: "CONFIRMED" }),
        peerHandlers.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
          method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session,
        }), b.id),
      ]);
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
      const states = await db.order.findMany({ where: { id: { in: [a.id, b.id] } }, orderBy: { id: "asc" } });
      assert.deepEqual(states.map(order => order.status).sort(), ["CONFIRMED", "CREATED"]);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 1);
      const logs = await db.inventoryLog.findMany({ where: { productId: p.id } });
      assert.equal(logs.length, 1);
      assert.equal(logs[0].delta, -2);
    });

    await t.test("PATCH: invalid historical quantity or empty lines => no mutation", async () => {
      const p = await product(5);
      for (const lines of [[], [{ productId: p.id, quantity: 0 }], [{ productId: p.id, quantity: -1 }]]) {
        const order = await makeOrder(lines);
        const before = await snapshot(order.id, [p.id]);
        await expectApiError(await patch(order.id, { to: "CONFIRMED" }), 400, "INVALID_ARGUMENT");
        assert.deepEqual(await snapshot(order.id, [p.id]), before);
      }
    });
  } finally {
    await dispose();
  }
});

