"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { money, type CatalogProduct } from "@/lib/catalog";

type SubmitState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "created"; id: string; orderNumber: string; totalCents: number }
  | { kind: "error"; message: string }
  | { kind: "unknown"; message: string };

export default function OrderForm({ products, csrfToken }: { products: CatalogProduct[]; csrfToken: string }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const lock = useRef(false);
  const busy = state.kind === "busy";
  const lines = products
    .map(product => ({ product, quantity: Number(quantities[product.sku] || 0) }))
    .filter(line => line.quantity > 0 && Number.isSafeInteger(line.quantity));
  const invalid = Object.values(quantities).some(
    value => value !== "" && (!Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > 2147483647),
  );
  const total = lines.reduce((sum, line) => sum + line.quantity * line.product.priceCents, 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    setState({ kind: "idle" });
    if (invalid || lines.length === 0) {
      setState({ kind: "error", message: "请至少选择一件商品，数量须为有效的非负整数。" });
      return;
    }
    lock.current = true;
    setState({ kind: "busy" });
    try {
      const response = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ items: lines.map(({ product, quantity }) => ({ sku: product.sku, quantity })) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setState({ kind: "error", message: data?.error?.message || `提交失败（HTTP ${response.status}），请稍后重试。` });
        return;
      }
      setState({
        kind: "created",
        id: data.order.id,
        orderNumber: data.order.orderNumber,
        totalCents: data.order.totalCents,
      });
      setQuantities({});
      router.refresh();
    } catch {
      // 网络结果未知：绝不引导重复下单，只引导去“我的订单”核对。
      setState({
        kind: "unknown",
        message: "网络中断，未确认订单是否创建。请先到「我的订单」核对，不要盲目重复提交。",
      });
    } finally {
      lock.current = false;
    }
  }

  return (
    <>
      {state.kind === "created" && (
        <section className="feedback success" role="status">
          <strong>订单已创建 · 已创建 / CREATED</strong>
          <p className="mono" data-testid="created-order-number">{state.orderNumber}</p>
          <p>合计 {money(state.totalCents)}。创建时不扣库存；员工确认时才预占可用库存。</p>
          <div className="inline-actions">
            <Link className="button primary" href={`/orders/${state.id}`}>查看订单详情 →</Link>
            <Link className="button" href="/orders">我的订单</Link>
          </div>
        </section>
      )}
      {state.kind === "error" && (
        <div className="feedback error" role="alert"><strong>订单未提交成功</strong><p>{state.message}</p></div>
      )}
      {state.kind === "unknown" && (
        <div className="feedback info" role="alert">
          <strong>提交结果未知</strong>
          <p>{state.message}</p>
          <p><Link className="button" href="/orders">去「我的订单」核对</Link></p>
        </div>
      )}
      <form onSubmit={submit} noValidate className="workspace">
        <section className="card">
          <div className="card-head"><h2>商品目录</h2><span className="small muted">价格与可用库存来自数据库</span></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">商品</th><th scope="col" className="num">单价</th><th scope="col" className="num">可用库存</th><th scope="col">数量</th></tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.sku}>
                    <td>
                      <div>{product.name}</div>
                      <div className="sku mono">{product.sku}</div>
                    </td>
                    <td className="num">{money(product.priceCents)}</td>
                    <td className={`num ${product.stock < product.lowStockThreshold ? "low" : ""}`} data-testid={`stock-${product.sku}`}>
                      {product.stock}{product.stock < product.lowStockThreshold ? " · 偏低" : ""}
                    </td>
                    <td>
                      <input
                        aria-label={`${product.sku} 数量`}
                        name={product.sku}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="1"
                        value={quantities[product.sku] ?? ""}
                        placeholder="0"
                        disabled={busy}
                        onChange={event => setQuantities(current => ({ ...current, [product.sku]: event.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={4}>暂无商品。请由项目负责人按运行说明初始化演示数据。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="aside-stack">
          <section className="card">
            <div className="card-body">
              <p className="small muted">当前身份</p>
              <p className="mono">由登录会话自动确定，无需填写邮箱</p>
              <h2>订单摘要</h2>
              <ul className="summary-lines">
                {lines.map(({ product, quantity }) => (
                  <li key={product.sku}><span>{product.name} × {quantity}</span><strong>{money(product.priceCents * quantity)}</strong></li>
                ))}
                {lines.length === 0 && <li className="muted">尚未选择商品</li>}
              </ul>
              <p className="small muted">预估合计 · 以服务端计算与下单时价格快照为准</p>
              <div className="summary-total" data-testid="cart-total">{money(total)}</div>
              <button className="primary full" type="submit" disabled={busy || products.length === 0}>
                {busy ? "正在提交…" : "提交订单"}
              </button>
              <p className="hint">提交时预检库存，不锁定商品；员工确认时在事务内重新校验扣减。</p>
            </div>
          </section>
          <div className="note"><strong>可自助完成</strong>下单后可在「我的订单」查看明细、状态与物流时间线；未发货前可取消（CREATED / CONFIRMED）。</div>
        </aside>
      </form>
    </>
  );
}
