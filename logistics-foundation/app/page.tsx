import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/page-auth";
import { Forbidden, StatusBadge, Money } from "@/components/ui";
import { formatGmt8 } from "@/lib/time";
import OrderForm from "./order-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await requirePageRole(["CUSTOMER"]);
  if (!session) return <Forbidden detail="员工与管理员请使用各自的工作台，客户下单页仅对客户开放。" />;
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
        <p className="eyebrow">CUSTOMER / 商品与下单</p>
        <h1>从一张订单开始</h1>
        <p className="subtitle">
          下单只创建订单并预检可用库存；员工确认时才在同一事务内扣减库存。之后可自助查看订单与物流时间线。
        </p>
        <div className="step-row" aria-label="业务流程">
          <span className="active">01 选择商品并下单</span>
          <span>02 员工确认并预占库存</span>
          <span>03 拣货、发货、生成运单</span>
          <span>04 模拟揽收与签收</span>
          <span>05 自助追踪与通知</span>
        </div>
      </div>
      <OrderForm products={products} csrfToken={session.csrfToken} />
      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-head">
          <h2>最近订单</h2>
          <Link className="small" href="/orders">查看全部订单 →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty"><strong>还没有订单</strong>选择商品后提交，即可在这里看到自己的订单。</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">订单号</th><th scope="col">创建时间 (GMT+8)</th><th scope="col">状态</th><th scope="col" className="num">总额</th><th scope="col">操作</th></tr>
              </thead>
              <tbody>
                {recent.map(order => (
                  <tr key={order.id}>
                    <td className="mono">{order.orderNumber}</td>
                    <td>{formatGmt8(order.createdAt)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="num"><Money cents={order.totalCents} /></td>
                    <td><Link href={`/orders/${order.id}`}>查看详情</Link></td>
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
