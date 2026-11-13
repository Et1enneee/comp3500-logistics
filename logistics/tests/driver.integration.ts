import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword } from "../lib/auth";
import { createDriverHandlers } from "../lib/driver-api";
import { createOrderHandlers, queryOrderList, queryOrderDetail, queryTracking } from "../lib/order-api";
import { apiRequest, createTestDatabase, createTestSession, createUsers, expectApiError } from "./harness";

test("Driver assignment and simulated delivery / isolated SQLite", { timeout: 180000 }, async t => {
  const { db, dispose } = await createTestDatabase("driver-flow");
  try {
    const users = await createUsers(db);
    const pass = hashPassword("Demo1234!");
    const a = await db.user.create({ data: { email: "driver-a@test.local", name: "Driver A", role: "DRIVER", passwordHash: pass } });
    const b = await db.user.create({ data: { email: "driver-b@test.local", name: "Driver B", role: "DRIVER", passwordHash: pass } });
    const sa = await createTestSession(db, a.id);
    const sb = await createTestSession(db, b.id);
    const product = await db.product.create({ data: { sku: "SKU-DRIVER", name: "Delivery item", priceCents: 200, stock: 10 } });
    async function shipment(number: string) {
      return db.order.create({ data: {
        orderNumber: number, customerId: users.customerA.id, status: "SHIPPED", totalCents: 400,
        items: { create: [{ productId: product.id, quantity: 2, unitPriceCents: 200 }] },
        shipment: { create: { trackingNumber: `LG-${number}`, carrier: "Simulated", status: "SHIPPED", shippedAt: new Date() } },
      } });
    }
    const first = await shipment("ORD-DRIVER-1");
    const second = await shipment("ORD-DRIVER-2");
    const drivers = createDriverHandlers(db);
    const orders = createOrderHandlers(db);
    const assign = (id: string, driverId: unknown, session = users.staff.session, csrf?: string | null) => drivers.assign(
      apiRequest(`http://localhost/api/v1/orders/${id}/driver`, { method: "POST", body: { driverId }, session, csrf }), id,
    );
    const tasks = (session = sa) => drivers.list(apiRequest("http://localhost/api/v1/driver/tasks", { session }));
    const move = (id: string, to: string, session = sa, csrf?: string | null) => orders.updateStatus(
      apiRequest(`http://localhost/api/v1/orders/${id}/status`, { method: "PATCH", body: { to }, session, csrf }), id,
    );

    await t.test("assignment enforces role, CSRF, valid driver and state", async () => {
      await expectApiError(await assign(first.id, a.id, users.customerA.session), 403, "FORBIDDEN");
      await expectApiError(await assign(first.id, a.id, users.admin.session), 403, "FORBIDDEN");
      await expectApiError(await assign(first.id, a.id, sa), 403, "FORBIDDEN");
      await expectApiError(await assign(first.id, a.id, users.staff.session, null), 403, "CSRF_INVALID");
      await expectApiError(await assign(first.id, users.customerA.id), 400, "INVALID_ARGUMENT");
      await expectApiError(await assign("missing", a.id), 404, "ORDER_NOT_FOUND");
      assert.equal((await assign(first.id, a.id)).status, 200);
      assert.equal((await assign(second.id, b.id)).status, 200);
    });
    await t.test("driver sees only assigned operational data and cannot access general order queries", async () => {
      const response = await tasks(); assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body.tasks.map((x: { order: { orderNumber: string } }) => x.order.orderNumber), [first.orderNumber]);
      const text = JSON.stringify(body);
      for (const value of [users.customerA.id, users.customerA.email, "Customer A", "customerId", "customer"]) assert.equal(text.includes(value), false);
      assert.equal(body.tasks[0].order.items[0].product.sku, product.sku);
      const other = await (await tasks(sb)).json();
      assert.deepEqual(other.tasks.map((x: { order: { orderNumber: string } }) => x.order.orderNumber), [second.orderNumber]);
      await expectApiError(await tasks(users.staff.session), 403, "FORBIDDEN");
      await expectApiError(await tasks(users.customerA.session), 403, "FORBIDDEN");
      const actor = { id: a.id, role: "DRIVER" as const };
      await assert.rejects(() => queryOrderList(db, actor, { page: 1, pageSize: 10 }), { status: 403 });
      await assert.rejects(() => queryOrderDetail(db, actor, first.id), { status: 403 });
      await assert.rejects(() => queryTracking(db, actor, first.id), { status: 403 });
    });
    await t.test("only assigned driver can advance; invalid actions and CSRF do not mutate", async () => {
      await expectApiError(await move(first.id, "IN_TRANSIT", sb), 404, "ORDER_NOT_FOUND");
      await expectApiError(await move(first.id, "CONFIRMED"), 403, "FORBIDDEN");
      await expectApiError(await move(first.id, "CANCELLED"), 403, "FORBIDDEN");
      await expectApiError(await move(first.id, "IN_TRANSIT", sa, null), 403, "CSRF_INVALID");
      await expectApiError(await move(first.id, "DELIVERED"), 409, "INVALID_STATE_TRANSITION");
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: first.id } })).status, "SHIPPED");
      assert.equal(await db.trackingEvent.count(), 0);
    });
    await t.test("concurrent pickup claims the transition at most once", async () => {
      const results = await Promise.all([move(second.id, "IN_TRANSIT", sb), move(second.id, "IN_TRANSIT", sb)]);
      const statuses = results.map(response => response.status);
      assert.equal(statuses.filter(status => status === 200).length, 1);
      assert.ok(statuses.every(status => [200, 409, 503].includes(status)));
      const saved = await db.shipment.findUniqueOrThrow({ where: { orderId: second.id }, include: { events: true } });
      assert.equal(saved.events.length, 1);
      assert.equal(await db.notification.count({ where: { orderId: second.id, type: "SHIPMENT_IN_TRANSIT" } }), 1);
    });
    await t.test("pickup and delivery update order, shipment, events and customer notifications once", async () => {
      const stock = (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock;
      assert.equal((await move(first.id, "IN_TRANSIT")).status, 200);
      await expectApiError(await assign(first.id, b.id), 409, "INVALID_STATE_TRANSITION");
      await expectApiError(await move(first.id, "IN_TRANSIT"), 409, "INVALID_STATE_TRANSITION");
      assert.equal((await move(first.id, "DELIVERED")).status, 200);
      await expectApiError(await move(first.id, "DELIVERED"), 409, "INVALID_STATE_TRANSITION");
      const current = await db.order.findUniqueOrThrow({ where: { id: first.id }, include: { shipment: { include: { events: true } }, notifications: true } });
      assert.equal(current.status, "DELIVERED");
      assert.equal(current.shipment?.status, "DELIVERED");
      assert.equal(current.shipment?.driverId, a.id);
      assert.equal(current.shipment?.events.length, 2);
      assert.deepEqual(current.notifications.map(n => n.type).sort(), ["SHIPMENT_DELIVERED", "SHIPMENT_IN_TRANSIT"]);
      assert.ok(current.notifications.every(n => n.userId === users.customerA.id));
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, stock);
    });
  } finally { await dispose(); }
});
