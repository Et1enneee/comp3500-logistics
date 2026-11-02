import Link from "next/link";
import { requirePageRole } from "@/lib/page-auth";
import { queryOrderList } from "@/lib/order-api";
import { prisma } from "@/lib/prisma";
import { EmptyState, Forbidden, InvalidQuery, Money, Pager, StatusBadge, STATUS_FILTERS } from "@/components/ui";
import { parseOrderParams, parsePageQuery, type PageQuery } from "@/lib/query-params";
import { formatGmt8 } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<PageQuery>;
}) {
  const session = await requirePageRole(["CUSTOMER"]);
  if (!session) return <Forbidden detail="The order center is open to customers only; staff should use the Order Workbench." />;
  const query = await searchParams;
  const parsed = parsePageQuery(query, parseOrderParams);
  if (!parsed.ok) return <InvalidQuery message={parsed.message} basePath="/orders" query={query} fields={["page", "pageSize", "status", "orderNumber"]} />;
  const { page, pageSize, orderNumber } = parsed.value;
  const status = parsed.value.status ?? "";
  const searched = orderNumber ?? "";

  // Look up the customer's own order by exact ORD number (other customers' orders return "not found" to avoid leaking existence).
  if (searched) {
    const match = await prisma.order.findUnique({
      where: { orderNumber: searched },
      select: { id: true, customerId: true, orderNumber: true, status: true, totalCents: true, createdAt: true },
    });
    const own = match && match.customerId === session.user.id ? match : null;
    return (
      <main className="page">
        <div className="page-heading">
          <p className="eyebrow">CUSTOMER / My Orders</p>
          <h1>Order Number Lookup</h1>
          <form className="inline-form" method="get" action="/orders">
            <div className="field"><label htmlFor="q">Order number (starts with ORD)</label><input id="q" name="orderNumber" defaultValue={searched} /></div>
            <button type="submit">Find Order</button>
            <Link className="button" href="/orders">Back to List</Link>
          </form>
        </div>
        <section className="card">
          {own ? (
            <div className="card-body">
              <dl className="order-meta">
                <div><dt>Order Number</dt><dd className="mono">{own.orderNumber}</dd></div>
                <div><dt>Created At (GMT+8)</dt><dd>{formatGmt8(own.createdAt)}</dd></div>
                <div><dt>Status</dt><dd><StatusBadge status={own.status} /></dd></div>
                <div><dt>Total</dt><dd><Money cents={own.totalCents} /></dd></div>
              </dl>
              <p style={{ marginTop: 24 }}><Link className="button primary" href={`/orders/${own.id}`}>View Details &amp; Tracking</Link></p>
            </div>
          ) : (
            <EmptyState title="Order not found">
              Please double-check the ORD order number. To protect other customers, orders that do not belong to you cannot be looked up.
            </EmptyState>
          )}
        </section>
      </main>
    );
  }

  const result = await queryOrderList(prisma, session.user, {
    page,
    pageSize,
    status: status || undefined,
  });

  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">CUSTOMER / My Orders</p>
        <h1>My Orders</h1>
        <p className="subtitle">The list contains only your own orders, with status filtering and pagination. Opening a detail URL directly is also ownership-checked on the server.</p>
        <div className="step-row" aria-label="Quick tips">
          <span className="active">Filter by status</span>
          <span>View details and tracking</span>
          <span>Cancel before shipping</span>
        </div>
      </div>
      <section className="card">
        <div className="toolbar">
          <form className="filters" method="get" action="/orders">
            <div className="field">
              <label htmlFor="status-filter">Status</label>
              <select id="status-filter" name="status" defaultValue={status}>
                {STATUS_FILTERS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <button className="primary" type="submit">Filter</button>
          </form>
          <form className="filters" method="get" action="/orders">
            <div className="field">
              <label htmlFor="order-number-search">Search by order number</label>
              <input id="order-number-search" name="orderNumber" placeholder="ORD-YYYYMMDD-XXXX" />
            </div>
            <button type="submit">Find Order</button>
          </form>
        </div>
        {result.orders.length === 0 ? (
          <EmptyState title="No matching orders">
            {status ? "Try a different status filter, or go back to the home page to create an order." : "Go back to the home page, pick products, and place your first order."}
            <p style={{ marginTop: 12 }}><Link className="button" href="/">Place an Order</Link></p>
          </EmptyState>
        ) : (
          <><p className="only-mobile">Scroll the table horizontally to see all columns.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Order Number</th>
                  <th scope="col">Created At (GMT+8)</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Item Lines</th>
                  <th scope="col" className="num">Total</th>
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
                    <td><Link href={`/orders/${order.id}`}>Details / Tracking</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></>
        )}
        <Pager
          basePath="/orders"
          params={{ status, pageSize: String(pageSize) }}
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
        />
      </section>
    </main>
  );
}
