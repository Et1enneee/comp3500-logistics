import Link from "next/link";
import { requirePageRole } from "@/lib/page-auth";
import { queryOrderList } from "@/lib/order-api";
import { prisma } from "@/lib/prisma";
import { EmptyState, Forbidden, InvalidQuery, Money, Pager, StatusBadge, STATUS_FILTERS } from "@/components/ui";
import { parseOrderParams, parsePageQuery, type PageQuery } from "@/lib/query-params";
import { formatGmt8 } from "@/lib/time";
import type { OrderStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<PageQuery>;
}) {
  const session = await requirePageRole(["STAFF"]);
  if (!session) return <Forbidden detail="The Order Workbench is open to staff only; administrators use the read-only operations reports." />;
  const query = await searchParams;
  const parsed = parsePageQuery(query, parseOrderParams);
  if (!parsed.ok) return <InvalidQuery message={parsed.message} basePath="/staff" query={query} fields={["page", "pageSize", "status", "orderNumber"]} />;
  const { page, pageSize, orderNumber } = parsed.value;
  const status = parsed.value.status ?? "";

  // Keep the exact ORD lookup: a hit goes straight to the detail page (with the action panel).
  if (orderNumber) {
    const exact = await prisma.order.findUnique({
      where: { orderNumber: orderNumber },
      select: { id: true },
    });
    if (exact) {
      return (
        <main className="page">
          <div className="page-heading">
            <p className="eyebrow">STAFF / Order Workbench</p>
            <h1>Order Found</h1>
            <p className="subtitle">The exact ORD lookup matched; opening the details.</p>
          </div>
          <section className="card">
            <div className="card-body">
              <p>Order <span className="mono">{orderNumber}</span> exists.</p>
              <p><Link className="button primary" href={`/staff/orders/${exact.id}`}>Open Order Details →</Link></p>
            </div>
          </section>
        </main>
      );
    }
    return (
      <main className="page">
        <div className="page-heading"><p className="eyebrow">STAFF / Order Workbench</p><h1>Order Not Found</h1></div>
        <section className="card"><EmptyState title={`No order number ${orderNumber}`}>Please double-check the ORD order number, or go back to the queue and filter again.</EmptyState></section>
      </main>
    );
  }

  const result = await queryOrderList(prisma, session.user, { page, pageSize, status: status || undefined });
  const counts = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
  const countByStatus = new Map(counts.map(row => [row.status, row._count._all]));

  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">STAFF / Order Fulfillment</p>
        <h1>Order Workbench</h1>
        <p className="subtitle">Work the fulfillment queue by status. Confirmation, picking, shipping, simulated logistics, and cancellation are all independently validated on the server for status and role.</p>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-head"><h2>Exact Lookup by Order Number</h2><span className="small muted">Uses the ORD number</span></div>
        <div className="card-body">
          <form className="inline-form" method="get" action="/staff">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="order-number">Order number</label>
              <input id="order-number" name="orderNumber" placeholder="ORD-YYYYMMDD-XXXX" autoComplete="off" />
            </div>
            <button className="primary" type="submit">Find Order</button>
          </form>
          <p className="hint">You can also filter the queue below by status; awaiting confirmation: {countByStatus.get("CREATED") ?? 0}.</p>
        </div>
      </section>

      <section className="card">
        <div className="toolbar">
          <form className="filters" method="get" action="/staff">
            <div className="field">
              <label htmlFor="status-filter">Status filter</label>
              <select id="status-filter" name="status" defaultValue={status}>
                {STATUS_FILTERS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}{item.value ? ` (${countByStatus.get(item.value as OrderStatus) ?? 0})` : ` (${result.total})`}
                  </option>
                ))}
              </select>
            </div>
            <button className="primary" type="submit">Filter</button>
          </form>
          <span className="small muted">{result.total} orders total</span>
        </div>
        {result.orders.length === 0 ? (
          <EmptyState title="No orders under the current filter">Switch the status or use the exact order-number lookup.</EmptyState>
        ) : (
          <><p className="only-mobile">Scroll the table horizontally to see all columns.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Order Number</th>
                  <th scope="col">Created At (GMT+8)</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Items</th>
                  <th scope="col" className="num">Total</th>
                  <th scope="col">Tracking Number</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.orders.map(order => (
                  <tr key={order.id}>
                    <td className="mono">{order.orderNumber}</td>
                    <td>{formatGmt8(order.createdAt)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="num">{order.itemCount}</td>
                    <td className="num"><Money cents={order.totalCents} /></td>
                    <td className="mono small">{order.trackingNumber ?? "—"}</td>
                    <td><Link href={`/staff/orders/${order.id}`}>Process</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></>
        )}
        <Pager basePath="/staff" params={{ status, pageSize: String(pageSize) }} page={result.page} totalPages={result.totalPages} total={result.total} />
      </section>
    </main>
  );
}
