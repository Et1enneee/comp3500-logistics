"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Replenishment form: submits an increment quantity only; the server writes a STOCK_REPLENISH ledger entry and records the operator. */
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
      setMessage({ kind: "error", text: "The replenishment quantity must be a positive integer." });
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
        setMessage({ kind: "error", text: data?.error?.message || `Replenishment failed (HTTP ${response.status}).` });
        return;
      }
      setMessage({ kind: "success", text: `${sku} replenished by ${amount}; available stock is now ${data.product.stock}.` });
      router.refresh();
    } catch {
      setMessage({ kind: "info", text: "The network dropped; the replenishment result is unknown. Refresh the page to check stock and the ledger instead of retrying repeatedly." });
      router.refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const inputId = `qty-${sku}${compact ? "-compact" : ""}`;
  return (
    <form onSubmit={submit} className={compact ? "replenish-form" : "inline-form"} aria-label={`Replenish ${sku}`}>
      {compact ? (
        <label className="sr-only" htmlFor={inputId}>{name} replenishment quantity</label>
      ) : (
        <div className="field">
          <label htmlFor={inputId}>{name} · replenishment quantity</label>
        </div>
      )}
      <input
        id={inputId}
        aria-label={`${sku} replenishment quantity`}
        type="number"
        min="1"
        step="1"
        value={quantity}
        disabled={busy}
        onChange={event => setQuantity(event.target.value)}
        style={compact ? undefined : { width: 100 }}
      />
      <button className="primary" type="submit" disabled={busy}>{busy ? "Replenishing…" : "Replenish"}</button>
      {message && (
        <span className={`small ${message.kind === "error" ? "low" : "muted"}`} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </span>
      )}
    </form>
  );
}
