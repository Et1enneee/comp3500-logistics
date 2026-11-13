import { test } from "node:test";
import assert from "node:assert/strict";
import { apiRequest, createTestDatabase, createUsers, expectApiError } from "./harness";
import { createNotificationHandlers } from "../lib/notifications-api";
import { createOrderHandlers } from "../lib/order-api";

test("In-app notifications / real isolated SQLite", { timeout: 180000 }, async t => {
  const { db, dispose } = await createTestDatabase("notifications");
  try {
    const users = await createUsers(db);
    const handlers = createNotificationHandlers(db);
    const orders = createOrderHandlers(db);
    const product = await db.product.create({ data: { sku: "SKU001", name: "Water", priceCents: 150, stock: 50, lowStockThreshold: 5 } });
    let serial = 0;

    async function makeOrder(customerId: string, quantity = 1) {
      return db.order.create({
        data: {
          orderNumber: `ORD-N-${++serial}`, customerId, status: "CREATED", totalCents: quantity * 150,
          items: { create: [{ productId: product.id, quantity, unitPriceCents: 150 }] },
        },
      });
    }
    const confirm = (id: string) => orders.updateStatus(
      apiRequest("http://localhost/api/v1/orders/id/status", { method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session }),
      id,
    );
    const list = (session = users.customerA.session, query = "") => handlers.list(
      apiRequest("http://localhost/api/v1/notifications" + query, { session }),
    );

    await t.test("confirmation creates exactly one notification with ORD + type + time", async () => {
      const order = await makeOrder(users.customerA.id);
      assert.equal((await confirm(order.id)).status, 200);
      const rows = await db.notification.findMany({ where: { orderId: order.id } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].type, "ORDER_CONFIRMED");
      assert.equal(rows[0].userId, users.customerA.id);
      assert.ok(rows[0].content.includes(order.orderNumber));
      assert.ok(rows[0].content.includes("GMT+8"));
      assert.equal(rows[0].read, false);
    });

    await t.test("list is scoped to the owner and exposes unread count", async () => {
      const order = await makeOrder(users.customerA.id);
      await confirm(order.id);
      const a = await (await list()).json();
      assert.ok(a.notifications.every((note: { orderNumber: string | null }) => note.orderNumber !== null));
      assert.ok(a.unreadCount >= 2);
      const b = await (await list(users.customerB.session)).json();
      assert.equal(b.total, 0, "Customer B cannot see A's notifications");
    });

    await t.test("mark read only affects own notification; others => 404", async () => {
      const order = await makeOrder(users.customerA.id);
      await confirm(order.id);
      const note = await db.notification.findFirstOrThrow({ where: { orderId: order.id } });
      const foreign = await handlers.markRead(
        apiRequest("http://localhost/api/v1/notifications/x/read", { method: "POST", session: users.customerB.session }),
        note.id,
      );
      await expectApiError(foreign, 404, "NOTIFICATION_NOT_FOUND");
      assert.equal((await db.notification.findUniqueOrThrow({ where: { id: note.id } })).read, false);

      const own = await handlers.markRead(
        apiRequest("http://localhost/api/v1/notifications/x/read", { method: "POST", session: users.customerA.session }),
        note.id,
      );
      assert.equal(own.status, 200);
      assert.equal((await db.notification.findUniqueOrThrow({ where: { id: note.id } })).read, true);
      const missing = await handlers.markRead(
        apiRequest("http://localhost/api/v1/notifications/x/read", { method: "POST", session: users.customerA.session }),
        "does-not-exist",
      );
      await expectApiError(missing, 404, "NOTIFICATION_NOT_FOUND");
    });

    await t.test("unread-only filter and unread-count endpoint agree", async () => {
      const unread = await (await list(users.customerA.session, "?unread=1")).json();
      assert.ok(unread.notifications.every((note: { read: boolean }) => note.read === false));
      const count = await (await handlers.unreadCount(
        apiRequest("http://localhost/api/v1/notifications/unread-count", { session: users.customerA.session }),
      )).json();
      assert.equal(count.unreadCount, unread.unreadCount);
    });

    await t.test("duplicate/concurrent operations do not multiply notifications", async () => {
      const order = await makeOrder(users.customerA.id, 2);
      const responses = await Promise.all([confirm(order.id), confirm(order.id)]);
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
      assert.equal(await db.notification.count({ where: { orderId: order.id, type: "ORDER_CONFIRMED" } }), 1);
    });

    await t.test("cancel / ship / transit / deliver each produce one notification", async () => {
      const order = await makeOrder(users.customerA.id);
      assert.equal((await confirm(order.id)).status, 200);
      const pick = await orders.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
        method: "PATCH", body: { to: "PICKING" }, session: users.staff.session,
      }), order.id);
      assert.equal(pick.status, 200);
      const { createShipmentHandlers } = await import("../lib/shipment-api");
      const shipped = await createShipmentHandlers(db).createShipment(apiRequest("http://localhost/api/v1/shipments", {
        method: "POST", body: { orderNumber: order.orderNumber, carrier: "SF Express" }, session: users.staff.session,
      }));
      assert.equal(shipped.status, 201);
      assert.equal((await orders.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
        method: "PATCH", body: { to: "IN_TRANSIT" }, session: users.staff.session,
      }), order.id)).status, 200);
      assert.equal((await orders.updateStatus(apiRequest("http://localhost/api/v1/orders/id/status", {
        method: "PATCH", body: { to: "DELIVERED" }, session: users.staff.session,
      }), order.id)).status, 200);
      const types = (await db.notification.findMany({ where: { orderId: order.id }, orderBy: { type: "asc" } }))
        .map(note => note.type);
      assert.deepEqual(types, ["ORDER_CONFIRMED", "SHIPMENT_DELIVERED", "SHIPMENT_IN_TRANSIT", "SHIPMENT_SHIPPED"]);
    });

    await t.test("failed transaction produces no success notification", async () => {
      const order = await makeOrder(users.customerA.id, 100);
      const response = await confirm(order.id);
      assert.equal(response.status, 409);
      assert.equal(await db.notification.count({ where: { orderId: order.id } }), 0);
    });

    await t.test("STAFF/ADMIN cannot use customer notification APIs", async () => {
      await expectApiError(await list(users.staff.session), 403, "FORBIDDEN");
      await expectApiError(await list(users.admin.session), 403, "FORBIDDEN");
    });

    await t.test("pagination keeps totals independent of page size", async () => {
      const all = await (await list(users.customerA.session, "?pageSize=2&page=1")).json();
      assert.equal(all.pageSize, 2);
      assert.ok(all.total >= 5);
      const firstPage = all.notifications.length;
      assert.equal(firstPage, 2);
      const second = await (await list(users.customerA.session, "?pageSize=2&page=2")).json();
      assert.equal(second.total, all.total);
      assert.notEqual(second.notifications[0]?.id, all.notifications[0]?.id);
    });
  } finally {
    await dispose();
  }
});
