import { test } from "node:test";
import assert from "node:assert/strict";
import { apiRequest, createTestDatabase, createUsers, expectApiError } from "./harness";
import { createOrderPost } from "../lib/create-order";
import { createOrderHandlers } from "../lib/order-api";
import { createShipmentHandlers } from "../lib/shipment-api";

// Full main chain (session-based): order → confirm → pick → ship → pickup → deliver, plus cancellation and tracking.
test("Logistics chain / real isolated SQLite", { timeout: 180000 }, async t => {
  const { db, dispose } = await createTestDatabase("logistics-chain");
  try {
    const users = await createUsers(db);
    const product = await db.product.create({ data: { sku: "SKU001", name: "Water", priceCents: 150, stock: 10, lowStockThreshold: 5 } });
    const post = createOrderPost(db);
    const handlers = createOrderHandlers(db);
    const shipments = createShipmentHandlers(db);

    const create = (session = users.customerA.session) => post(apiRequest("http://localhost/api/v1/orders", {
      method: "POST", body: { deliveryAddress: "Demo Address, Example Street", items: [{ sku: "SKU001", quantity: 2 }] }, session,
    }));
    const patch = (id: string, to: string, session = users.staff.session) => handlers.updateStatus(
      apiRequest("http://localhost/api/v1/orders/id/status", { method: "PATCH", body: { to }, session }),
      id,
    );
    const ship = (orderNumber: string, session = users.staff.session, carrier = "SF Express") => shipments.createShipment(
      apiRequest("http://localhost/api/v1/shipments", { method: "POST", body: { orderNumber, carrier }, session }),
    );
    const track = (id: string, session = users.customerA.session) => handlers.getTracking(
      apiRequest("http://localhost", { session }),
      id,
    );
    const stock = async () => (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock;

    let orderId = "";
    let orderNumber = "";

    await t.test("create -> confirm -> pick: stock reserved once, PICKING no further change", async () => {
      const created = await create();
      assert.equal(created.status, 201);
      const { order } = await created.json();
      orderId = order.id;
      orderNumber = order.orderNumber;
      assert.equal(await stock(), 10);
      assert.equal((await patch(orderId, "CONFIRMED")).status, 200);
      assert.equal(await stock(), 8);
      assert.equal(await db.inventoryLog.count({ where: { orderId } }), 1);
      const picked = await patch(orderId, "PICKING");
      assert.equal(picked.status, 200);
      assert.deepEqual(await picked.json(), { order: { id: orderId, orderNumber, status: "PICKING", totalCents: 300 } });
      assert.equal(await stock(), 8);
      assert.equal(await db.inventoryLog.count({ where: { orderId } }), 1);
    });

    await t.test("PICKING from CREATED is rejected 409 with no change", async () => {
      const created = await create();
      const { order } = await created.json();
      const before = await stock();
      const response = await patch(order.id, "PICKING");
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, "INVALID_STATE_TRANSITION");
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "CREATED");
      assert.equal(await stock(), before);
    });

    await t.test("shipment from PICKING: LG waybill + initial event, stock unchanged", async () => {
      const before = await stock();
      const response = await ship(orderNumber);
      assert.equal(response.status, 201);
      const data = await response.json();
      assert.match(data.shipment.trackingNumber, /^LG-\d{8}-\d{6}$/);
      assert.equal(data.shipment.carrier, "SF Express");
      assert.equal(data.shipment.status, "SHIPPED");
      assert.deepEqual(data.order, { id: orderId, orderNumber, status: "SHIPPED", totalCents: 300 });
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, "SHIPPED");
      assert.equal(await stock(), before);
      assert.equal(await db.inventoryLog.count({ where: { orderId } }), 1);
      const shipment = await db.shipment.findUniqueOrThrow({ where: { orderId } });
      assert.equal(shipment.trackingNumber, data.shipment.trackingNumber);
      const events = await db.trackingEvent.findMany({ where: { shipmentId: shipment.id } });
      assert.equal(events.length, 1);
      assert.equal(events[0].location, "Warehouse");
      // Only one shipped notification is produced.
      assert.equal(await db.notification.count({ where: { orderId, type: "SHIPMENT_SHIPPED" } }), 1);
    });

    await t.test("shipment from CONFIRMED is rejected; no waybill or event residue", async () => {
      const created = await create();
      const { order } = await created.json();
      assert.equal((await patch(order.id, "CONFIRMED")).status, 200);
      const shipmentsBefore = await db.shipment.count();
      const eventsBefore = await db.trackingEvent.count();
      const response = await ship(order.orderNumber);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, "INVALID_STATE_TRANSITION");
      assert.equal(await db.shipment.count(), shipmentsBefore);
      assert.equal(await db.trackingEvent.count(), eventsBefore);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "CONFIRMED");
    });

    await t.test("sequential duplicate shipment: 409 and still one waybill", async () => {
      const response = await ship(orderNumber);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, "SHIPMENT_EXISTS");
      assert.equal(await db.shipment.count({ where: { orderId } }), 1);
      assert.equal(await db.trackingEvent.count({ where: { shipment: { orderId } } }), 1);
    });

    await t.test("concurrent duplicate shipment: exactly one waybill", async () => {
      const created = await create();
      const { order } = await created.json();
      assert.equal((await patch(order.id, "CONFIRMED")).status, 200);
      assert.equal((await patch(order.id, "PICKING")).status, 200);
      const responses = await Promise.all([
        ship(order.orderNumber, users.staff.session, "A"),
        ship(order.orderNumber, users.staff.session, "B"),
      ]);
      const codes = responses.map(response => response.status).sort();
      assert.ok(codes.includes(201), `expected one 201, got ${codes}`);
      assert.equal(await db.shipment.count({ where: { orderId: order.id } }), 1);
      assert.equal(await db.trackingEvent.count({ where: { shipment: { orderId: order.id } } }), 1);
      assert.equal(await db.notification.count({ where: { orderId: order.id, type: "SHIPMENT_SHIPPED" } }), 1);
    });

    await t.test("missing identity / non-STAFF cannot update status or ship", async () => {
      const created = await create();
      const { order } = await created.json();
      assert.equal((await patch(order.id, "CONFIRMED")).status, 200);
      const before = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      for (const [to, session, code] of [
        ["PICKING", null, 401],
        ["PICKING", users.customerA.session, 403],
        ["PICKING", users.admin.session, 403],
      ] as const) {
        const response = await handlers.updateStatus(
          apiRequest("http://localhost/api/v1/orders/id/status", { method: "PATCH", body: { to }, session }),
          order.id,
        );
        await expectApiError(response, code, code === 401 ? "UNAUTHENTICATED" : "FORBIDDEN");
      }
      for (const [session, code] of [[null, 401], [users.customerA.session, 403], [users.admin.session, 403]] as const) {
        const response = await ship(order.orderNumber, session as never);
        assert.equal(response.status, code);
      }
      const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(after.status, "CONFIRMED");
      assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
      assert.equal(await db.shipment.count({ where: { orderId: order.id } }), 0);
    });

    await t.test("IN_TRANSIT -> DELIVERED: shipment, ordered events, notifications, stock unchanged", async () => {
      const before = await stock();
      assert.equal((await patch(orderId, "IN_TRANSIT")).status, 200);
      let shipment = await db.shipment.findUniqueOrThrow({ where: { orderId } });
      assert.equal(shipment.status, "IN_TRANSIT");
      assert.equal(await db.trackingEvent.count({ where: { shipmentId: shipment.id } }), 2);
      assert.equal((await patch(orderId, "DELIVERED")).status, 200);
      shipment = await db.shipment.findUniqueOrThrow({ where: { orderId } });
      assert.equal(shipment.status, "DELIVERED");
      assert.ok(shipment.deliveredAt);
      const events = await db.trackingEvent.findMany({ where: { shipmentId: shipment.id }, orderBy: { at: "asc" } });
      assert.equal(events.length, 3);
      const times = events.map(event => event.at.getTime());
      assert.deepEqual(times, [...times].sort((a, b) => a - b));
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, "DELIVERED");
      assert.equal(await stock(), before);
      assert.equal(await db.inventoryLog.count({ where: { orderId } }), 1);
      // Four of the five notification types have been generated: confirmed / shipped / picked up / delivered.
      const types = (await db.notification.findMany({ where: { orderId }, orderBy: { type: "asc" } })).map(note => note.type);
      assert.deepEqual(types, ["ORDER_CONFIRMED", "SHIPMENT_DELIVERED", "SHIPMENT_IN_TRANSIT", "SHIPMENT_SHIPPED"]);
    });

    await t.test("tracking: association, ordering, ownership and empty state", async () => {
      const response = await track(orderId);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.match(data.trackingNumber, /^LG-\d{8}-\d{6}$/);
      assert.equal(data.carrier, "SF Express");
      assert.equal(data.status, "DELIVERED");
      assert.equal(data.events.length, 3);
      assert.deepEqual(data.events.map((event: { location: string }) => event.location), ["Warehouse", "Pickup station", "Delivery address"]);
      const times = data.events.map((event: { at: string }) => new Date(event.at).getTime());
      assert.deepEqual(times, [...times].sort((a: number, b: number) => a - b));

      const bad = await track("does-not-exist");
      assert.equal(bad.status, 404);
      const body = await bad.json();
      assert.equal(body.error.code, "ORDER_NOT_FOUND");
      assert.deepEqual(Object.keys(body), ["error"]);
      assert.equal(JSON.stringify(body).includes(orderNumber), false);

      // Customer B cannot read A's waybill even with the internal id.
      const foreign = await track(orderId, users.customerB.session);
      await expectApiError(foreign, 404, "ORDER_NOT_FOUND");

      const notShippedCreated = await create();
      const { order: other } = await notShippedCreated.json();
      const notShipped = await track(other.id);
      assert.equal(notShipped.status, 404);
      assert.equal((await notShipped.json()).error.code, "SHIPMENT_NOT_FOUND");
    });

    await t.test("PATCH to SHIPPED stays 400; CANCELLED no longer 400", async () => {
      const created = await create();
      const { order } = await created.json();
      assert.equal((await patch(order.id, "CONFIRMED")).status, 200);
      const stockBefore = await stock();
      const shipped = await patch(order.id, "SHIPPED");
      assert.equal(shipped.status, 400);
      assert.equal((await shipped.json()).error.code, "INVALID_ARGUMENT");
      const cancelled = await patch(order.id, "CANCELLED");
      assert.equal(cancelled.status, 200);
      const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(after.status, "CANCELLED");
      // Cancel restores the stock, and no shipment exists.
      assert.equal(await stock(), stockBefore + 2);
      assert.equal(await db.shipment.count({ where: { orderId: order.id } }), 0);
    });
  } finally {
    await dispose();
  }
});
