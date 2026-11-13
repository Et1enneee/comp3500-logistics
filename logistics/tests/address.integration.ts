import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrderPost } from "../lib/create-order";
import { createOrderHandlers } from "../lib/order-api";
import { createDriverHandlers } from "../lib/driver-api";
import { createReportHandlers } from "../lib/reports-api";
import { createShipmentHandlers } from "../lib/shipment-api";
import { hashPassword } from "../lib/auth";
import { apiRequest, createTestDatabase, createTestSession, createUsers, expectApiError } from "./harness";

test("Delivery address: validation, ownership and driver visibility", { timeout: 180000 }, async t => {
  const { db, dispose } = await createTestDatabase("delivery-address");
  try {
    const users = await createUsers(db);
    const product = await db.product.create({ data: { sku: "SKU-ADDR", name: "Demo Product", priceCents: 100, stock: 12 } });
    const post = createOrderPost(db);
    const handlers = createOrderHandlers(db);
    const drivers = createDriverHandlers(db);
    const reports = createReportHandlers(db);
    const create = (body: unknown) => post(apiRequest("http://localhost/api/v1/orders", { method: "POST", session: users.customerA.session, body }));
    const items = [{ sku: product.sku, quantity: 1 }];
    const address = "Fictional Alpha Building, Example Street";
    let id = "", number = "";
    await t.test("missing, blank, oversized and control-character addresses are rejected without writes", async () => {
      for (const invalid of [undefined, null, "", "   ", "x".repeat(201), "street\nnext", 42]) {
        const body = invalid === undefined ? { items } : { items, deliveryAddress: invalid };
        await expectApiError(await create(body), 400, "INVALID_ARGUMENT");
      }
      assert.equal(await db.order.count(), 0);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 12);
    });
    await t.test("valid address is trimmed, stored and visible to the order owner", async () => {
      const response = await create({ items, deliveryAddress: `  ${address}  ` });
      assert.equal(response.status, 201);
      const body = await response.json();
      id = body.order.id; number = body.order.orderNumber;
      assert.equal(body.order.deliveryAddress, address);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id } })).deliveryAddress, address);
      const own = await handlers.getOrderById(apiRequest(`http://localhost/api/v1/orders/${id}`, { session: users.customerA.session }), id);
      assert.equal((await own.json()).order.deliveryAddress, address);
      await expectApiError(await handlers.getOrderById(apiRequest(`http://localhost/api/v1/orders/${id}`, { session: users.customerB.session }), id), 404, "ORDER_NOT_FOUND");
    });
    await t.test("staff order APIs and admin exports never return the destination", async () => {
      const staff = users.staff.session;
      const list = await handlers.listOrders(apiRequest("http://localhost/api/v1/orders", { session: staff }));
      const byNumber = await handlers.getOrder(apiRequest(`http://localhost/api/v1/orders?orderNumber=${number}`, { session: staff }));
      const byId = await handlers.getOrderById(apiRequest(`http://localhost/api/v1/orders/${id}`, { session: staff }), id);
      for (const response of [list, byNumber, byId]) {
        assert.equal(response.status, 200);
        const text = await response.text();
        assert.equal(text.includes(address), false);
        assert.equal(text.includes("deliveryAddress"), false);
      }
      const csv = await reports.exportCsv(apiRequest("http://localhost/api/v1/reports/export.csv", { session: users.admin.session }));
      assert.equal(csv.status, 200);
      assert.equal((await csv.text()).includes(address), false);
    });
    await t.test("real order-to-delivery chain restricts address to the assigned driver", async () => {
      const passwordHash = hashPassword("Demo1234!");
      const a = await db.user.create({ data: { name: "Driver A", email: "driver-a@test.local", role: "DRIVER", passwordHash } });
      const b = await db.user.create({ data: { name: "Driver B", email: "driver-b@test.local", role: "DRIVER", passwordHash } });
      const sa = await createTestSession(db, a.id); const sb = await createTestSession(db, b.id);
      for (const to of ["CONFIRMED", "PICKING"]) {
        const response = await handlers.updateStatus(apiRequest(`http://localhost/api/v1/orders/${id}/status`, { method: "PATCH", body: { to }, session: users.staff.session }), id);
        assert.equal(response.status, 200);
      }
      const shipment = await createShipmentHandlers(db).createShipment(apiRequest("http://localhost/api/v1/shipments", {
        method: "POST", body: { orderNumber: number, carrier: "Demo" }, session: users.staff.session,
      }));
      assert.equal(shipment.status, 201);
      const assign = await drivers.assign(apiRequest(`http://localhost/api/v1/orders/${id}/driver`, { method: "POST", body: { driverId: a.id }, session: users.staff.session }), id);
      assert.equal(assign.status, 200);
      const own = await drivers.list(apiRequest("http://localhost/api/v1/driver/tasks", { session: sa }));
      const ownBody = await own.json();
      assert.equal(ownBody.tasks[0].order.deliveryAddress, address);
      const other = await drivers.list(apiRequest("http://localhost/api/v1/driver/tasks", { session: sb }));
      assert.equal(JSON.stringify(await other.json()).includes(address), false);
      await expectApiError(await handlers.updateStatus(apiRequest(`http://localhost/api/v1/orders/${id}/status`, { method: "PATCH", body: { to: "IN_TRANSIT" }, session: sb }), id), 404, "ORDER_NOT_FOUND");
      const reassign = await drivers.assign(apiRequest(`http://localhost/api/v1/orders/${id}/driver`, { method: "POST", body: { driverId: b.id }, session: users.staff.session }), id);
      assert.equal(reassign.status, 200);
      const aAfter = await drivers.list(apiRequest("http://localhost/api/v1/driver/tasks", { session: sa }));
      assert.equal(JSON.stringify(await aAfter.json()).includes(address), false);
      const bAfter = await drivers.list(apiRequest("http://localhost/api/v1/driver/tasks", { session: sb }));
      assert.equal((await bAfter.json()).tasks[0].order.deliveryAddress, address);
      await expectApiError(await handlers.updateStatus(apiRequest(`http://localhost/api/v1/orders/${id}/status`, { method: "PATCH", body: { to: "IN_TRANSIT" }, session: sa }), id), 404, "ORDER_NOT_FOUND");
      const pickup = await handlers.updateStatus(apiRequest(`http://localhost/api/v1/orders/${id}/status`, { method: "PATCH", body: { to: "IN_TRANSIT" }, session: sb }), id);
      assert.equal(pickup.status, 200);
      const lateReassign = await drivers.assign(apiRequest(`http://localhost/api/v1/orders/${id}/driver`, { method: "POST", body: { driverId: a.id }, session: users.staff.session }), id);
      await expectApiError(lateReassign, 409, "INVALID_STATE_TRANSITION");
      const delivery = await handlers.updateStatus(apiRequest(`http://localhost/api/v1/orders/${id}/status`, { method: "PATCH", body: { to: "DELIVERED" }, session: sb }), id);
      assert.equal(delivery.status, 200);
      const completed = await db.order.findUniqueOrThrow({ where: { id }, include: { shipment: true, notifications: true } });
      assert.equal(completed.status, "DELIVERED");
      assert.equal(completed.shipment?.status, "DELIVERED");
      assert.equal(completed.deliveryAddress, address);
      assert.ok(completed.notifications.some(n => n.type === "SHIPMENT_DELIVERED" && n.userId === users.customerA.id));
    });
  } finally { await dispose(); }
});
