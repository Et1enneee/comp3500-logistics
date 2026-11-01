import { test } from "node:test";
import assert from "node:assert/strict";
import { apiRequest, createTestDatabase, createUsers, expectApiError } from "./harness";
import { computeOverview, createReportHandlers, csvCell, resolveRangeOrThrow } from "../lib/reports-api";
import { addDaysToDateString, formatGmt8, gmt8DayStartUtc, todayGmt8 } from "../lib/time";
import { gmt8DateString } from "../lib/time";

test("ADMIN reports & CSV / real isolated SQLite", { timeout: 180000 }, async t => {
  const { db, dispose } = await createTestDatabase("reports");
  try {
    const users = await createUsers(db);
    const handlers = createReportHandlers(db);
    const product = await db.product.create({ data: { sku: "SKU001", name: "Water", priceCents: 100, stock: 1000, lowStockThreshold: 5 } });
    let serial = 0;

    /** 直接写订单并指定 createdAt，用于精确核对 GMT+8 分日边界。 */
    async function insertOrder(options: {
      status: string; totalCents: number; createdAt: Date; customerId?: string; orderNumber?: string;
    }) {
      const orderNumber = options.orderNumber ?? `ORD-R-${++serial}`;
      return db.order.create({
        data: {
          orderNumber,
          customerId: options.customerId ?? users.customerA.id,
          status: options.status as "CREATED",
          totalCents: options.totalCents,
          createdAt: options.createdAt,
          updatedAt: options.createdAt,
          items: { create: [{ productId: product.id, quantity: 1, unitPriceCents: options.totalCents }] },
        },
      });
    }

    // GMT+8 2026-03-01 00:00 = 2026-02-28T16:00:00Z
    const dayStart = gmt8DayStartUtc(2026, 3, 1);
    const lastMoment = new Date(gmt8DayStartUtc(2026, 3, 2).getTime() - 1); // 2026-03-01 23:59:59.999 GMT+8
    const nextDayStart = gmt8DayStartUtc(2026, 3, 2);

    await insertOrder({ status: "DELIVERED", totalCents: 1000, createdAt: dayStart, orderNumber: "ORD-R-0001" });
    await insertOrder({ status: "CANCELLED", totalCents: 5000, createdAt: new Date(dayStart.getTime() + 3600_000), orderNumber: "ORD-R-0002" });
    await insertOrder({ status: "CONFIRMED", totalCents: 250, createdAt: lastMoment, orderNumber: "ORD-R-0003" });

    await t.test("range parses to GMT+8 day boundaries (start inclusive, next-day exclusive)", async () => {
      const range = resolveRangeOrThrow("2026-03-01", "2026-03-01");
      assert.equal(range.startUtc.toISOString(), "2026-02-28T16:00:00.000Z");
      assert.equal(range.endUtc.toISOString(), "2026-03-01T16:00:00.000Z");
      assert.equal(formatGmt8(dayStart), "2026-03-01 00:00:00");
      assert.equal(gmt8DateString(new Date(nextDayStart.getTime() - 1)), "2026-03-01");
      assert.equal(gmt8DateString(nextDayStart), "2026-03-02");
      assert.equal(addDaysToDateString("2026-02-28", 1), "2026-03-01");
    });

    await t.test("exact aggregation: cancelled excluded from amount but counted in status", async () => {
      const report = await computeOverview(db, resolveRangeOrThrow("2026-03-01", "2026-03-01"));
      assert.equal(report.orders.count, 3);
      assert.equal(report.orders.byStatus.DELIVERED, 1);
      assert.equal(report.orders.byStatus.CANCELLED, 1);
      assert.equal(report.orders.byStatus.CONFIRMED, 1);
      assert.equal(report.orders.deliveredAmountCents, 1000);
      assert.equal(report.orders.nonCancelledAmountCents, 1250);
    });

    await t.test("orders before first boundary or at next-day 00:00 are excluded", async () => {
      const justBefore = new Date(dayStart.getTime() - 1);
      await insertOrder({ status: "CREATED", totalCents: 700, createdAt: justBefore, orderNumber: "ORD-R-BEFORE" });
      await insertOrder({ status: "CREATED", totalCents: 800, createdAt: nextDayStart, orderNumber: "ORD-R-NEXT" });
      const report = await computeOverview(db, resolveRangeOrThrow("2026-03-01", "2026-03-01"));
      assert.equal(report.orders.count, 3);
      assert.equal(report.orders.nonCancelledAmountCents, 1250);
    });

    await t.test("zero-data day returns zeros, not errors", async () => {
      const report = await computeOverview(db, resolveRangeOrThrow("2026-05-01", "2026-05-02"));
      assert.equal(report.orders.count, 0);
      assert.equal(report.orders.deliveredAmountCents, 0);
      assert.equal(report.orders.nonCancelledAmountCents, 0);
      assert.deepEqual(report.daily.map(day => day.count), [0, 0]);
    });

    await t.test("multi-day range fills zero days and sums per day", async () => {
      const report = await computeOverview(db, resolveRangeOrThrow("2026-02-28", "2026-03-02"));
      assert.deepEqual(report.daily.map(day => day.date), ["2026-02-28", "2026-03-01", "2026-03-02"]);
      // 2026-02-28 23:59:59.999 GMT+8 的边界样本应归入 02-28（前一个测试插入）
      assert.equal(report.daily[0].count, 1);
      assert.equal(report.daily[1].count, 3);
      assert.equal(report.daily[1].cancelledCount, 1);
      assert.equal(report.daily[2].count, 1);
    });

    await t.test("long range includes its final day and daily counts reconcile with totals", async () => {
      await insertOrder({ status: "DELIVERED", totalCents: 700, createdAt: gmt8DayStartUtc(2026, 10, 30), orderNumber: "ORD-R-LONG" });
      const report = await computeOverview(db, resolveRangeOrThrow("2025-01-01", "2026-10-30"));
      assert.equal(report.daily.length, 668);
      assert.equal(report.daily.at(-1)?.date, "2026-10-30");
      assert.equal(report.daily.at(-1)?.count, 1);
      assert.equal(report.daily.reduce((sum, day) => sum + day.count, 0), report.orders.count);
      assert.equal(report.daily.reduce((sum, day) => sum + day.cancelledCount, 0), report.orders.byStatus.CANCELLED);
    });

    await t.test("amount snapshot: later price changes do not alter report", async () => {
      const snapshotOrder = await insertOrder({
        status: "DELIVERED", totalCents: 300, createdAt: gmt8DayStartUtc(2026, 3, 3), orderNumber: "ORD-R-SNAP",
      });
      await db.product.update({ where: { id: product.id }, data: { priceCents: 999 } });
      const report = await computeOverview(db, resolveRangeOrThrow("2026-03-03", "2026-03-03"));
      assert.equal(report.orders.deliveredAmountCents, 300);
      const item = await db.orderItem.findFirstOrThrow({ where: { orderId: snapshotOrder.id } });
      assert.equal(item.unitPriceCents, 300);
    });

    await t.test("inventory metric is current snapshot, independent of date filter", async () => {
      await db.product.create({ data: { sku: "SKU-LOW", name: "Low", priceCents: 100, stock: 1, lowStockThreshold: 5 } });
      const one = await computeOverview(db, resolveRangeOrThrow("2026-03-01", "2026-03-01"));
      const two = await computeOverview(db, resolveRangeOrThrow("2025-01-01", "2025-01-01"));
      assert.equal(one.inventory.lowStockSkuCount, 1);
      assert.equal(two.inventory.lowStockSkuCount, 1);
      assert.match(one.inventory.note, /不随订单日期过滤/);
    });

    await t.test("pagination of order lists does not change report totals", async () => {
      const base = gmt8DayStartUtc(2026, 4, 1);
      for (let index = 0; index < 25; index++) {
        await insertOrder({ status: "CREATED", totalCents: 100, createdAt: new Date(base.getTime() + index * 60_000) });
      }
      const report = await computeOverview(db, resolveRangeOrThrow("2026-04-01", "2026-04-01"));
      assert.equal(report.orders.count, 25);
      assert.equal(report.orders.nonCancelledAmountCents, 2500);
      const { queryOrderList } = await import("../lib/order-api");
      const staffActor = { id: users.staff.id, role: "STAFF" as const };
      const page1 = await queryOrderList(db, staffActor, { page: 1, pageSize: 10 });
      const page3 = await queryOrderList(db, staffActor, { page: 3, pageSize: 10 });
      assert.equal(page1.total, page3.total);
    });

    await t.test("range validation: bad format and inverted range => 400", async () => {
      const overview = (query: string) => handlers.overview(
        apiRequest("http://localhost/api/v1/reports/overview" + query, { session: users.admin.session }),
      );
      await expectApiError(await overview("?from=2026-13-01&to=2026-03-01"), 400, "INVALID_ARGUMENT");
      await expectApiError(await overview("?from=2026-03-05&to=2026-03-01"), 400, "INVALID_ARGUMENT");
      await expectApiError(await overview("?from=not-a-date"), 400, "INVALID_ARGUMENT");
    });

    await t.test("CUSTOMER and STAFF cannot access reports or CSV (403)", async () => {
      for (const session of [users.customerA.session, users.staff.session]) {
        await expectApiError(await handlers.overview(apiRequest("http://localhost/api/v1/reports/overview", { session })), 403, "FORBIDDEN");
        await expectApiError(await handlers.exportCsv(apiRequest("http://localhost/api/v1/reports/export.csv", { session })), 403, "FORBIDDEN");
      }
      await expectApiError(await handlers.overview(apiRequest("http://localhost/api/v1/reports/overview")), 401, "UNAUTHENTICATED");
    });

    await t.test("CSV matches filter, has explicit columns and no personal data", async () => {
      const response = await handlers.exportCsv(apiRequest(
        "http://localhost/api/v1/reports/export.csv?from=2026-03-01&to=2026-03-01",
        { session: users.admin.session },
      ));
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
      assert.match(response.headers.get("content-disposition") ?? "", /attachment/);
      const bytes = new Uint8Array(await response.clone().arrayBuffer());
      assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "Excel 需要 UTF-8 BOM");
      const text = await response.text();
      const lines = text.replace(/^\uFEFF/, "").trim().split("\r\n");
      assert.equal(lines[0], "orderNumber,createdAtGmt8,timezone,status,statusLabel,totalCents,totalYuan");
      assert.equal(lines.length, 4, "表头 + 3 张订单");
      assert.ok(text.includes("ORD-R-0001,2026-03-01 00:00:00,GMT+8,DELIVERED,已签收,1000,10.00"));
      assert.equal(text.includes(users.customerA.email), false);
      assert.equal(text.includes("customer"), false);
      assert.equal(text.toLowerCase().includes("password"), false);
      assert.equal(text.includes("ORD-R-BEFORE"), false);
    });

    await t.test("CSV formula injection is neutralised", async () => {
      assert.equal(csvCell("=SUM(A1:A2)"), "'=SUM(A1:A2)");
      assert.equal(csvCell("+1"), "'+1");
      assert.equal(csvCell("-1"), "'-1");
      assert.equal(csvCell("@cmd"), "'@cmd");
      assert.equal(csvCell("plain"), "plain");
      assert.equal(csvCell('has,comma"quote'), '"has,comma""quote"');
    });

    await t.test("default range is the last 7 GMT+8 natural days including today", async () => {
      const today = todayGmt8();
      const response = await handlers.overview(apiRequest("http://localhost/api/v1/reports/overview", { session: users.admin.session }));
      const data = await response.json();
      assert.equal(data.range.to, today);
      assert.equal(data.range.from, addDaysToDateString(today, -6));
      assert.equal(data.daily.length, 7);
      assert.equal(data.range.timezone, "GMT+8");
    });
  } finally {
    await dispose();
  }
});
