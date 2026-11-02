import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/page-auth";
import { queryOrderDetail, queryTracking } from "@/lib/order-api";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";
import { Forbidden, Money, StatusBadge } from "@/components/ui";
import { formatGmt8, TIMEZONE_LABEL } from "@/lib/time";
import CancelOrderButton from "./cancel-order-button";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageRole(["CUSTOMER"]);
  if (!session) return <Forbidden detail="Order details are open to customers only." />;
  const { id } = await params;

  let order;
  try {
    order = await queryOrderDetail(prisma, session.user, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }

  // Before shipping, tracking returns SHIPMENT_NOT_FOUND — an explicit empty state, not an error stack.
  let tracking: Awaited<ReturnType<typeof queryTracking>> | null = null;
  let trackingNote: string | null = null;
  try {
    tracking = await queryTracking(prisma, session.user, id);
  } catch (error) {
    if (error instanceof HttpError && error.code === "SHIPMENT_NOT_FOUND") {
      tracking = null;
    } else if (error instanceof HttpError) {
      trackingNote = error.message;
    } else {
      trackingNote = "Failed to load shipment tracking. Please refresh and try again later.";
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">CUSTOMER / Order Details</p>
        <h1 className="mono">{order.orderNumber}</h1>
        <p className="subtitle">Unit prices are snapshots taken at order placement; amounts are stored as integer cents. All times are shown in {TIMEZONE_LABEL}.</p>
        <p><Link href="/orders">← Back to My Orders</Link></p>
      </div>

      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2>Order Information</h2>
            <StatusBadge status={order.status} testId="order-status" />
          </div>
          <div className="card-body">
            <dl className="order-meta">
              <div><dt>Order Number (ORD for lookup)</dt><dd className="mono">{order.orderNumber}</dd></div>
              <div><dt>Created At ({TIMEZONE_LABEL})</dt><dd>{formatGmt8(order.createdAt)}</dd></div>
              <div><dt>Last Updated ({TIMEZONE_LABEL})</dt><dd>{formatGmt8(order.updatedAt)}</dd></div>
              <div><dt>Customer</dt><dd>{session.user.name} · <span className="small">{session.user.email}</span></dd></div>
            </dl>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">Product</th><th scope="col" className="num">Unit Price at Order Time</th><th scope="col" className="num">Quantity</th><th scope="col" className="num">Subtotal</th></tr>
              </thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id}>
                    <td>{item.product.name}<div className="sku mono">{item.product.sku}</div></td>
                    <td className="num"><Money cents={item.unitPriceCents} /></td>
                    <td className="num">{item.quantity}</td>
                    <td className="num"><Money cents={item.quantity * item.unitPriceCents} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="order-footer">
            <span className="small muted">Total calculated from the unit-price snapshot at order time</span>
            <strong>Total <Money cents={order.totalCents} /></strong>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Shipment &amp; Logistics</h2>{order.shipment && <span className="tag">Simulated logistics</span>}</div>
          {trackingNote && <div className="card-body"><div className="feedback error" role="alert" style={{ margin: 0 }}>{trackingNote}</div></div>}
          {!order.shipment && (
            <div className="empty">
              <strong>Not shipped yet</strong>
              Once staff confirm, pick, and ship the order, an LG tracking number is generated; this page will show the carrier and timeline after a refresh.
            </div>
          )}
          {order.shipment && (
            <>
              <div className="card-body">
                <dl className="order-meta">
                  <div><dt>Tracking Number</dt><dd className="mono" data-testid="tracking-number">{order.shipment.trackingNumber}</dd></div>
                  <div><dt>Carrier</dt><dd>{order.shipment.carrier}</dd></div>
                  <div><dt>Shipped At ({TIMEZONE_LABEL})</dt><dd>{order.shipment.shippedAt ? formatGmt8(order.shipment.shippedAt) : "—"}</dd></div>
                  <div><dt>Delivered At ({TIMEZONE_LABEL})</dt><dd>{order.shipment.deliveredAt ? formatGmt8(order.shipment.deliveredAt) : "—"}</dd></div>
                </dl>
              </div>
              {tracking ? (
                <ul className="timeline" data-testid="tracking-timeline">
                  {tracking.events.map((event, index) => (
                    <li key={index}>
                      <time dateTime={new Date(event.at).toISOString()}>{formatGmt8(event.at)}</time>
                      <span><span className="where">{event.location}</span> · {event.description}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">The shipment exists, but tracking events are loading or temporarily unavailable. Please refresh later.</div>
              )}
              <div className="card-body" style={{ borderTop: "1px solid var(--line)" }}>
                <p className="hint" style={{ margin: 0 }} data-testid="tracking-events">{tracking?.events.length ?? 0} tracking events, in chronological order.</p>
              </div>
            </>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Order Actions</h2></div>
          <div className="card-body">
            <CancelOrderButton orderId={order.id} csrfToken={session.csrfToken} status={order.status} />
            <p className="hint">Cancellation rules: cancelling a CREATED order does not change stock; cancelling a CONFIRMED order restores stock and writes a release ledger entry within the same transaction; cancellation is not supported once picking has started.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
