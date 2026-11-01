import { HttpError, parsePagination, queryValue } from "./http";
import { ORDER_STATUS, type OrderStatus } from "./constants";
import { resolveDateRange } from "./time";

export type PageQuery = Record<string, string | string[] | undefined>;

/** Next 页面数组参数保留为重复键，与 API 使用相同的校验。 */
export function parsePageQuery<T>(query: PageQuery, parse: (params: URLSearchParams) => T): { ok: true; value: T } | { ok: false; message: string } {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) for (const entry of value) params.append(key, entry);
    else if (value !== undefined) params.append(key, value);
  }
  try { return { ok: true, value: parse(params) }; }
  catch (error) {
    if (error instanceof HttpError && error.status === 400) return { ok: false, message: error.message };
    throw error;
  }
}

const text = (params: URLSearchParams, key: string) => queryValue(params, key)?.trim() || undefined;

function flag(params: URLSearchParams, key: string) {
  const value = queryValue(params, key);
  if (value !== null && !["", "0", "1"].includes(value)) throw new HttpError(400, "INVALID_ARGUMENT", `参数 ${key} 须为 0 或 1`);
  return value === "1";
}

export function parseOrderParams(params: URLSearchParams) {
  const pagination = parsePagination(params);
  const status = queryValue(params, "status") || undefined;
  if (status && !Object.hasOwn(ORDER_STATUS, status)) throw new HttpError(400, "INVALID_ARGUMENT", "状态筛选值不合法");
  return { ...pagination, status: status as OrderStatus | undefined, orderNumber: text(params, "orderNumber") };
}

export function parseInventoryParams(params: URLSearchParams) {
  return { ...parsePagination(params, 20), lowStockOnly: flag(params, "lowStock"), sku: text(params, "sku") };
}

export function parseInventoryLogParams(params: URLSearchParams, pageKey = "page") {
  return { ...parsePagination(params, 20, pageKey), sku: text(params, "sku"), orderNumber: text(params, "orderNumber") };
}

export function parseInventoryPageParams(params: URLSearchParams) {
  // 页面在同一地址展示库存与流水，流水使用 logPage/logSku。
  const logParams = new URLSearchParams(params);
  logParams.delete("sku");
  const logSku = queryValue(params, "logSku");
  if (logSku !== null) logParams.set("sku", logSku);
  return { inventory: parseInventoryParams(params), logs: parseInventoryLogParams(logParams, "logPage") };
}

export function parseNotificationParams(params: URLSearchParams) {
  return { ...parsePagination(params), unreadOnly: flag(params, "unread") };
}

export function parseReportParams(params: URLSearchParams) {
  const result = resolveDateRange(queryValue(params, "from"), queryValue(params, "to"));
  if (!result.ok) throw new HttpError(400, "INVALID_ARGUMENT", result.message);
  return result.range;
}
