import { requirePageRole } from "@/lib/page-auth";
import { prisma } from "@/lib/prisma";
import { queryDriverTasks } from "@/lib/driver-api";
import { EmptyState, Forbidden, StatusBadge } from "@/components/ui";
import DriverAction from "./driver-action";

export const dynamic = "force-dynamic";
export default async function DriverPage() {
  const session = await requirePageRole(["DRIVER"]);
  if (!session) return <Forbidden detail="Assigned delivery tasks are open to drivers only." />;
  const tasks = await queryDriverTasks(prisma, session.user.id);
  return <main className="page">
    <div className="page-heading"><p className="eyebrow">DRIVER / Simulated Delivery</p><h1>My Deliveries</h1>
      <p className="subtitle">Only orders assigned to your account are shown. Pickup and delivery are simulated; no GPS or real carrier service is connected.</p></div>
    {tasks.length === 0 ? <section className="card"><EmptyState title="No assigned deliveries">Staff can assign a shipped order to your account.</EmptyState></section> :
      <div className="stack">{tasks.map(task => <section className="card" key={task.trackingNumber}>
        <div className="card-head"><h2 className="mono">{task.order.orderNumber}</h2><StatusBadge status={task.order.status} /></div>
        <div className="card-body stack" style={{ gap: 12 }}>
          <p><strong>Delivery address:</strong> {task.order.deliveryAddress ?? "Not provided (older order)"}</p>
          <p>Tracking: <span className="mono">{task.trackingNumber}</span> · Carrier: {task.carrier}</p>
          <ul>{task.order.items.map(item => <li key={item.product.sku}>{item.product.name} ({item.product.sku}) × {item.quantity}</li>)}</ul>
          <DriverAction orderId={task.order.id} status={task.order.status} csrfToken={session.csrfToken} />
        </div>
      </section>)}</div>}
  </main>;
}
