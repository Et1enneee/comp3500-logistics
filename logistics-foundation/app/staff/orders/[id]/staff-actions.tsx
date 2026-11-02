"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Key = "CONFIRMED" | "PICKING" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
type Feedback = { kind: "success" | "error" | "info"; text: string } | null;

const ACTION_LABEL: Record<Key, string> = {
  CONFIRMED: "Confirm Order",
  PICKING: "Start Picking",
  IN_TRANSIT: "Simulate Pickup",
  DELIVERED: "Simulate Delivery",
  CANCELLED: "Cancel Order (Staff)",
};

/** Staff fulfillment action panel: re-reads from the server after every action; never infers from local state. */
export default function StaffActions({ orderId, orderNumber, status, csrfToken }: {
  orderId: string; orderNumber: string; status: string; csrfToken: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Key | "SHIPPED" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [carrier, setCarrier] = useState("SF Express");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingStock, setConfirmingStock] = useState(false);
  const lock = useRef(false);

  async function run(action: Key | "SHIPPED") {
    if (lock.current) return;
    lock.current = true;
    setBusy(action);
    setFeedback(null);
    try {
      const isShipment = action === "SHIPPED";
      const response = await fetch(
        isShipment ? "/api/v1/shipments" : `/api/v1/orders/${encodeURIComponent(orderId)}/status`,
        {
          method: isShipment ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
          body: JSON.stringify(isShipment ? { orderNumber, carrier: carrier.trim() } : { to: action }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setFeedback({ kind: "error", text: `${data?.error?.message || "Operation failed"} (HTTP ${response.status})` });
        router.refresh();
        return;
      }
      const successText: Record<string, string> = {
        CONFIRMED: "Confirmed. The stock reservation and the ORDER_CONFIRM ledger entry were written in the same transaction.",
        PICKING: "Now picking; stock no longer changes.",
        SHIPPED: `Shipped with tracking number ${data?.shipment?.trackingNumber ?? "generated"}; stock is not deducted a second time.`,
        IN_TRANSIT: "Pickup simulated; tracking events appended.",
        DELIVERED: "Delivery simulated; the order is complete.",
        CANCELLED: "Cancelled; the confirmed order's stock was restored and a release ledger entry written.",
      };
      setFeedback({ kind: "success", text: successText[action] ?? "Operation succeeded." });
      setConfirmingCancel(false);
      setConfirmingStock(false);
      router.refresh();
    } catch {
      setFeedback({ kind: "info", text: "The network dropped; the result of the operation is unknown. Refresh the page to check the status instead of retrying repeatedly." });
      router.refresh();
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  const cancelAllowed = status === "CONFIRMED";
  const nextAction: Key | null =
    status === "CREATED" ? "CONFIRMED"
    : status === "CONFIRMED" ? "PICKING"
    : status === "SHIPPED" ? "IN_TRANSIT"
    : status === "IN_TRANSIT" ? "DELIVERED"
    : null;

  return (
    <div className="stack" style={{ gap: 16 }}>
      {feedback && (
        <div className={`feedback ${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"} style={{ margin: 0 }}>
          {feedback.text}
        </div>
      )}
      {status === "PICKING" && (
        <div className="field">
          <label htmlFor="carrier">Carrier (written to the shipment when shipping)</label>
          <input id="carrier" value={carrier} disabled={!!busy} onChange={event => setCarrier(event.target.value)} />
        </div>
      )}
      <div className="confirm-actions" style={{ minWidth: 0 }}>
        {nextAction === "CONFIRMED" && !confirmingStock && (
          <button className="primary" onClick={() => setConfirmingStock(true)} disabled={!!busy}>Confirm Order</button>
        )}
        {nextAction === "CONFIRMED" && confirmingStock && (
          <div className="feedback info" role="alertdialog" aria-label="Confirm stock reservation" style={{ margin: 0 }}>
            <strong>Confirm order {orderNumber}?</strong>
            <p>This will deduct available stock by the ordered quantities; you can still go back before confirming.</p>
            <div className="inline-actions">
              <button className="primary" onClick={() => run("CONFIRMED")} disabled={!!busy}>
                {busy === "CONFIRMED" ? "Working…" : "Confirm Stock Deduction"}
              </button>
              <button onClick={() => setConfirmingStock(false)} disabled={!!busy}>Back</button>
            </div>
          </div>
        )}
        {nextAction && nextAction !== "PICKING" && nextAction !== "CONFIRMED" && (
          <button className="primary" onClick={() => run(nextAction)} disabled={!!busy}>
            {busy === nextAction ? "Working…" : ACTION_LABEL[nextAction]}
          </button>
        )}
        {status === "CONFIRMED" && (
          <button className="primary" onClick={() => run("PICKING")} disabled={!!busy}>
            {busy === "PICKING" ? "Working…" : "Start Picking"}
          </button>
        )}
        {status === "PICKING" && (
          <button className="primary" onClick={() => run("SHIPPED")} disabled={!!busy || !carrier.trim()}>
            {busy === "SHIPPED" ? "Shipping…" : "Ship Order"}
          </button>
        )}
        {cancelAllowed && !confirmingCancel && (
          <button className="danger" onClick={() => setConfirmingCancel(true)} disabled={!!busy}>
            Cancel This Order
          </button>
        )}
        {cancelAllowed && confirmingCancel && (
          <div className="feedback info" role="alertdialog" aria-label="Staff cancellation confirmation" style={{ margin: 0 }}>
            <strong>Cancel this confirmed order?</strong>
            <p>Stock will be restored once and a positive ORDER_CANCEL_RELEASE ledger entry written; the order cannot be recovered.</p>
            <div className="inline-actions">
              <button className="danger" onClick={() => run("CANCELLED")} disabled={!!busy}>
                {busy === "CANCELLED" ? "Cancelling…" : "Confirm Cancellation"}
              </button>
              <button onClick={() => setConfirmingCancel(false)}>Back</button>
            </div>
          </div>
        )}
        {!nextAction && status !== "CONFIRMED" && status !== "PICKING" && (
          <p className="hint" style={{ margin: 0 }}>No fulfillment actions are available for the current status{cancelAllowed ? "; only cancellation is available" : ""}.</p>
        )}
      </div>
      <p className="hint" style={{ margin: 0 }}>
        Rules: PATCH handles confirm/pick/pickup/delivery/cancel; shipping must go through POST /api/v1/shipments. Duplicate or concurrent operations return 409 and never double-deduct stock or create duplicate shipments.
      </p>
    </div>
  );
}
