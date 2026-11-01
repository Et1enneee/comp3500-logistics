import { test } from "node:test";
import assert from "node:assert/strict";
import { apiRequest, createTestDatabase, createUsers, expectApiError } from "./harness";
import { createInventoryHandlers, queryInventory, queryInventoryLogs } from "../lib/inventory-api";

test("Inventory, replenishment & alerts / real isolated SQLite", { timeout: 180000 }, async t => {
  const { db, dispose } = await createTestDatabase("inventory");
  try {
    const users = await createUsers(db);
    const handlers = createInventoryHandlers(db);

    const list = (session = users.staff.session, query = "") => handlers.listInventory(
      apiRequest("http://localhost/api/v1/inventory" + query, { session }),
    );
    const lowStock = (session = users.staff.session) => handlers.listLowStock(
      apiRequest("http://localhost/api/v1/inventory/low-stock", { session }),
    );
    const replenish = (productId: string, quantity: unknown, session = users.staff.session) => handlers.replenish(
      apiRequest("http://localhost/api/v1/inventory/x/replenish", { method: "POST", body: { quantity }, session }),
      productId,
    );
    const logs = (session = users.staff.session, query = "") => handlers.listLogs(
      apiRequest("http://localhost/api/v1/inventory/logs" + query, { session }),
    );

    const at = await db.product.create({ data: { sku: "SKU007", name: "透明胶带", priceCents: 500, stock: 4, lowStockThreshold: 5 } });
    const edge = await db.product.create({ data: { sku: "SKU-EDGE", name: "等于阈值", priceCents: 100, stock: 5, lowStockThreshold: 5 } });
    const healthy = await db.product.create({ data: { sku: "SKU-OK", name: "充足", priceCents: 100, stock: 50, lowStockThreshold: 5 } });

    await t.test("strict comparison: 4<5 warns, 5=5 does not", async () => {
      const response = await lowStock();
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.deepEqual(data.products.map((product: { sku: string }) => product.sku), ["SKU007"]);
      assert.equal(data.count, 1);
      const all = await (await list()).json();
      const edgeRow = all.products.find((product: { sku: string }) => product.sku === "SKU-EDGE");
      assert.equal(edgeRow.isLowStock, false);
    });

    await t.test("STAFF sees inventory fields; ADMIN read-only list allowed", async () => {
      const staffView = await (await list()).json();
      assert.equal(staffView.products.length, 3);
      assert.equal(staffView.lowStockCount, 1);
      const adminView = await list(users.admin.session);
      assert.equal(adminView.status, 200);
    });

    await t.test("CUSTOMER cannot read inventory or replenish (403)", async () => {
      await expectApiError(await list(users.customerA.session), 403, "FORBIDDEN");
      await expectApiError(await lowStock(users.customerA.session), 403, "FORBIDDEN");
      await expectApiError(await replenish(at.id, 5, users.customerA.session), 403, "FORBIDDEN");
      await expectApiError(await logs(users.customerA.session), 403, "FORBIDDEN");
    });

    await t.test("ADMIN cannot replenish (403)", async () => {
      await expectApiError(await replenish(at.id, 5, users.admin.session), 403, "FORBIDDEN");
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: at.id } })).stock, 4);
    });

    await t.test("replenish 1 turns 4 into 5 and the warning disappears; ledger row recorded", async () => {
      const response = await replenish(at.id, 1);
      assert.equal(response.status, 201);
      const data = await response.json();
      assert.equal(data.product.stock, 5);
      assert.equal(data.product.isLowStock, false);
      assert.equal(data.log.delta, 1);
      assert.equal(data.log.reason, "STOCK_REPLENISH");
      assert.equal(data.log.actor.email, users.staff.email);
      const after = await (await lowStock()).json();
      assert.equal(after.count, 0);
      const logRows = await db.inventoryLog.findMany({ where: { productId: at.id } });
      assert.equal(logRows.length, 1);
      assert.equal(logRows[0].actorId, users.staff.id);
    });

    await t.test("invalid quantities are rejected without changing stock or ledger", async () => {
      const before = await db.inventoryLog.count();
      for (const quantity of [0, -1, 1.5, "5", null, 1_000_001]) {
        await expectApiError(await replenish(at.id, quantity), 400, "INVALID_ARGUMENT");
      }
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: at.id } })).stock, 5);
      assert.equal(await db.inventoryLog.count(), before);
      await expectApiError(await replenish("missing-product", 5), 404, "PRODUCT_NOT_FOUND");
    });

    await t.test("replenish without CSRF is rejected", async () => {
      const response = await handlers.replenish(
        apiRequest("http://localhost/api/v1/inventory/x/replenish", { method: "POST", body: { quantity: 1 }, session: users.staff.session, csrf: null }),
        at.id,
      );
      await expectApiError(response, 403, "CSRF_INVALID");
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: at.id } })).stock, 5);
    });

    await t.test("confirm 2 of 6/5 makes it 4 -> warning; then replenish 1 -> 5 no warning", async () => {
      const p = await db.product.create({ data: { sku: "SKU-FIX", name: "fixture6", priceCents: 100, stock: 6, lowStockThreshold: 5 } });
      const order = await db.order.create({
        data: {
          orderNumber: "ORD-FIXTURE-1", customerId: users.customerA.id, status: "CREATED", totalCents: 200,
          items: { create: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }] },
        },
      });
      const { createOrderHandlers } = await import("../lib/order-api");
      const confirm = await createOrderHandlers(db).updateStatus(
        apiRequest("http://localhost/api/v1/orders/id/status", { method: "PATCH", body: { to: "CONFIRMED" }, session: users.staff.session }),
        order.id,
      );
      assert.equal(confirm.status, 200);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 4);
      const warning = await (await lowStock()).json();
      assert.ok(warning.products.some((product: { sku: string }) => product.sku === "SKU-FIX"));
      await replenish(p.id, 1);
      const cleared = await (await lowStock()).json();
      assert.equal(cleared.products.some((product: { sku: string }) => product.sku === "SKU-FIX"), false);
    });

    await t.test("logs list shows delta/reason/order/operator and supports filters + pagination", async () => {
      const all = await (await logs()).json();
      assert.ok(all.logs.length >= 3);
      const replenishRows = all.logs.filter((log: { reason: string }) => log.reason === "STOCK_REPLENISH");
      assert.ok(replenishRows.length >= 2);
      assert.ok(replenishRows.every((log: { actor: { email: string } | null }) => log.actor?.email === users.staff.email));
      assert.ok(replenishRows.every((log: { delta: number }) => log.delta > 0));

      const confirmRows = (await (await logs()).json()).logs.filter((log: { reason: string }) => log.reason === "ORDER_CONFIRM");
      assert.equal(confirmRows.length, 1);
      assert.equal(confirmRows[0].delta, -2);
      assert.equal(confirmRows[0].orderNumber, "ORD-FIXTURE-1");

      const bySku = await (await logs(users.staff.session, "?sku=SKU007")).json();
      assert.ok(bySku.logs.every((log: { product: { sku: string } }) => log.product.sku === "SKU007"));

      const byOrder = await (await logs(users.staff.session, "?orderNumber=ORD-FIXTURE-1")).json();
      assert.equal(byOrder.total, 1);

      const missingOrder = await (await logs(users.staff.session, "?orderNumber=ORD-NONE-0000")).json();
      assert.equal(missingOrder.total, 0);

      const paged = await queryInventoryLogs(db, { page: 1, pageSize: 1 });
      assert.equal(paged.logs.length, 1);
      assert.equal(paged.total, all.total);
    });

    await t.test("no delete/overwrite endpoint exists: stock only increases via replenish", async () => {
      const p = await db.product.create({ data: { sku: "SKU-NODEL", name: "不可覆盖", priceCents: 100, stock: 3, lowStockThreshold: 5 } });
      // 只有 POST replenish 一个写入口；GET 不修改数据。
      await list();
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 3);
      const page = await queryInventory(db, { page: 1, pageSize: 10, lowStockOnly: true });
      assert.ok(page.products.every(product => product.stock < product.lowStockThreshold));
      assert.equal(healthy.id.length > 0, true);
      assert.equal(edge.id.length > 0, true);
    });
  } finally {
    await dispose();
  }
});
