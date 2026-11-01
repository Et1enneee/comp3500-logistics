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
  if (!session) return <Forbidden detail="订单中心仅对客户开放；员工请使用订单工作台。" />;
  const query = await searchParams;
  const parsed = parsePageQuery(query, parseOrderParams);
  if (!parsed.ok) return <InvalidQuery message={parsed.message} basePath="/orders" query={query} fields={["page", "pageSize", "status", "orderNumber"]} />;
  const { page, pageSize, orderNumber } = parsed.value;
  const status = parsed.value.status ?? "";
  const searched = orderNumber ?? "";

  // 按 ORD 精确查询本人订单（他人订单返回“未找到”，不泄露存在性）。
  if (searched) {
    const match = await prisma.order.findUnique({
      where: { orderNumber: searched },
      select: { id: true, customerId: true, orderNumber: true, status: true, totalCents: true, createdAt: true },
    });
    const own = match && match.customerId === session.user.id ? match : null;
    return (
      <main className="page">
        <div className="page-heading">
          <p className="eyebrow">CUSTOMER / 我的订单</p>
          <h1>订单号查询</h1>
          <form className="inline-form" method="get" action="/orders">
            <div className="field"><label htmlFor="q">订单号（ORD 开头）</label><input id="q" name="orderNumber" defaultValue={searched} /></div>
            <button type="submit">查询</button>
            <Link className="button" href="/orders">返回列表</Link>
          </form>
        </div>
        <section className="card">
          {own ? (
            <div className="card-body">
              <dl className="order-meta">
                <div><dt>订单号</dt><dd className="mono">{own.orderNumber}</dd></div>
                <div><dt>创建时间 (GMT+8)</dt><dd>{formatGmt8(own.createdAt)}</dd></div>
                <div><dt>状态</dt><dd><StatusBadge status={own.status} /></dd></div>
                <div><dt>总额</dt><dd><Money cents={own.totalCents} /></dd></div>
              </dl>
              <p style={{ marginTop: 24 }}><Link className="button primary" href={`/orders/${own.id}`}>查看详情与物流</Link></p>
            </div>
          ) : (
            <EmptyState title="未找到该订单">
              请核对 ORD 订单号。为保护其他客户，无法查询不属于你的订单。
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
        <p className="eyebrow">CUSTOMER / 我的订单</p>
        <h1>我的订单</h1>
        <p className="subtitle">列表只包含本人订单；支持状态筛选与分页。直接打开详情 URL 也会在服务端校验归属。</p>
        <div className="step-row" aria-label="操作提示">
          <span className="active">按状态筛选</span>
          <span>查看明细与追踪</span>
          <span>未发货可取消</span>
        </div>
      </div>
      <section className="card">
        <div className="toolbar">
          <form className="filters" method="get" action="/orders">
            <div className="field">
              <label htmlFor="status-filter">状态</label>
              <select id="status-filter" name="status" defaultValue={status}>
                {STATUS_FILTERS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <button className="primary" type="submit">筛选</button>
          </form>
          <form className="filters" method="get" action="/orders">
            <div className="field">
              <label htmlFor="order-number-search">按订单号查询</label>
              <input id="order-number-search" name="orderNumber" placeholder="ORD-YYYYMMDD-XXXX" />
            </div>
            <button type="submit">查询</button>
          </form>
        </div>
        {result.orders.length === 0 ? (
          <EmptyState title="没有符合条件的订单">
            {status ? "试试切换状态筛选，或回到首页创建订单。" : "回到首页选择商品提交第一张订单。"}
            <p style={{ marginTop: 12 }}><Link className="button" href="/">去下单</Link></p>
          </EmptyState>
        ) : (
          <><p className="only-mobile">表格可左右滑动查看全部列。</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">订单号</th>
                  <th scope="col">创建时间 (GMT+8)</th>
                  <th scope="col">状态</th>
                  <th scope="col" className="num">商品行数</th>
                  <th scope="col" className="num">总额</th>
                  <th scope="col">操作</th>
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
                    <td><Link href={`/orders/${order.id}`}>详情 / 物流</Link></td>
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
