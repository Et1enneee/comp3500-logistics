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
  if (!session) return <Forbidden detail="订单详情仅对客户开放。" />;
  const { id } = await params;

  let order;
  try {
    order = await queryOrderDetail(prisma, session.user, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }

  // 未发货时追踪返回 SHIPMENT_NOT_FOUND，这是明确的空状态，不是错误栈。
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
      trackingNote = "运单追踪读取失败，可稍后刷新重试。";
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">CUSTOMER / 订单详情</p>
        <h1 className="mono">{order.orderNumber}</h1>
        <p className="subtitle">单价为下单时快照；金额以整数分存储。所有时间按 {TIMEZONE_LABEL} 展示。</p>
        <p><Link href="/orders">← 返回我的订单</Link></p>
      </div>

      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2>订单信息</h2>
            <StatusBadge status={order.status} testId="order-status" />
          </div>
          <div className="card-body">
            <dl className="order-meta">
              <div><dt>订单号（查询用 ORD）</dt><dd className="mono">{order.orderNumber}</dd></div>
              <div><dt>创建时间 ({TIMEZONE_LABEL})</dt><dd>{formatGmt8(order.createdAt)}</dd></div>
              <div><dt>最后更新 ({TIMEZONE_LABEL})</dt><dd>{formatGmt8(order.updatedAt)}</dd></div>
              <div><dt>客户</dt><dd>{order.customer.name} · <span className="small">{order.customer.email}</span></dd></div>
            </dl>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">商品</th><th scope="col" className="num">下单单价</th><th scope="col" className="num">数量</th><th scope="col" className="num">小计</th></tr>
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
            <span className="small muted">合计按下单时单价快照计算</span>
            <strong>合计 <Money cents={order.totalCents} /></strong>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>运单与物流</h2>{order.shipment && <span className="tag">模拟物流</span>}</div>
          {trackingNote && <div className="card-body"><div className="feedback error" role="alert" style={{ margin: 0 }}>{trackingNote}</div></div>}
          {!order.shipment && (
            <div className="empty">
              <strong>尚未发货</strong>
              员工确认、拣货并发货后会生成 LG 运单号；本页会在刷新后显示承运商与时间线。
            </div>
          )}
          {order.shipment && (
            <>
              <div className="card-body">
                <dl className="order-meta">
                  <div><dt>运单号</dt><dd className="mono" data-testid="tracking-number">{order.shipment.trackingNumber}</dd></div>
                  <div><dt>承运商</dt><dd>{order.shipment.carrier}</dd></div>
                  <div><dt>发货时间 ({TIMEZONE_LABEL})</dt><dd>{order.shipment.shippedAt ? formatGmt8(order.shipment.shippedAt) : "—"}</dd></div>
                  <div><dt>签收时间 ({TIMEZONE_LABEL})</dt><dd>{order.shipment.deliveredAt ? formatGmt8(order.shipment.deliveredAt) : "—"}</dd></div>
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
                <div className="empty">运单已生成，追踪事件读取中或暂不可用，请稍后刷新。</div>
              )}
              <div className="card-body" style={{ borderTop: "1px solid var(--line)" }}>
                <p className="hint" style={{ margin: 0 }} data-testid="tracking-events">共 {tracking?.events.length ?? 0} 条追踪事件，按时间正序。</p>
              </div>
            </>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>订单操作</h2></div>
          <div className="card-body">
            <CancelOrderButton orderId={order.id} csrfToken={session.csrfToken} status={order.status} />
            <p className="hint">取消规则：CREATED 取消不改变库存；CONFIRMED 取消会在同一事务内回补库存并写一条正释放流水；拣货及之后不支持取消。</p>
          </div>
        </section>
      </div>
    </main>
  );
}
