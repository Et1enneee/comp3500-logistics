import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { createOrderPost } from "../lib/create-order";
import { createOrderHandlers } from "../lib/order-api";
import { createShipmentHandlers } from "../lib/shipment-api";

test("v0.3 logistics chain / real isolated SQLite", { timeout: 180000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), "logistics-chain-"));
  let db: PrismaClient | undefined;
  try {
    const url = "file:" + join(directory, "test.db");
    const source = await readFile(resolve("prisma/schema.prisma"), "utf8");
    const schema = join(directory, "schema.prisma");
    await writeFile(schema, source.replace(/url\s*=\s*"file:\.\/dev\.db"/, 'url = env("ORDER_TEST_DATABASE_URL")'));
    const require = createRequire(resolve("package.json"));
    execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--schema", schema, "--skip-generate"], { env: { ...process.env, ORDER_TEST_DATABASE_URL: url }, stdio: "pipe", timeout: 60000 });
    const client = db = new PrismaClient({ datasources: { db: { url } } });
    await client.$connect();
    await client.user.createMany({ data: [
      { email: "customer@test.local", name: "Customer", role: "CUSTOMER", passwordHash: "NEVER_LEAK" },
      { email: "staff@test.local", name: "Staff", role: "STAFF", passwordHash: "DEMO_ONLY" },
      { email: "admin@test.local", name: "Admin", role: "ADMIN", passwordHash: "DEMO_ONLY" },
    ] });
    const product = await client.product.create({ data: { sku: "SKU001", name: "Water", priceCents: 150, stock: 10, lowStockThreshold: 5 } });
    const post = createOrderPost(client);
    const handlers = createOrderHandlers(client);
    const shipments = createShipmentHandlers(client);
    const create = (body: unknown) => post(new Request("http://localhost/api/v1/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    const patch = (id: string, to: string, email: string | null = "staff@test.local") => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (email !== null) headers["X-Demo-User-Email"] = email;
      return handlers.confirmOrder(new Request("http://localhost/api/v1/orders/id/status", { method: "PATCH", headers, body: JSON.stringify({ to }) }), id);
    };
    const ship = (body: unknown, email: string | null = "staff@test.local") => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (email !== null) headers["X-Demo-User-Email"] = email;
      return shipments.createShipment(new Request("http://localhost/api/v1/shipments", { method: "POST", headers, body: JSON.stringify(body) }));
    };
    const track = (id: string) => handlers.getTracking(new Request("http://localhost"), id);
    const stock = async () => (await client.product.findUniqueOrThrow({ where: { id: product.id } })).stock;

    let orderId = ""; let orderNumber = "";
    await t.test("CONFIRMED -> PICKING: legal, stock and inventory logs unchanged", async () => {
      const r = await create({ email: "customer@test.local", items: [{ sku: "SKU001", quantity: 2 }] });
      assert.equal(r.status, 201);
      const { order } = await r.json(); orderId = order.id; orderNumber = order.orderNumber;
      const confirmed = await patch(orderId, "CONFIRMED");
      assert.equal(confirmed.status, 200);
      assert.equal(await stock(), 8);
      assert.equal(await client.inventoryLog.count({ where: { orderId } }), 1);
      assert.equal((await client.inventoryLog.findFirstOrThrow({ where: { orderId } })).reason, "ORDER_CONFIRM");
      const picked = await patch(orderId, "PICKING");
      assert.equal(picked.status, 200);
      assert.deepEqual(await picked.json(), { order: { id: orderId, orderNumber, status: "PICKING", totalCents: 300 } });
      assert.equal((await client.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PICKING");
      assert.equal(await stock(), 8);
      assert.equal(await client.inventoryLog.count({ where: { orderId } }), 1);
    });

    await t.test("PICKING from CREATED is rejected 409 with no change", async () => {
      const r = await create({ email: "customer@test.local", items: [{ sku: "SKU001", quantity: 1 }] });
      const { order } = await r.json();
      const before = await stock();
      const res = await patch(order.id, "PICKING");
      assert.equal(res.status, 409);
      assert.equal((await res.json()).error.code, "INVALID_STATE_TRANSITION");
      assert.equal((await client.order.findUniqueOrThrow({ where: { id: order.id } })).status, "CREATED");
      assert.equal(await stock(), before);
    });

    await t.test("shipment from PICKING: LG waybill + initial event, stock unchanged", async () => {
      const before = await stock();
      const r = await ship({ orderNumber, carrier: "顺丰速运" });
      assert.equal(r.status, 201);
      const data = await r.json();
      assert.match(data.shipment.trackingNumber, /^LG-\d{8}-\d{6}$/);
      assert.equal(data.shipment.carrier, "顺丰速运");
      assert.equal(data.shipment.status, "SHIPPED");
      assert.deepEqual(data.order, { id: orderId, orderNumber, status: "SHIPPED", totalCents: 300 });
      assert.equal((await client.order.findUniqueOrThrow({ where: { id: orderId } })).status, "SHIPPED");
      assert.equal(await stock(), before);
      assert.equal(await client.inventoryLog.count({ where: { orderId } }), 1);
      const shipment = await client.shipment.findUniqueOrThrow({ where: { orderId } });
      assert.equal(shipment.trackingNumber, data.shipment.trackingNumber);
      const events = await client.trackingEvent.findMany({ where: { shipmentId: shipment.id } });
      assert.equal(events.length, 1);
      assert.equal(events[0].location, "仓库");
    });

    await t.test("shipment from CONFIRMED is rejected; no waybill or event residue", async () => {
      const r = await create({ email: "customer@test.local", items: [{ sku: "SKU001", quantity: 1 }] });
      const { order } = await r.json();
      assert.equal((await patch(order.id, "CONFIRMED")).status, 200);
      const shipmentsBefore = await client.shipment.count();
      const eventsBefore = await client.trackingEvent.count();
      const res = await ship({ orderNumber: order.orderNumber, carrier: "顺丰" });
      assert.equal(res.status, 409);
      assert.equal((await res.json()).error.code, "INVALID_STATE_TRANSITION");
      assert.equal(await client.shipment.count(), shipmentsBefore);
      assert.equal(await client.trackingEvent.count(), eventsBefore);
      assert.equal((await client.order.findUniqueOrThrow({ where: { id: order.id } })).status, "CONFIRMED");
    });

    await t.test("sequential duplicate shipment: 409 and still one waybill", async () => {
      const res = await ship({ orderNumber, carrier: "顺丰速运" });
      assert.equal(res.status, 409);
      assert.equal((await res.json()).error.code, "SHIPMENT_EXISTS");
      assert.equal(await client.shipment.count({ where: { orderId } }), 1);
      assert.equal(await client.trackingEvent.count({ where: { shipment: { orderId } } }), 1);
    });

    await t.test("concurrent duplicate shipment: exactly one waybill", async () => {
      const r = await create({ email: "customer@test.local", items: [{ sku: "SKU001", quantity: 1 }] });
      const { order } = await r.json();
      assert.equal((await patch(order.id, "CONFIRMED")).status, 200);
      assert.equal((await patch(order.id, "PICKING")).status, 200);
      const responses = await Promise.all([
        ship({ orderNumber: order.orderNumber, carrier: "A" }),
        ship({ orderNumber: order.orderNumber, carrier: "B" }),
      ]);
      const codes = responses.map(x => x.status).sort();
      assert.ok(codes.includes(201), `expected one 201, got ${codes}`);
      assert.equal(await client.shipment.count({ where: { orderId: order.id } }), 1);
      assert.equal(await client.trackingEvent.count({ where: { shipment: { orderId: order.id } } }), 1);
    });

    await t.test("missing identity / non-STAFF cannot update status or ship", async () => {
      const r = await create({ email: "customer@test.local", items: [{ sku: "SKU001", quantity: 1 }] });
      const { order } = await r.json();
      assert.equal((await patch(order.id, "CONFIRMED")).status, 200);
      const before = await client.order.findUniqueOrThrow({ where: { id: order.id } });
      for (const [to, email, code] of [
        ["PICKING", null, 401], ["PICKING", "customer@test.local", 403], ["PICKING", "admin@test.local", 403],
      ] as const) {
        const res = await patch(order.id, to, email);
        assert.equal(res.status, code);
      }
      for (const [email, code] of [[null, 401], ["customer@test.local", 403], ["admin@test.local", 403]] as const) {
        const res = await ship({ orderNumber: order.orderNumber, carrier: "顺丰" }, email);
        assert.equal(res.status, code);
      }
      const after = await client.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(after.status, "CONFIRMED");
      assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
      assert.equal(await client.shipment.count({ where: { orderId: order.id } }), 0);
    });

    await t.test("IN_TRANSIT -> DELIVERED: shipment + ordered events, stock unchanged", async () => {
      const before = await stock();
      assert.equal((await patch(orderId, "IN_TRANSIT")).status, 200);
      let shipment = await client.shipment.findUniqueOrThrow({ where: { orderId } });
      assert.equal(shipment.status, "IN_TRANSIT");
      assert.equal(await client.trackingEvent.count({ where: { shipmentId: shipment.id } }), 2);
      assert.equal((await patch(orderId, "DELIVERED")).status, 200);
      shipment = await client.shipment.findUniqueOrThrow({ where: { orderId } });
      assert.equal(shipment.status, "DELIVERED");
      assert.ok(shipment.deliveredAt);
      const events = await client.trackingEvent.findMany({ where: { shipmentId: shipment.id }, orderBy: { at: "asc" } });
      assert.equal(events.length, 3);
      const times = events.map(e => e.at.getTime());
      assert.deepEqual(times, [...times].sort((a, b) => a - b));
      assert.equal((await client.order.findUniqueOrThrow({ where: { id: orderId } })).status, "DELIVERED");
      assert.equal(await stock(), before);
      assert.equal(await client.inventoryLog.count({ where: { orderId } }), 1);
    });

    await t.test("tracking: correct association and order; wrong id leaks nothing", async () => {
      const r = await track(orderId);
      assert.equal(r.status, 200);
      const data = await r.json();
      assert.match(data.trackingNumber, /^LG-\d{8}-\d{6}$/);
      assert.equal(data.carrier, "顺丰速运");
      assert.equal(data.status, "DELIVERED");
      assert.equal(data.events.length, 3);
      assert.deepEqual(data.events.map((e: { location: string }) => e.location), ["仓库", "揽收网点", "收件地址"]);
      const times = data.events.map((e: { at: string }) => new Date(e.at).getTime());
      assert.deepEqual(times, [...times].sort((a: number, b: number) => a - b));

      const bad = await track("does-not-exist");
      assert.equal(bad.status, 404);
      const body = await bad.json();
      assert.equal(body.error.code, "ORDER_NOT_FOUND");
      assert.deepEqual(Object.keys(body), ["error"]);
      assert.equal(JSON.stringify(body).includes(orderNumber), false);
      assert.equal(JSON.stringify(body).includes(data.trackingNumber), false);

      const r2 = await create({ email: "customer@test.local", items: [{ sku: "SKU001", quantity: 1 }] });
      const { order: other } = await r2.json();
      const notShipped = await track(other.id);
      assert.equal(notShipped.status, 404);
      assert.equal((await notShipped.json()).error.code, "SHIPMENT_NOT_FOUND");
    });

    await t.test("PATCH to SHIPPED / CANCELLED is rejected without mutation", async () => {
      const r = await create({ email: "customer@test.local", items: [{ sku: "SKU001", quantity: 1 }] });
      const { order } = await r.json();
      assert.equal((await patch(order.id, "CONFIRMED")).status, 200);
      const stockBefore = await stock();
      const shipped = await patch(order.id, "SHIPPED");
      assert.equal(shipped.status, 400);
      assert.equal((await shipped.json()).error.code, "INVALID_ARGUMENT");
      const cancelled = await patch(order.id, "CANCELLED");
      assert.equal(cancelled.status, 400);
      assert.equal((await cancelled.json()).error.code, "INVALID_ARGUMENT");
      assert.equal((await client.order.findUniqueOrThrow({ where: { id: order.id } })).status, "CONFIRMED");
      assert.equal(await stock(), stockBefore);
      assert.equal(await client.shipment.count({ where: { orderId: order.id } }), 0);
    });
  } finally {
    if (db) await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
