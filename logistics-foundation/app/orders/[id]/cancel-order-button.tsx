"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type State = { kind: "idle" } | { kind: "confirm" } | { kind: "busy" } | { kind: "error"; message: string } | { kind: "unknown" };

/** Customer cancellation: CREATED / CONFIRMED only; dangerous actions require double confirmation. */
export default function CancelOrderButton({ orderId, csrfToken, status }: { orderId: string; csrfToken: string; status: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const lock = useRef(false);
  const busy = state.kind === "busy";
  const allowed = status === "CREATED" || status === "CONFIRMED";
  if (!allowed) return <p className="hint">The current status cannot be cancelled (picking or shipping has started, or the order is in a final state).</p>;

  async function send() {
    if (lock.current) return;
    lock.current = true;
    setState({ kind: "busy" });
    try {
      const response = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ to: "CANCELLED" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setState({ kind: "error", message: data?.error?.message || `Cancellation failed (HTTP ${response.status}).` });
        router.refresh();
        return;
      }
      setState({ kind: "idle" });
      router.refresh();
    } catch {
      setState({ kind: "unknown" });
    } finally {
      lock.current = false;
    }
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {state.kind === "error" && <div className="feedback error" role="alert" style={{ margin: 0 }}>{state.message}</div>}
      {state.kind === "unknown" && (
        <div className="feedback info" role="alert" style={{ margin: 0 }}>
          The network dropped; the cancellation result is unknown. Refresh this page to check the status instead of retrying repeatedly.
        </div>
      )}
      {state.kind === "confirm" ? (
        <div className="feedback info" role="alertdialog" aria-label="Confirm order cancellation" style={{ margin: 0 }}>
          <strong>Cancel this order?</strong>
          <p>{status === "CONFIRMED" ? "Cancelling will restore the reserved stock once and write a release ledger entry; the order cannot be recovered." : "Cancelling a CREATED order does not involve stock restoration; the order cannot be recovered."}</p>
          <div className="inline-actions">
            <button className="danger" onClick={send} disabled={busy}>Confirm Cancellation</button>
            <button onClick={() => setState({ kind: "idle" })}>Back</button>
          </div>
        </div>
      ) : (
        <button className="danger" onClick={() => setState({ kind: "confirm" })} disabled={busy}>
          {busy ? "Cancelling…" : "Cancel Order"}
        </button>
      )}
    </div>
  );
}
