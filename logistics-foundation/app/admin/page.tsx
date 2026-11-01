import Link from "next/link";
import { requirePageRole } from "@/lib/page-auth";
import { computeOverview } from "@/lib/reports-api";
import { parsePageQuery, parseReportParams, type PageQuery } from "@/lib/query-params";
import { prisma } from "@/lib/prisma";
import { Forbidden, InvalidQuery } from "@/components/ui";
import { money } from "@/lib/catalog";
import { STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { todayGmt8, addDaysToDateString, TIMEZONE_LABEL } from "@/lib/time";

export const dynamic = "force-dynamic";

const STATUS_ORDER: OrderStatus[] = ["CREATED", "CONFIRMED", "PICKING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED"];

export default async function AdminPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const session = await requirePageRole(["ADMIN"]);
  if (!session) return <Forbidden detail="运营报表仅对管理员开放；客户与员工无权访问。" />;
  const query = await searchParams;
  const resolved = parsePageQuery(query, parseReportParams);
  if (!resolved.ok) return <InvalidQuery message={resolved.message} basePath="/admin" query={query} fields={["from", "to"]} />;
  const range = resolved.value;
  const report = range ? await computeOverview(prisma, range) : null;
  const defaultFrom = addDaysToDateString(todayGmt8(), -6);
  const exportHref = range ? `/api/v1/reports/export.csv?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : null;
  const maxDaily = report?.daily.reduce((max, day) => Math.max(max, day.count), 1) ?? 1;

  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">ADMIN / 运营报表（只读）</p>
        <h1>订单与库存概览</h1>
        <p className="subtitle">
          默认最近 7 个自然日；按订单 createdAt 归属 {TIMEZONE_LABEL} 自然日，起始日 00:00 含、结束日次日 00:00 不含。
          金额为订单金额（本项目没有支付，不称“已收款收入”）。
        </p>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="toolbar">
          <form className="filters" method="get" action="/admin">
            <div className="field"><label htmlFor="from">起始日期 ({TIMEZONE_LABEL})</label><input id="from" name="from" type="date" defaultValue={range.from} /></div>
            <div className="field"><label htmlFor="to">结束日期 ({TIMEZONE_LABEL})</label><input id="to" name="to" type="date" defaultValue={range.to} /></div>
            <button className="primary" type="submit">应用筛选</button>
          </form>
          <div className="inline-actions">
            <Link className="button" href={`/admin?from=${defaultFrom}&to=${todayGmt8()}`}>最近 7 天</Link>
            {exportHref && <a className="button" href={exportHref} download>导出当前筛选 CSV</a>}
          </div>
        </div>
        <div className="card-body">
          {range && <p className="small muted" style={{ margin: 0 }} data-testid="report-range">
            统计区间 {range.from} 至 {range.to}（{TIMEZONE_LABEL}）· UTC 边界 {range.startUtc.toISOString()} → {range.endUtc.toISOString()}（不含）
          </p>}
        </div>
      </section>

      {report && <><section className="grid-4" style={{ marginBottom: 24 }}>
        <dl className="stat" data-testid="stat-orders">
          <dt>订单数</dt>
          <dd>{report.orders.count}<span className="unit">当前区间内创建</span></dd>
        </dl>
        <dl className="stat" data-testid="stat-delivered-amount">
          <dt>已签收订单金额</dt>
          <dd>{money(report.orders.deliveredAmountCents)}<span className="unit">仅 DELIVERED，按订单金额</span></dd>
        </dl>
        <dl className="stat" data-testid="stat-noncancelled-amount">
          <dt>非取消订单金额</dt>
          <dd>{money(report.orders.nonCancelledAmountCents)}<span className="unit">排除 CANCELLED</span></dd>
        </dl>
        <dl className="stat" data-testid="stat-low-stock">
          <dt>当前低库存 SKU</dt>
          <dd>{report.inventory.lowStockSkuCount}<span className="unit">{report.inventory.note}</span></dd>
        </dl>
      </section>

      <div className="stack">
        <section className="card">
          <div className="card-head"><h2>状态分布</h2><span className="small muted">真实数据库聚合</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">状态</th><th scope="col" className="num">订单数</th><th scope="col">占比</th></tr></thead>
              <tbody>
                {STATUS_ORDER.map(status => {
                  const count = report.orders.byStatus[status] ?? 0;
                  const percent = report.orders.count === 0 ? 0 : Math.round((count / report.orders.count) * 1000) / 10;
                  return (
                    <tr key={status}>
                      <td>{STATUS_LABEL[status]} <span className="sku mono">{status}</span></td>
                      <td className="num">{count}</td>
                      <td>
                        <div className="inline-actions" style={{ gap: 8 }}>
                          <div className="bar-track" style={{ width: 160 }}><div className="bar-fill" style={{ width: `${percent}%` }} /></div>
                          <span className="small muted">{percent}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>每日订单趋势（{TIMEZONE_LABEL}）</h2><span className="small muted">零订单日也显示为 0</span></div>
          <div className="table-wrap">
            <table data-testid="report-daily">
              <thead><tr><th scope="col">日期</th><th scope="col" className="num">订单数</th><th scope="col" className="num">其中取消</th><th scope="col">趋势</th></tr></thead>
              <tbody>
                {report.daily.map(day => (
                  <tr key={day.date}>
                    <td className="mono">{day.date}</td>
                    <td className="num">{day.count}</td>
                    <td className="num">{day.cancelledCount}</td>
                    <td><div className="bar-track" style={{ width: "100%", maxWidth: 260 }}><div className="bar-fill" style={{ width: `${Math.round((day.count / maxDaily) * 100)}%` }} /></div></td>
                  </tr>
                ))}
                {report.daily.length === 0 && <tr><td colSpan={4}>区间内没有数据。</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="card-body" style={{ borderTop: "1px solid var(--line)" }}>
            <p className="hint" style={{ margin: 0 }}>
              CSV 与当前筛选一致：列为 orderNumber、createdAtGmt8、timezone、status、statusLabel、totalCents、totalYuan；不含任何个人联系方式或密码。
            </p>
          </div>
        </section>
      </div></>}
    </main>
  );
}
