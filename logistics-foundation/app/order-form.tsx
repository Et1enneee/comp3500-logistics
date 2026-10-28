"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABEL } from "@/lib/constants";
import { money, type CatalogProduct } from "@/lib/catalog";
export default function OrderForm({ products }: { products: CatalogProduct[] }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, string>>({ SKU001: "2" });
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ orderNumber: string; totalCents: number } | null>(null);
  const lines = products.map(p => ({ p, q: Number(quantities[p.sku] || 0) })).filter(l => l.q > 0 && Number.isSafeInteger(l.q));
  const invalid = Object.values(quantities).some(v => v !== "" && (!Number.isSafeInteger(Number(v)) || Number(v) < 0 || Number(v) > 2147483647));
  const total = lines.reduce((n, l) => n + l.q * l.p.priceCents, 0);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (lock.current) return;
    setError(""); setCreated(null);
    if (invalid || !lines.length) { setError("请至少选择一件商品，数量须为有效的非负整数。"); return; }
    lock.current = true; setBusy(true);
    try {
      const response = await fetch("/api/v1/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "customer@demo.com", items: lines.map(({ p, q }) => ({ sku: p.sku, quantity: q })) }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error?.message || "提交失败，请稍后重试。"); return; }
      setCreated({ orderNumber: data.order.orderNumber, totalCents: data.order.totalCents });
      setQuantities({}); router.refresh();
    } catch { setError("无法连接服务器，未确认提交结果。请先查询订单记录，勿连续重复提交。"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    {created && <section className="feedback success" role="status"><strong>订单已创建 · {STATUS_LABEL.CREATED}</strong><p className="mono" data-testid="created-order-number">{created.orderNumber}</p><p>订单合计 {money(created.totalCents)}。当前尚未占用库存。</p><Link className="button" href={`/staff?orderNumber=${encodeURIComponent(created.orderNumber)}`}>带入员工工作台 →</Link></section>}
    {error && <div className="feedback error" role="alert"><strong>订单未提交成功</strong><p>{error}</p></div>}
    <form onSubmit={submit} noValidate className="workspace">
      <section className="card"><div className="card-head"><h2>商品目录</h2><span className="small muted">价格与库存来自数据库</span></div>
        <div className="table-wrap"><table><thead><tr><th scope="col">商品</th><th scope="col" className="num">单价</th><th scope="col" className="num">可用库存</th><th scope="col">数量</th></tr></thead><tbody>
          {products.map(p => <tr key={p.sku}><td><div>{p.name}</div><div className="sku mono">{p.sku}</div></td><td className="num">{money(p.priceCents)}</td><td className={`num ${p.stock < p.lowStockThreshold ? "low" : ""}`} data-testid={`stock-${p.sku}`}>{p.stock}{p.stock < p.lowStockThreshold ? " · 偏低" : ""}</td><td><input aria-label={`${p.sku} 数量`} name={p.sku} type="number" inputMode="numeric" min="0" step="1" value={quantities[p.sku] ?? ""} placeholder="0" disabled={busy} onChange={e => setQuantities(q => ({ ...q, [p.sku]: e.target.value }))} /></td></tr>)}
          {!products.length && <tr><td colSpan={4}>暂无商品。请由项目负责人按运行说明初始化演示数据。</td></tr>}
        </tbody></table></div>
      </section>
      <aside className="aside-stack"><section className="card"><div className="card-body"><p className="small muted">演示客户</p><p className="mono">customer@demo.com</p><h2>订单摘要</h2><ul className="summary-lines">{lines.map(({p,q}) => <li key={p.sku}><span>{p.name} × {q}</span><strong>{money(p.priceCents*q)}</strong></li>)}{!lines.length && <li className="muted">尚未选择商品</li>}</ul><p className="small muted">预估合计 · 以服务端计算为准</p><div className="summary-total" data-testid="cart-total">{money(total)}</div><button className="primary full" type="submit" disabled={busy || !products.length}>{busy ? "正在提交…" : "提交订单"}</button><p className="hint">提交时预检库存，不锁定商品；员工确认时重新校验。</p></div></section><div className="note"><strong>当前演示范围</strong>本页面不收款。下单成功后，可将订单号带入员工工作台完成确认。</div></aside>
    </form>
  </>;
}
