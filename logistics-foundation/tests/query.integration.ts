import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePagination } from "../lib/http";
import { parseInventoryPageParams, parseNotificationParams, parseOrderParams, parsePageQuery, parseReportParams } from "../lib/query-params";
import { apiRequest, createTestDatabase, createUsers, expectApiError } from "./harness";
import { createOrderHandlers } from "../lib/order-api";
import { createInventoryHandlers } from "../lib/inventory-api";
import { createNotificationHandlers } from "../lib/notifications-api";
import { createReportHandlers } from "../lib/reports-api";

describe("共享分页参数", () => {
  it("缺省与合法整数保持原口径", () => {
    assert.deepEqual(parsePagination(new URLSearchParams()), { page: 1, pageSize: 10, skip: 0 });
    assert.deepEqual(parsePagination(new URLSearchParams("page=2&pageSize=20")), { page: 2, pageSize: 20, skip: 20 });
  });
  for (const page of ["1.5", "1.0", "1e2", "0x10", "Infinity", "0", "-1", "", "9007199254740992", "2147483648"]) {
    it("拒绝非法或超界页码 " + page, () => {
      assert.throws(() => parsePagination(new URLSearchParams({ page })));
    });
  }
  it("拒绝重复分页参数和小数每页条数", () => {
    assert.throws(() => parsePagination(new URLSearchParams("page=1&page=2")));
    assert.throws(() => parsePagination(new URLSearchParams("pageSize=2.5")));
  });
});

describe("页面/API 共用参数解析", () => {
  it("非法状态、小数、重复参数在页面返回可恢复错误", () => {
    for (const query of [{ status: "INVALID" }, { status: ["CREATED", "CONFIRMED"] }, { page: "1.5" }, { page: ["1", "2"] }]) {
      assert.equal(parsePageQuery(query, parseOrderParams).ok, false);
    }
    assert.equal(parsePageQuery({ logPage: "1.5" }, parseInventoryPageParams).ok, false);
    assert.equal(parsePageQuery({ logSku: ["SKU001", "SKU002"] }, parseInventoryPageParams).ok, false);
    assert.equal(parsePageQuery({ unread: ["1", "0"] }, parseNotificationParams).ok, false);
    assert.equal(parsePageQuery({ from: ["2026-10-01", "2026-10-02"] }, parseReportParams).ok, false);
  });
  it("合法筛选结果与直接 API 解析一致，库存和流水保留独立参数", () => {
    assert.deepEqual(parsePageQuery({ page: "2", status: "CREATED" }, parseOrderParams), { ok: true, value: parseOrderParams(new URLSearchParams("page=2&status=CREATED")) });
    const result = parsePageQuery({ page: "2", logPage: "3", sku: "SKU001", logSku: "SKU007" }, parseInventoryPageParams);
    assert.ok(result.ok);
    assert.equal(result.value.inventory.page, 2);
    assert.equal(result.value.inventory.sku, "SKU001");
    assert.equal(result.value.logs.page, 3);
    assert.equal(result.value.logs.sku, "SKU007");
  });
  it("仅把用户参数错误转换为反馈，意外错误继续抛出", () => {
    assert.throws(() => parsePageQuery({}, () => { throw new Error("unexpected"); }), /unexpected/);
  });
});

it("invalid query parameters consistently produce API 400, preserving role checks", { timeout: 180000 }, async () => {
  const { db, dispose } = await createTestDatabase("query-validation");
  try {
    const users = await createUsers(db);
    const orders = createOrderHandlers(db);
    const inventory = createInventoryHandlers(db);
    const notifications = createNotificationHandlers(db);
    const reports = createReportHandlers(db);
    for (const page of ["1.5", "1.0", "1e2", "0x10", "Infinity", "2147483648", ""]) {
      const query = "?page=" + page;
      await expectApiError(await orders.listOrders(apiRequest("http://localhost/api/v1/orders" + query, { session: users.customerA.session })), 400, "INVALID_ARGUMENT");
      await expectApiError(await inventory.listInventory(apiRequest("http://localhost/api/v1/inventory" + query, { session: users.staff.session })), 400, "INVALID_ARGUMENT");
      await expectApiError(await inventory.listLogs(apiRequest("http://localhost/api/v1/inventory/logs" + query, { session: users.staff.session })), 400, "INVALID_ARGUMENT");
      await expectApiError(await notifications.list(apiRequest("http://localhost/api/v1/notifications" + query, { session: users.customerA.session })), 400, "INVALID_ARGUMENT");
    }
    for (const query of ["?status=INVALID", "?status=__proto__", "?status=CREATED&status=CONFIRMED", "?page=1&page=2"]) {
      await expectApiError(await orders.listOrders(apiRequest("http://localhost/api/v1/orders" + query, { session: users.customerA.session })), 400, "INVALID_ARGUMENT");
    }
    await expectApiError(await reports.overview(apiRequest("http://localhost/api/v1/reports/overview?from=2026-10-01&from=2026-10-02", { session: users.admin.session })), 400, "INVALID_ARGUMENT");
    await expectApiError(await reports.exportCsv(apiRequest("http://localhost/api/v1/reports/export.csv?from=2026-10-01&from=2026-10-02", { session: users.admin.session })), 400, "INVALID_ARGUMENT");
    await expectApiError(await orders.listOrders(apiRequest("http://localhost/api/v1/orders?status=INVALID", { session: users.admin.session })), 403, "FORBIDDEN");
    await expectApiError(await inventory.listInventory(apiRequest("http://localhost/api/v1/inventory?page=1.5", { session: users.customerA.session })), 403, "FORBIDDEN");
  } finally { await dispose(); }
});
