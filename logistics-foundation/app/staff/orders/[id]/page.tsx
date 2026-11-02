import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/page-auth";
import { queryOrderDetail } from "@/lib/order-api";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";
import { Forbidden, Money, StatusBadge } from "@/components/ui";
import { formatGmt8, TIMEZONE_LABEL } from "@/lib/time";
import StaffActions from "./staff-actions";
import TrackingPanel from "./tracking-panel";

export const dynamic = "force-dynamic";

export default async function StaffOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageRole(["STAFF"]);
  if (!session) return <Forbidden detail="Order fulfillment actions are open to staff only." />;
  const { id } = await params;

  let order;
  try {
    order = await queryOrderDetail(prisma, session.user, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }

  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">STAFF / Order Fulfillment</p>
        <h1 className="mono">{order.orderNumber}</h1>
        <p className="subtitle">Every action is re-validated on the server for status and role; after completion, the server-read result is authoritative.</p>
        <p><Link href="/staff">← Back to Order Queue</Link></p>
      </div>

      <div className="stack">
        <section className="card">
          <div className="card-head"><h2>Order Details</h2><StatusBadge status={order.status} testId="order-status" /></div>
          <div className="card-body">
            <dl className="order-meta">
              <div><dt>Order Number</dt><dd className="mono">{order.orderNumber}</dd></div>
              <div><dt>Created At ({TIMEZONE_LABEL})</dt><dd>{formatGmt8(order.createdAt)}</dd></div>
              <div><dt>Internal ID (used automatically by the API)</dt><dd className="mono">{order.id}</dd></div>
            </dl>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Product</th><th scope="col" className="num">Unit Price at Order Time</th><th scope="col" className="num">Quantity</th><th scope="col" className="num">Subtotal</th></tr></thead>
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
          <div className="order-footer"><span className="small muted">Unit prices use the snapshot from order time</span><strong>Total <Money cents={order.totalCents} /></strong></div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Available Actions</h2><span className="tag">Simulated logistics</span></div>
          <div className="card-body">
            <StaffActions orderId={order.id} orderNumber={order.orderNumber} status={order.status} csrfToken={session.csrfToken} />
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Shipment Tracking</h2>{order.shipment && <span className="small muted">Shipment status {order.shipment.status}</span>}</div>
          <TrackingPanel orderId={order.id} hasShipment={Boolean(order.shipment)} refreshKey={order.updatedAt.toISOString()} />
        </section>
      </div>
    </main>
  );
}
