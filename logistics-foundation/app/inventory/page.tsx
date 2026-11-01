import Link from "next/link";
import { requirePageRole } from "@/lib/page-auth";
import { queryInventory, queryInventoryLogs } from "@/lib/inventory-api";
import { prisma } from "@/lib/prisma";
import { EmptyState, Forbidden, InvalidQuery, Money, Pager } from "@/components/ui";
import { parseInventoryPageParams, parsePageQuery, type PageQuery } from "@/lib/query-params";
import { formatGmt8 } from "@/lib/time";
import ReplenishForm from "./replenish-form";

export const dynamic = "force-dynamic";

const LOW_STOCK_LIMIT = 100;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<PageQuery>;
}) {
  const session = await requirePageRole(["STAFF", "ADMIN"]);
  if (!session) return <Forbidden detail="库存页面仅对员工与管理员开放。" />;
  const isAdmin = session.user.role === "ADMIN";
  const query = await searchParams;
  const parsed = parsePageQuery(query, parseInventoryPageParams);
  if (!parsed.ok) return <InvalidQuery message={parsed.message} basePath="/inventory" query={query} fields={["page", "pageSize", "lowStock", "sku", "logPage", "logSku", "orderNumber"]} />;
  const { inventory: inventoryQuery, logs: logQuery } = parsed.value;
  const { lowStockOnly } = inventoryQuery;
  const sku = inventoryQuery.sku ?? "";
  const [inventory, logs, lowStockList] = await Promise.all([
    queryInventory(prisma, inventoryQuery),
    queryInventoryLogs(prisma, logQuery),
    prisma.product.findMany({ orderBy: { sku: "asc" } }),
  ]);
  const lowStock = lowStockList.filter(product => product.stock < product.lowStockThreshold);
  const lowStockCount = lowStock.length;

  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">{isAdmin ? "ADMIN / 库存只读" : "STAFF / 库存与预警"}</p>
        <h1>库存工作台</h1>
        <p className="subtitle">
          库存字段表示“可用库存”。预警严格小于阈值才出现（等于阈值不报警）。{isAdmin ? "管理员只读，不能补货或改订单。" : "补货只能增加数量，并在同一事务内写库存流水。"}
        </p>
      </div>

      <div className="stack">
        <section className="card" data-testid="low-stock-card">
          <div className="card-head">
            <h2>低库存预警</h2>
            <span className="small muted">{lowStockCount} 个 SKU 低于阈值</span>
          </div>
          {lowStockCount === 0 ? (
            <EmptyState title="当前没有低库存 SKU">所有商品可用库存均不低于各自阈值。</EmptyState>
          ) : (
            <ul className="list-plain" style={{ padding: "0 24px" }} data-testid="low-stock-list">
              {lowStock.slice(0, LOW_STOCK_LIMIT).map(product => (
                <li key={product.id} data-testid={`low-stock-${product.sku}`}>
                  <span>
                    <strong>{product.name}</strong> <span className="mono sku">{product.sku}</span>
                    <span className="low"> · 库存 {product.stock} {'<'} 阈值 {product.lowStockThreshold}</span>
                  </span>
                  {!isAdmin && (
                    <ReplenishForm productId={product.id} sku={product.sku} name={product.name} csrfToken={session.csrfToken} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="toolbar">
            <form className="filters" method="get" action="/inventory">
              <div className="field">
                <label htmlFor="sku-filter">按 SKU 筛选</label>
                <input id="sku-filter" name="sku" defaultValue={sku} placeholder="SKU007" />
              </div>
              <label className="small" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <input type="checkbox" name="lowStock" value="1" defaultChecked={lowStockOnly} style={{ minHeight: 20, width: 20 }} />
                只看低库存
              </label>
              <button className="primary" type="submit">筛选</button>
            </form>
            <span className="small muted">共 {inventory.total} 个 SKU · 低库存 {inventory.lowStockCount} 个</span>
          </div>
          {inventory.products.length === 0 ? (
            <EmptyState title="没有符合条件的 SKU">清除筛选后重试。</EmptyState>
          ) : (
            <><p className="only-mobile">表格可左右滑动查看全部列。</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">SKU</th><th scope="col">商品</th><th scope="col" className="num">单价</th>
                    <th scope="col" className="num">可用库存</th><th scope="col" className="num">阈值</th>
                    <th scope="col">状态</th><th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.products.map(product => (
                    <tr key={product.id}>
                      <td className="mono">{product.sku}</td>
                      <td>{product.name}</td>
                      <td className="num"><Money cents={product.priceCents} /></td>
                      <td className={`num ${product.isLowStock ? "low" : ""}`} data-testid={`inventory-stock-${product.sku}`}>{product.stock}</td>
                      <td className="num">{product.lowStockThreshold}</td>
                      <td>{product.isLowStock ? <span className="low">低于阈值</span> : <span className="muted">正常</span>}</td>
                      <td>
                        {isAdmin ? <span className="muted small">只读</span> : (
                          <ReplenishForm productId={product.id} sku={product.sku} name={product.name} csrfToken={session.csrfToken} compact />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></>
          )}
          <Pager basePath="/inventory" params={{ sku, pageSize: String(inventory.pageSize), lowStock: lowStockOnly ? "1" : "" }} page={inventory.page} totalPages={inventory.totalPages} total={inventory.total} />
        </section>

        <section className="card">
          <div className="toolbar">
            <form className="filters" method="get" action="/inventory">
              <div className="field"><label htmlFor="log-sku">流水按 SKU</label><input id="log-sku" name="logSku" defaultValue={logQuery.sku ?? ""} placeholder="SKU001" /></div>
              <div className="field"><label htmlFor="log-order">或按订单号</label><input id="log-order" name="orderNumber" defaultValue={logQuery.orderNumber ?? ""} placeholder="ORD-YYYYMMDD-XXXX" /></div>
              <button className="primary" type="submit">筛选流水</button>
            </form>
            <span className="small muted">对账链：确认负流水、取消正释放、补货正流水，无删除入口</span>
          </div>
          {logs.logs.length === 0 ? (
            <EmptyState title="没有匹配的库存流水">确认订单、取消订单或补货后会产生流水。</EmptyState>
          ) : (
            <div className="table-wrap">
              <table data-testid="inventory-logs">
                <thead>
                  <tr><th scope="col">时间 (GMT+8)</th><th scope="col">SKU</th><th scope="col">原因</th><th scope="col" className="num">变动</th><th scope="col">关联订单</th><th scope="col">操作人</th></tr>
                </thead>
                <tbody>
                  {logs.logs.map(log => (
                    <tr key={log.id}>
                      <td>{formatGmt8(log.createdAt)}</td>
                      <td className="mono">{log.product.sku}</td>
                      <td className="mono small">{log.reason}</td>
                      <td className={`num mono ${log.delta < 0 ? "low" : ""}`}>{log.delta > 0 ? `+${log.delta}` : log.delta}</td>
                      <td className="mono small">{log.orderNumber ?? "—"}</td>
                      <td className="small">{log.actor ? `${log.actor.name} · ${log.actor.email}` : "系统/历史数据"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager basePath="/inventory" params={{ pageSize: String(logs.pageSize), logSku: logQuery.sku, orderNumber: logQuery.orderNumber }} page={logs.page} totalPages={logs.totalPages} total={logs.total} pageParam="logPage" />
          <div className="card-body" style={{ borderTop: "1px solid var(--line)" }}>
            <p className="hint" style={{ margin: 0 }}><Link href="/inventory">刷新数据</Link> · 库存与流水均来自数据库实时读取，不是截图或前端数组。</p>
          </div>
        </section>
      </div>
    </main>
  );
}
