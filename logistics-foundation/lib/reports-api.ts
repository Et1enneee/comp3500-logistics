import type { PrismaClient } from "@prisma/client";
import { failure, requireSession } from "@/lib/http";
import { eachDateInRange, formatGmt8, gmt8DateString, TIMEZONE_LABEL } from "@/lib/time";
import { parseReportParams } from "@/lib/query-params";
import { STATUS_LABEL, type OrderStatus } from "@/lib/constants";

const STATUS_ORDER: OrderStatus[] = [
  "CREATED", "CONFIRMED", "PICKING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED",
];

export interface ReportOverview {
  range: { from: string; to: string; timezone: string; startUtc: string; endUtcExclusive: string };
  orders: {
    count: number;
    byStatus: Record<string, number>;
    nonCancelledAmountCents: number;
    deliveredAmountCents: number;
  };
  inventory: { lowStockSkuCount: number; note: string; timezone: string };
  daily: { date: string; count: number; cancelledCount: number }[];
}

export interface ReportRange {
  from: string;
  to: string;
  startUtc: Date;
  endUtc: Date;
}

/**
 * ADMIN 运营看板（P1-B）：全部来自数据库聚合。
 * 口径：按订单 createdAt 归属 GMT+8 自然日；起始含、结束日次日 00:00 不含。
 * 金额只称“订单金额”，本项目没有支付，不能叫“已收款”。
 */
export async function computeOverview(db: PrismaClient, range: ReportRange): Promise<ReportOverview> {
  const orders = await db.order.findMany({
    where: { createdAt: { gte: range.startUtc, lt: range.endUtc } },
    select: { orderNumber: true, status: true, totalCents: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { orderNumber: "asc" }],
  });
  const byStatus = Object.fromEntries(STATUS_ORDER.map(status => [status, 0])) as Record<string, number>;
  let nonCancelledAmountCents = 0;
  let deliveredAmountCents = 0;
  for (const order of orders) {
    byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
    if (order.status !== "CANCELLED") nonCancelledAmountCents += order.totalCents;
    if (order.status === "DELIVERED") deliveredAmountCents += order.totalCents;
  }
  const perDay = new Map<string, { count: number; cancelledCount: number }>();
  for (const date of eachDateInRange(range.from, range.to)) perDay.set(date, { count: 0, cancelledCount: 0 });
  for (const order of orders) {
    const bucket = perDay.get(gmt8DateString(order.createdAt));
    if (!bucket) continue;
    bucket.count += 1;
    if (order.status === "CANCELLED") bucket.cancelledCount += 1;
  }
  const products = await db.product.findMany({ select: { stock: true, lowStockThreshold: true } });
  return {
    range: {
      from: range.from,
      to: range.to,
      timezone: TIMEZONE_LABEL,
      startUtc: range.startUtc.toISOString(),
      endUtcExclusive: range.endUtc.toISOString(),
    },
    orders: { count: orders.length, byStatus, nonCancelledAmountCents, deliveredAmountCents },
    inventory: {
      lowStockSkuCount: products.filter(product => product.stock < product.lowStockThreshold).length,
      note: "当前库存快照，不随订单日期过滤",
      timezone: TIMEZONE_LABEL,
    },
    daily: [...perDay.entries()].map(([date, value]) => ({ date, ...value })),
  };
}

export function resolveRangeOrThrow(from: string | null, to: string | null): ReportRange {
  const params = new URLSearchParams();
  if (from !== null) params.set("from", from);
  if (to !== null) params.set("to", to);
  return parseReportParams(params);
}

/** CSV 单元格：转义引号并阻断 = + - @ 开头的公式注入。 */
export function csvCell(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  if (/[",\r\n]/.test(text)) text = '"' + text.replaceAll('"', '""') + '"';
  return text;
}

export function createReportHandlers(db: PrismaClient) {
  async function overview(req: Request): Promise<Response> {
    try {
      await requireSession(db, req, { roles: ["ADMIN"] });
      const url = new URL(req.url);
      const range = parseReportParams(url.searchParams);
      return Response.json(await computeOverview(db, range), { headers: { "cache-control": "no-store" } });
    } catch (error) {
      return failure(error, "Report overview unexpected failure");
    }
  }

  /** CSV 导出：与当前筛选一致；不含密码或多余个人资料。 */
  async function exportCsv(req: Request): Promise<Response> {
    try {
      await requireSession(db, req, { roles: ["ADMIN"] });
      const url = new URL(req.url);
      const range = parseReportParams(url.searchParams);
      const orders = await db.order.findMany({
        where: { createdAt: { gte: range.startUtc, lt: range.endUtc } },
        select: { orderNumber: true, status: true, totalCents: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { orderNumber: "asc" }],
      });
      const header = ["orderNumber", "createdAtGmt8", "timezone", "status", "statusLabel", "totalCents", "totalYuan"];
      const lines = [header.join(",")];
      for (const order of orders) {
        lines.push([
          order.orderNumber,
          formatGmt8(order.createdAt),
          TIMEZONE_LABEL,
          order.status,
          STATUS_LABEL[order.status as OrderStatus] ?? order.status,
          String(order.totalCents),
          (order.totalCents / 100).toFixed(2),
        ].map(csvCell).join(","));
      }
      return new Response("\uFEFF" + lines.join("\r\n") + "\r\n", {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="orders-${range.from}_${range.to}.csv"`,
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      return failure(error, "Report export unexpected failure");
    }
  }

  return { overview, exportCsv };
}
