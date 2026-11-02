import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrderHandlers } from "../lib/order-api";
import { createInventoryHandlers } from "../lib/inventory-api";
import { apiRequest, createTestDatabase, createUsers, expectApiError } from "./harness";

test("Staff order and inventory responses minimize customer identity", { timeout: 180000 }, async t => {
  const { db, dispose } = await createTestDatabase("staff-privacy");
  try {
    const users = await createUsers(db);
    const product = await db.product.create({ data: { sku: "SKU-PRIVATE", name: "Packing Item", priceCents: 100, stock: 10 } });
    const order = await db.order.create({ data: {
      orderNumber: "ORD-PRIVATE-1", customerId: users.customerA.id, totalCents: 200,
      items: { create: [{ productId: product.id, quantity: 2, unitPriceCents: 100 }] },
    } });
    const orders = createOrderHandlers(db);
    const inventory = createInventoryHandlers(db);
    const get = (path: string, session = users.staff.session) => apiRequest(`http://localhost${path}`, { session });
    const assertNoCustomerIdentity = (body: unknown) => {
      const text = JSON.stringify(body);
      for (const value of [users.customerA.email, users.customerA.id, "Customer A", '"customerId"', '"customer"']) {
        assert.equal(text.includes(value), false, `Unexpected identity in response: ${value}`);
      }
    };

    await t.test("staff list and both detail lookups omit identity but retain operational fields", async () => {
      const responses = [
        await orders.listOrders(get("/api/v1/orders")),
        await orders.getOrder(get(`/api/v1/orders?orderNumber=${order.orderNumber}`)),
        await orders.getOrderById(get(`/api/v1/orders/${order.id}`), order.id),
      ];
      for (const response of responses) {
        assert.equal(response.status, 200);
        const payload = await response.json();
        assertNoCustomerIdentity(payload);
        const row = payload.order ?? payload.orders[0];
        assert.equal(row.orderNumber, order.orderNumber);
        assert.equal(row.status, "CREATED");
        if (row.items) {
          assert.equal(row.items[0].product.sku, product.sku);
          assert.equal(row.items[0].quantity, 2);
        } else assert.equal(row.itemCount, 1);
      }
    });
    await t.test("customer can read own identity; other customer and admin remain blocked", async () => {
      const own = await orders.getOrderById(get(`/api/v1/orders/${order.id}`, users.customerA.session), order.id);
      assert.equal(own.status, 200);
      const body = await own.json();
      assert.equal(body.order.customer.email, users.customerA.email);
      assert.equal(body.order.customerId, users.customerA.id);
      await expectApiError(await orders.getOrderById(get(`/api/v1/orders/${order.id}`, users.customerB.session), order.id), 404, "ORDER_NOT_FOUND");
      await expectApiError(await orders.getOrderById(get(`/api/v1/orders/${order.id}`, users.admin.session), order.id), 403, "FORBIDDEN");
      await expectApiError(await orders.getOrderById(apiRequest(`http://localhost/api/v1/orders/${order.id}`), order.id), 401, "UNAUTHENTICATED");
    });
    await t.test("customer cancellation keeps internal audit identity but redacts staff and admin ledger responses", async () => {
      const patch = (session: typeof users.staff.session, to: string) => orders.updateStatus(
        apiRequest(`http://localhost/api/v1/orders/${order.id}/status`, { method: "PATCH", session, body: { to } }), order.id,
      );
      assert.equal((await patch(users.staff.session, "CONFIRMED")).status, 200);
      assert.equal((await patch(users.customerA.session, "CANCELLED")).status, 200);
      const release = await db.inventoryLog.findFirstOrThrow({ where: { orderId: order.id, reason: "ORDER_CANCEL_RELEASE" } });
      assert.equal(release.actorId, users.customerA.id);
      for (const session of [users.staff.session, users.admin.session]) {
        const response = await inventory.listLogs(get(`/api/v1/inventory/logs?orderNumber=${order.orderNumber}`, session));
        assert.equal(response.status, 200);
        const payload = await response.json();
        assertNoCustomerIdentity(payload);
        const customerAction = payload.logs.find((row: { reason: string }) => row.reason === "ORDER_CANCEL_RELEASE");
        assert.deepEqual(customerAction.actor, { name: "Customer", email: null });
        assert.equal(customerAction.delta, 2);
        const staffAction = payload.logs.find((row: { reason: string }) => row.reason === "ORDER_CONFIRM");
        assert.equal(staffAction.actor.email, users.staff.email);
      }
    });
  } finally { await dispose(); }
});
