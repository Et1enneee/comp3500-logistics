"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** 补货表单：只提交增量数量；服务端写 STOCK_REPLENISH 流水并记录操作人。 */
export default function ReplenishForm({ productId, sku, name, csrfToken, compact = false }: {
  productId: string; sku: string; name: string; csrfToken: string; compact?: boolean;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("5");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const lock = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const amount = Number(quantity);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setMessage({ kind: "error", text: "补货数量必须为正整数。" });
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/inventory/${encodeURIComponent(productId)}/replenish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ quantity: amount }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage({ kind: "error", text: data?.error?.message || `补货失败（HTTP ${response.status}）。` });
        return;
      }
      setMessage({ kind: "success", text: `${sku} 已补货 ${amount}，当前可用库存 ${data.product.stock}。` });
      router.refresh();
    } catch {
      setMessage({ kind: "info", text: "网络中断，补货结果未知。请刷新页面核对库存与流水，不要连续重试。" });
      router.refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const inputId = `qty-${sku}${compact ? "-compact" : ""}`;
  return (
    <form onSubmit={submit} className={compact ? "replenish-form" : "inline-form"} aria-label={`补货 ${sku}`}>
      {compact ? (
        <label className="sr-only" htmlFor={inputId}>{name} 补货数量</label>
      ) : (
        <div className="field">
          <label htmlFor={inputId}>{name} · 补货数量</label>
        </div>
      )}
      <input
        id={inputId}
        aria-label={`${sku} 补货数量`}
        type="number"
        min="1"
        step="1"
        value={quantity}
        disabled={busy}
        onChange={event => setQuantity(event.target.value)}
        style={compact ? undefined : { width: 100 }}
      />
      <button className="primary" type="submit" disabled={busy}>{busy ? "补货中…" : "补货"}</button>
      {message && (
        <span className={`small ${message.kind === "error" ? "low" : "muted"}`} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </span>
      )}
    </form>
  );
}
