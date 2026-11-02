import { test } from "node:test";
import assert from "node:assert/strict";
import { apiRequest, createTestDatabase, createUsers, expectApiError } from "./harness";
import { createOrderPost } from "../lib/create-order";
import { createOrderHandlers } from "../lib/order-api";

// Customer creates an order: identity comes from the session; creation only pre-checks stock — no deduction, no ledger entry.
test("Foundation creation / real isolated SQLite", { timeout: 180000 }, async t => {
  const { db, dispose } = await createTestDatabase("foundation-create");
  try {
    const users = await createUsers(db);
    await db.user.create({
      data: { email: "leak@test.local", name: "Leak", role: "CUSTOMER", passwordHash: "NEVER_LEAK" },
    });
    const product = await db.product.create({ data: { sku: "SKU001", name: "Water", priceCents: 150, stock: 10 } });
    const post = createOrderPost(db);
    const handlers = createOrderHandlers(db);
    const create = (body: unknown, session: typeof users.customerA.session | null = users.customerA.session) =>
      post(apiRequest("http://localhost/api/v1/orders", { method: "POST", body, session }));

    let createdId = "";
    let createdNumber = "";

    await t.test("create stores snapshot / leaves inventory and logs unchanged", async () => {
      const response = await create({ items: [{ sku: "SKU001", quantity: 2 }] });
      assert.equal(response.status, 201);
      const { order } = await response.json();
      createdId = order.id;
      createdNumber = order.orderNumber;
      assert.match(order.orderNumber, /^ORD-\d{8}-\d{4}$/);
      assert.equal(order.status, "CREATED");
      assert.equal(order.totalCents, 300);
      assert.equal(order.items[0].unitPriceCents, 150);
      const stored = await db.product.findUniqueOrThrow({ where: { id: product.id } });
      assert.equal(stored.stock, 10);
      assert.equal(await db.inventoryLog.count(), 0);
      const owner = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(owner.customerId, users.customerA.id);
    });

    await t.test("duplicate SKUs aggregate before stock precheck", async () => {
      const count = await db.order.count();
      const response = await create({ items: [{ sku: "SKU001", quantity: 6 }, { sku: "SKU001", quantity: 6 }] });
      const error = await expectApiError(response, 400, "INSUFFICIENT_STOCK_SKU001");
      assert.match(error.error.message, /available stock/);
      assert.equal(await db.order.count(), count);
    });

    await t.test("single SKU shortage preserves its established code and writes nothing", async () => {
      const before = { orders: await db.order.count(), stock: (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, logs: await db.inventoryLog.count() };
      await expectApiError(await create({ items: [{ sku: "SKU001", quantity: 11 }] }), 400, "INSUFFICIENT_STOCK_SKU001");
      assert.deepEqual({ orders: await db.order.count(), stock: (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, logs: await db.inventoryLog.count() }, before);
    });

    await t.test("valid duplicate SKUs become one order line", async () => {
      const response = await create({ items: [{ sku: "SKU001", quantity: 1 }, { sku: "SKU001", quantity: 2 }] });
      assert.equal(response.status, 201);
      const { order } = await response.json();
      assert.equal(order.items.length, 1);
      assert.equal(order.items[0].quantity, 3);
      assert.equal(order.totalCents, 450);
    });

    await t.test("reject empty / negative / fractional / malformed lines without writing", async () => {
      const count = await db.order.count();
      for (const items of [
        [], [{ sku: "SKU001", quantity: -2 }], [{ sku: "SKU001", quantity: 1.5 }],
        [{ sku: "SKU001", quantity: "2" }], [null], [{ sku: "  ", quantity: 1 }],
      ]) {
        assert.equal((await create({ items })).status, 400);
      }
      assert.equal(await db.order.count(), count);
    });

    await t.test("malformed JSON / non-object body return structured 400", async () => {
      const broken = await post(apiRequest("http://localhost/api/v1/orders", {
        method: "POST", rawBody: "{", session: users.customerA.session,
      }));
      assert.equal(broken.status, 400);
      assert.equal((await broken.json()).error.code, "INVALID_ARGUMENT");
      assert.equal((await create(null)).status, 400);
      assert.equal((await create([])).status, 400);
    });

    await t.test("unknown SKU is rejected with readable message", async () => {
      const before = { orders: await db.order.count(), stock: (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, logs: await db.inventoryLog.count() };
      const response = await create({ items: [{ sku: "MISSING", quantity: 1 }] });
      const error = await expectApiError(response, 400, "SKU_NOT_FOUND_MISSING");
      assert.match(error.error.message, /MISSING/);
      assert.deepEqual({ orders: await db.order.count(), stock: (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, logs: await db.inventoryLog.count() }, before);
    });

    await t.test("unauthenticated create is 401; non-CUSTOMER roles are 403", async () => {
      await expectApiError(await create({ items: [{ sku: "SKU001", quantity: 1 }] }, null), 401, "UNAUTHENTICATED");
      await expectApiError(await create({ items: [{ sku: "SKU001", quantity: 1 }] }, users.staff.session), 403, "FORBIDDEN");
      await expectApiError(await create({ items: [{ sku: "SKU001", quantity: 1 }] }, users.admin.session), 403, "FORBIDDEN");
    });

    await t.test("body identity tampering is rejected (cannot order for someone else)", async () => {
      await expectApiError(
        await create({ email: users.customerB.email, items: [{ sku: "SKU001", quantity: 1 }] }),
        403, "FORBIDDEN",
      );
      await expectApiError(
        await create({ customerId: users.customerB.id, items: [{ sku: "SKU001", quantity: 1 }] }),
        403, "FORBIDDEN",
      );
      // Legacy fields are accepted when they match the session, but customerId still follows the session.
      const ok = await create({ email: users.customerA.email, items: [{ sku: "SKU001", quantity: 1 }] });
      assert.equal(ok.status, 201);
      const { order } = await ok.json();
      const stored = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(stored.customerId, users.customerA.id);
    });

    await t.test("write without CSRF token is rejected", async () => {
      const response = await post(apiRequest("http://localhost/api/v1/orders", {
        method: "POST", body: { items: [{ sku: "SKU001", quantity: 1 }] },
        session: users.customerA.session, csrf: null,
      }));
      await expectApiError(response, 403, "CSRF_INVALID");
    });

    await t.test("end-to-end create / lookup / confirm / repeat preserves snapshot", async () => {
      await db.product.update({ where: { id: product.id }, data: { priceCents: 200 } });
      const detail = await handlers.getOrder(apiRequest(
        `http://localhost/api/v1/orders?orderNumber=${createdNumber}`, { session: users.customerA.session },
      ));
      assert.equal(detail.status, 200);
      const payload = await detail.json();
      assert.equal(JSON.stringify(payload).includes("passwordHash"), false);
      assert.equal(JSON.stringify(payload).includes("NEVER_LEAK"), false);
      assert.equal(payload.order.totalCents, 300);

      const confirm = () => handlers.updateStatus(
        apiRequest("http://localhost/api/v1/orders/id/status", { method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session }),
        createdId,
      );
      assert.equal((await confirm()).status, 200);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 8);
      assert.equal(await db.inventoryLog.count({ where: { orderId: createdId } }), 1);
      assert.equal((await confirm()).status, 409);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: createdId } })).totalCents, 300);
    });

    await t.test("stock changed after creation: confirmation fails without side effects", async () => {
      await db.product.update({ where: { id: product.id }, data: { stock: 10 } });
      const response = await create({ items: [{ sku: "SKU001", quantity: 10 }] });
      assert.equal(response.status, 201);
      const { order } = await response.json();
      await db.product.update({ where: { id: product.id }, data: { stock: 3 } });
      const result = await handlers.updateStatus(
        apiRequest("http://localhost/api/v1/orders/id/status", {
          method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session,
        }),
        order.id,
      );
      assert.equal(result.status, 409);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "CREATED");
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
      assert.equal(await db.inventoryLog.count({ where: { orderId: order.id } }), 0);
    });
  } finally {
    await dispose();
  }
});
