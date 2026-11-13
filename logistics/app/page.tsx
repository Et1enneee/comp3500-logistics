import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/page-auth";
import { Forbidden, StatusBadge, Money } from "@/components/ui";
import { formatGmt8 } from "@/lib/time";
import OrderForm from "./order-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await requirePageRole(["CUSTOMER"]);
  if (!session) return <Forbidden detail="Staff and administrators should use their own workbenches; the customer ordering page is open to customers only." />;
  const [products, recent] = await Promise.all([
    prisma.product.findMany({
      orderBy: { sku: "asc" },
      select: { sku: true, name: true, priceCents: true, stock: true, lowStockThreshold: true },
    }),
    prisma.order.findMany({
      where: { customerId: session.user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: { id: true, orderNumber: true, status: true, totalCents: true, createdAt: true },
    }),
  ]);
  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">CUSTOMER / Products &amp; Ordering</p>
        <h1>Start with an Order</h1>
        <p className="subtitle">
          Placing an order only creates it and pre-checks available stock; stock is deducted within the same transaction only when staff confirm. Afterwards you can self-serve order details and the logistics timeline.
        </p>
        <div className="step-row" aria-label="Business flow">
          <span className="active">01 Pick products and place an order</span>
          <span>02 Staff confirm and reserve stock</span>
          <span>03 Pick, ship, and create the shipment</span>
          <span>04 Simulate pickup and delivery</span>
          <span>05 Self-service tracking and notifications</span>
        </div>
      </div>
      <OrderForm products={products} csrfToken={session.csrfToken} />
      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-head">
          <h2>Recent Orders</h2>
          <Link className="small" href="/orders">View all orders →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty"><strong>No orders yet</strong>Choose products and submit — your orders will appear here.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">Order Number</th><th scope="col">Created At (GMT+8)</th><th scope="col">Status</th><th scope="col" className="num">Total</th><th scope="col">Actions</th></tr>
              </thead>
              <tbody>
                {recent.map(order => (
                  <tr key={order.id}>
                    <td className="mono">{order.orderNumber}</td>
                    <td>{formatGmt8(order.createdAt)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="num"><Money cents={order.totalCents} /></td>
                    <td><Link href={`/orders/${order.id}`}>View details</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
