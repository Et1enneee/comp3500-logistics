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
  if (!session) return <Forbidden detail="订单工作台仅对员工开放；管理员使用只读运营报表。" />;
  const query = await searchParams;
  const parsed = parsePageQuery(query, parseOrderParams);
  if (!parsed.ok) return <InvalidQuery message={parsed.message} basePath="/staff" query={query} fields={["page", "pageSize", "status", "orderNumber"]} />;
  const { page, pageSize, orderNumber } = parsed.value;
  const status = parsed.value.status ?? "";

  // 保留按 ORD 精确查询：命中则直接跳转详情（含操作面板）。
  if (orderNumber) {
    const exact = await prisma.order.findUnique({
      where: { orderNumber: orderNumber },
      select: { id: true },
    });
    if (exact) {
      return (
        <main className="page">
          <div className="page-heading">
            <p className="eyebrow">STAFF / 订单工作台</p>
            <h1>已找到订单</h1>
            <p className="subtitle">按 ORD 精确查询命中，正在跳转详情。</p>
          </div>
          <section className="card">
            <div className="card-body">
              <p>订单 <span className="mono">{orderNumber}</span> 存在。</p>
              <p><Link className="button primary" href={`/staff/orders/${exact.id}`}>打开订单详情 →</Link></p>
            </div>
          </section>
        </main>
      );
    }
    return (
      <main className="page">
        <div className="page-heading"><p className="eyebrow">STAFF / 订单工作台</p><h1>未找到订单</h1></div>
        <section className="card"><EmptyState title={`没有订单号 ${orderNumber}`}>请核对 ORD 订单号，或返回队列重新筛选。</EmptyState></section>
      </main>
    );
  }

  const result = await queryOrderList(prisma, session.user, { page, pageSize, status: status || undefined });
  const counts = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
  const countByStatus = new Map(counts.map(row => [row.status, row._count._all]));

  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">STAFF / 订单履约</p>
        <h1>订单工作台</h1>
        <p className="subtitle">按状态处理履约队列。确认、拣货、发货、模拟物流与取消都由服务端独立校验状态与角色。</p>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-head"><h2>按订单号精确查询</h2><span className="small muted">使用 ORD 单号</span></div>
        <div className="card-body">
          <form className="inline-form" method="get" action="/staff">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="order-number">订单号</label>
              <input id="order-number" name="orderNumber" placeholder="ORD-YYYYMMDD-XXXX" autoComplete="off" />
            </div>
            <button className="primary" type="submit">查询订单</button>
          </form>
          <p className="hint">也可以直接在下方队列中按状态筛选；待确认数量：{countByStatus.get("CREATED") ?? 0} 张。</p>
        </div>
      </section>

      <section className="card">
        <div className="toolbar">
          <form className="filters" method="get" action="/staff">
            <div className="field">
              <label htmlFor="status-filter">状态筛选</label>
              <select id="status-filter" name="status" defaultValue={status}>
                {STATUS_FILTERS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}{item.value ? `（${countByStatus.get(item.value as OrderStatus) ?? 0}）` : `（${result.total}）`}
                  </option>
                ))}
              </select>
            </div>
            <button className="primary" type="submit">筛选</button>
          </form>
          <span className="small muted">共 {result.total} 张订单</span>
        </div>
        {result.orders.length === 0 ? (
          <EmptyState title="当前筛选没有订单">切换状态或使用订单号精确查询。</EmptyState>
        ) : (
          <><p className="only-mobile">表格可左右滑动查看全部列。</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">订单号</th>
                  <th scope="col">客户</th>
                  <th scope="col">创建时间 (GMT+8)</th>
                  <th scope="col">状态</th>
                  <th scope="col" className="num">明细</th>
                  <th scope="col" className="num">总额</th>
                  <th scope="col">运单</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {result.orders.map(order => (
                  <tr key={order.id}>
                    <td className="mono">{order.orderNumber}</td>
                    <td>{order.customer.name}<div className="sku">{order.customer.email}</div></td>
                    <td>{formatGmt8(order.createdAt)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="num">{order.itemCount}</td>
                    <td className="num"><Money cents={order.totalCents} /></td>
                    <td className="mono small">{order.trackingNumber ?? "—"}</td>
                    <td><Link href={`/staff/orders/${order.id}`}>处理</Link></td>
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
