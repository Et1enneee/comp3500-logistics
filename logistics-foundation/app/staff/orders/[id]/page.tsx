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
  if (!session) return <Forbidden detail="订单履约操作仅对员工开放。" />;
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
        <p className="eyebrow">STAFF / 订单履约</p>
        <h1 className="mono">{order.orderNumber}</h1>
        <p className="subtitle">每个动作都由服务端复核状态与角色；完成后以服务器读取结果为准。</p>
        <p><Link href="/staff">← 返回订单队列</Link></p>
      </div>

      <div className="stack">
        <section className="card">
          <div className="card-head"><h2>订单详情</h2><StatusBadge status={order.status} testId="order-status" /></div>
          <div className="card-body">
            <dl className="order-meta">
              <div><dt>订单号</dt><dd className="mono">{order.orderNumber}</dd></div>
              <div><dt>客户</dt><dd>{order.customer.name} · <span className="small">{order.customer.email}</span></dd></div>
              <div><dt>创建时间 ({TIMEZONE_LABEL})</dt><dd>{formatGmt8(order.createdAt)}</dd></div>
              <div><dt>内部 ID（接口自动使用）</dt><dd className="mono">{order.id}</dd></div>
            </dl>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">商品</th><th scope="col" className="num">下单单价</th><th scope="col" className="num">数量</th><th scope="col" className="num">小计</th></tr></thead>
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
          <div className="order-footer"><span className="small muted">单价采用下单时快照</span><strong>合计 <Money cents={order.totalCents} /></strong></div>
        </section>

        <section className="card">
          <div className="card-head"><h2>可执行动作</h2><span className="tag">模拟物流</span></div>
          <div className="card-body">
            <StaffActions orderId={order.id} orderNumber={order.orderNumber} status={order.status} csrfToken={session.csrfToken} />
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>运单追踪</h2>{order.shipment && <span className="small muted">运单状态 {order.shipment.status}</span>}</div>
          <TrackingPanel orderId={order.id} hasShipment={Boolean(order.shipment)} refreshKey={order.updatedAt.toISOString()} />
        </section>
      </div>
    </main>
  );
}
