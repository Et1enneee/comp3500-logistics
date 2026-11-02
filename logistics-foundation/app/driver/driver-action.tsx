"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DriverAction({ orderId, status, csrfToken }: { orderId: string; status: string; csrfToken: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const target = status === "SHIPPED" ? "IN_TRANSIT" : status === "IN_TRANSIT" ? "DELIVERED" : null;
  if (!target) return <span className="small muted">Completed</span>;
  async function advance() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ to: target }),
      });
      const data = await response.json().catch(() => null);
      setMessage(response.ok ? "Status updated." : (data?.error?.message ?? "Status update failed."));
      router.refresh();
    } catch {
      setMessage("Network result unknown. Refresh to check the status before retrying.");
      router.refresh();
    } finally { setBusy(false); }
  }
  return <div><button onClick={advance} disabled={busy}>{busy ? "Working…" : target === "IN_TRANSIT" ? "Simulate Pickup" : "Simulate Delivery"}</button>{message && <p role="status">{message}</p>}</div>;
}
