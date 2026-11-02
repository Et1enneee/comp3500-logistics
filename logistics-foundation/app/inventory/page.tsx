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
  if (!session) return <Forbidden detail="The inventory page is open to staff and administrators only." />;
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
        <p className="eyebrow">{isAdmin ? "ADMIN / Inventory (Read-only)" : "STAFF / Inventory & Alerts"}</p>
        <h1>Inventory Workbench</h1>
        <p className="subtitle">
          The stock field means &quot;available stock&quot;. An alert appears only when stock is strictly below the threshold (equal to the threshold does not alert).{isAdmin ? " Administrators are read-only and cannot replenish or modify orders." : " Replenishment can only add quantity and writes an inventory ledger entry within the same transaction."}
        </p>
      </div>

      <div className="stack">
        <section className="card" data-testid="low-stock-card">
          <div className="card-head">
            <h2>Low-stock Alerts</h2>
            <span className="small muted">{lowStockCount} SKUs below threshold</span>
          </div>
          {lowStockCount === 0 ? (
            <EmptyState title="No low-stock SKUs currently">All products&apos; available stock is at or above their thresholds.</EmptyState>
          ) : (
            <ul className="list-plain" style={{ padding: "0 24px" }} data-testid="low-stock-list">
              {lowStock.slice(0, LOW_STOCK_LIMIT).map(product => (
                <li key={product.id} data-testid={`low-stock-${product.sku}`}>
                  <span>
                    <strong>{product.name}</strong> <span className="mono sku">{product.sku}</span>
                    <span className="low"> · stock {product.stock} {'<'} threshold {product.lowStockThreshold}</span>
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
                <label htmlFor="sku-filter">Filter by SKU</label>
                <input id="sku-filter" name="sku" defaultValue={sku} placeholder="SKU007" />
              </div>
              <label className="small" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <input type="checkbox" name="lowStock" value="1" defaultChecked={lowStockOnly} style={{ minHeight: 20, width: 20 }} />
                Low stock only
              </label>
              <button className="primary" type="submit">Filter</button>
            </form>
            <span className="small muted">{inventory.total} SKUs total · {inventory.lowStockCount} low-stock</span>
          </div>
          {inventory.products.length === 0 ? (
            <EmptyState title="No matching SKUs">Clear the filters and try again.</EmptyState>
          ) : (
            <><p className="only-mobile">Scroll the table horizontally to see all columns.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">SKU</th><th scope="col">Product</th><th scope="col" className="num">Unit Price</th>
                    <th scope="col" className="num">Available Stock</th><th scope="col" className="num">Threshold</th>
                    <th scope="col">Status</th><th scope="col">Actions</th>
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
                      <td>{product.isLowStock ? <span className="low">Below threshold</span> : <span className="muted">Normal</span>}</td>
                      <td>
                        {isAdmin ? <span className="muted small">Read-only</span> : (
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
              <div className="field"><label htmlFor="log-sku">Ledger by SKU</label><input id="log-sku" name="logSku" defaultValue={logQuery.sku ?? ""} placeholder="SKU001" /></div>
              <div className="field"><label htmlFor="log-order">or by order number</label><input id="log-order" name="orderNumber" defaultValue={logQuery.orderNumber ?? ""} placeholder="ORD-YYYYMMDD-XXXX" /></div>
              <button className="primary" type="submit">Filter Ledger</button>
            </form>
            <span className="small muted">Audit chain: confirmation writes negative entries, cancellation writes positive releases, replenishment writes positive entries; there is no delete path</span>
          </div>
          {logs.logs.length === 0 ? (
            <EmptyState title="No matching inventory ledger entries">Confirming, cancelling, or replenishing produces ledger entries.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table data-testid="inventory-logs">
                <thead>
                  <tr><th scope="col">Time (GMT+8)</th><th scope="col">SKU</th><th scope="col">Reason</th><th scope="col" className="num">Change</th><th scope="col">Related Order</th><th scope="col">Operator</th></tr>
                </thead>
                <tbody>
                  {logs.logs.map(log => (
                    <tr key={log.id}>
                      <td>{formatGmt8(log.createdAt)}</td>
                      <td className="mono">{log.product.sku}</td>
                      <td className="mono small">{log.reason}</td>
                      <td className={`num mono ${log.delta < 0 ? "low" : ""}`}>{log.delta > 0 ? `+${log.delta}` : log.delta}</td>
                      <td className="mono small">{log.orderNumber ?? "—"}</td>
                      <td className="small">{log.actor ? `${log.actor.name} · ${log.actor.email}` : "System / legacy data"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager basePath="/inventory" params={{ pageSize: String(logs.pageSize), logSku: logQuery.sku, orderNumber: logQuery.orderNumber }} page={logs.page} totalPages={logs.totalPages} total={logs.total} pageParam="logPage" />
          <div className="card-body" style={{ borderTop: "1px solid var(--line)" }}>
            <p className="hint" style={{ margin: 0 }}><Link href="/inventory">Refresh data</Link> · Stock and ledger entries are read live from the database, not from screenshots or front-end arrays.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
