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
  if (!session) return <Forbidden detail="Operations reports are open to administrators only; customers and staff have no access." />;
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
        <p className="eyebrow">ADMIN / Operations Reports (Read-only)</p>
        <h1>Orders &amp; Inventory Overview</h1>
        <p className="subtitle">
          Defaults to the last 7 calendar days; orders are attributed to {TIMEZONE_LABEL} calendar days by createdAt, with the start day&apos;s 00:00 inclusive and the day after the end date&apos;s 00:00 exclusive.
          Amounts are order amounts (this project has no payments, so they are not called &quot;collected revenue&quot;).
        </p>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="toolbar">
          <form className="filters" method="get" action="/admin">
            <div className="field"><label htmlFor="from">From date ({TIMEZONE_LABEL})</label><input id="from" name="from" type="date" defaultValue={range.from} /></div>
            <div className="field"><label htmlFor="to">To date ({TIMEZONE_LABEL})</label><input id="to" name="to" type="date" defaultValue={range.to} /></div>
            <button className="primary" type="submit">Apply Filters</button>
          </form>
          <div className="inline-actions">
            <Link className="button" href={`/admin?from=${defaultFrom}&to=${todayGmt8()}`}>Last 7 Days</Link>
            {exportHref && <a className="button" href={exportHref} download>Export Current Filter as CSV</a>}
          </div>
        </div>
        <div className="card-body">
          {range && <p className="small muted" style={{ margin: 0 }} data-testid="report-range">
            Report range {range.from} to {range.to} ({TIMEZONE_LABEL}) · UTC boundaries {range.startUtc.toISOString()} → {range.endUtc.toISOString()} (exclusive)
          </p>}
        </div>
      </section>

      {report && <><section className="grid-4" style={{ marginBottom: 24 }}>
        <dl className="stat" data-testid="stat-orders">
          <dt>Orders</dt>
          <dd>{report.orders.count}<span className="unit">created in the current range</span></dd>
        </dl>
        <dl className="stat" data-testid="stat-delivered-amount">
          <dt>Delivered Order Amount</dt>
          <dd>{money(report.orders.deliveredAmountCents)}<span className="unit">DELIVERED only, by order amount</span></dd>
        </dl>
        <dl className="stat" data-testid="stat-noncancelled-amount">
          <dt>Non-cancelled Order Amount</dt>
          <dd>{money(report.orders.nonCancelledAmountCents)}<span className="unit">excludes CANCELLED</span></dd>
        </dl>
        <dl className="stat" data-testid="stat-low-stock">
          <dt>Currently Low-stock SKUs</dt>
          <dd>{report.inventory.lowStockSkuCount}<span className="unit">{report.inventory.note}</span></dd>
        </dl>
      </section>

      <div className="stack">
        <section className="card">
          <div className="card-head"><h2>Status Distribution</h2><span className="small muted">aggregated from the live database</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Status</th><th scope="col" className="num">Orders</th><th scope="col">Share</th></tr></thead>
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
          <div className="card-head"><h2>Daily Order Trend ({TIMEZONE_LABEL})</h2><span className="small muted">zero-order days still show 0</span></div>
          <div className="table-wrap">
            <table data-testid="report-daily">
              <thead><tr><th scope="col">Date</th><th scope="col" className="num">Orders</th><th scope="col" className="num">Cancelled</th><th scope="col">Trend</th></tr></thead>
              <tbody>
                {report.daily.map(day => (
                  <tr key={day.date}>
                    <td className="mono">{day.date}</td>
                    <td className="num">{day.count}</td>
                    <td className="num">{day.cancelledCount}</td>
                    <td><div className="bar-track" style={{ width: "100%", maxWidth: 260 }}><div className="bar-fill" style={{ width: `${Math.round((day.count / maxDaily) * 100)}%` }} /></div></td>
                  </tr>
                ))}
                {report.daily.length === 0 && <tr><td colSpan={4}>No data in this range.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="card-body" style={{ borderTop: "1px solid var(--line)" }}>
            <p className="hint" style={{ margin: 0 }}>
              The CSV matches the current filter: columns are orderNumber, createdAtGmt8, timezone, status, statusLabel, totalCents, totalYuan; it contains no personal contact information or passwords.
            </p>
          </div>
        </section>
      </div></>}
    </main>
  );
}
