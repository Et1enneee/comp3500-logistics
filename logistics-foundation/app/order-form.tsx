"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { money, type CatalogProduct } from "@/lib/catalog";
import { normalizeDeliveryAddress } from "@/lib/delivery-address";

type SubmitState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "created"; id: string; orderNumber: string; totalCents: number }
  | { kind: "error"; message: string }
  | { kind: "unknown"; message: string };

export default function OrderForm({ products, csrfToken }: { products: CatalogProduct[]; csrfToken: string }) {
  const router = useRouter();
  const [deliveryAddress, setDeliveryAddress] = useState("");
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
      setState({ kind: "error", message: "Please select at least one product; quantities must be valid non-negative integers." });
      return;
    }
    if (!normalizeDeliveryAddress(deliveryAddress)) {
      setState({ kind: "error", message: "Please enter a delivery address of 1–200 characters without control characters." });
      return;
    }
    lock.current = true;
    setState({ kind: "busy" });
    try {
      const response = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ deliveryAddress: deliveryAddress.trim(), items: lines.map(({ product, quantity }) => ({ sku: product.sku, quantity })) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setState({ kind: "error", message: data?.error?.message || `Submission failed (HTTP ${response.status}). Please try again later.` });
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
      // Network result unknown: never encourage a duplicate order; direct the user to "My Orders" to verify first.
      setState({
        kind: "unknown",
        message: "The network dropped before the result was confirmed. Please check \"My Orders\" first instead of blindly submitting again.",
      });
    } finally {
      lock.current = false;
    }
  }

  return (
    <>
      {state.kind === "created" && (
        <section className="feedback success" role="status">
          <strong>Order Created · Created / CREATED</strong>
          <p className="mono" data-testid="created-order-number">{state.orderNumber}</p>
          <p>Total {money(state.totalCents)}. No stock is deducted at creation; available stock is reserved only when staff confirm.</p>
          <div className="inline-actions">
            <Link className="button primary" href={`/orders/${state.id}`}>View Order Details →</Link>
            <Link className="button" href="/orders">My Orders</Link>
          </div>
        </section>
      )}
      {state.kind === "error" && (
        <div className="feedback error" role="alert"><strong>Order Not Submitted</strong><p>{state.message}</p></div>
      )}
      {state.kind === "unknown" && (
        <div className="feedback info" role="alert">
          <strong>Submission Result Unknown</strong>
          <p>{state.message}</p>
          <p><Link className="button" href="/orders">Check &quot;My Orders&quot;</Link></p>
        </div>
      )}
      <form onSubmit={submit} noValidate className="workspace">
        <section className="card">
          <div className="card-head"><h2>Product Catalog</h2><span className="small muted">Prices and available stock come from the database</span></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">Product</th><th scope="col" className="num">Unit Price</th><th scope="col" className="num">Available Stock</th><th scope="col">Quantity</th></tr>
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
                      {product.stock}{product.stock < product.lowStockThreshold ? " · Low" : ""}
                    </td>
                    <td>
                      <input
                        aria-label={`${product.sku} quantity`}
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
                  <tr><td colSpan={4}>No products yet. The project owner should initialize the demo data according to the run instructions.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="aside-stack">
          <section className="card">
            <div className="card-body">
              <p className="small muted">Current identity</p>
              <p className="mono">Determined automatically from your sign-in session; no email input needed</p>
              <div className="field">
                <label htmlFor="delivery-address">Delivery address</label>
                <input id="delivery-address" name="deliveryAddress" type="text" autoComplete="street-address" maxLength={200} value={deliveryAddress} disabled={busy} onChange={event => setDeliveryAddress(event.target.value)} placeholder="Street, building, area" required />
                <p className="hint">Visible to you and the assigned driver, not the staff order view.</p>
              </div>
              <h2>Order Summary</h2>
              <ul className="summary-lines">
                {lines.map(({ product, quantity }) => (
                  <li key={product.sku}><span>{product.name} × {quantity}</span><strong>{money(product.priceCents * quantity)}</strong></li>
                ))}
                {lines.length === 0 && <li className="muted">No products selected yet</li>}
              </ul>
              <p className="small muted">Estimated total · The server-side calculation and the price snapshot at submission time are authoritative</p>
              <div className="summary-total" data-testid="cart-total">{money(total)}</div>
              <button className="primary full" type="submit" disabled={busy || products.length === 0}>
                {busy ? "Submitting…" : "Place Order"}
              </button>
              <p className="hint">Stock is pre-checked at submission without locking products; staff re-validate and deduct inside a transaction upon confirmation.</p>
            </div>
          </section>
          <div className="note"><strong>Self-service available</strong>After placing an order, view its details, status, and logistics timeline under &quot;My Orders&quot;; you can cancel before shipping (CREATED / CONFIRMED).</div>
        </aside>
      </form>
    </>
  );
}
