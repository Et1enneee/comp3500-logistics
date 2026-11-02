"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Driver = { id: string; name: string; email: string };
export default function AssignDriver({ orderId, csrfToken, drivers, selected }: {
  orderId: string; csrfToken: string; drivers: Driver[]; selected: string | null;
}) {
  const router = useRouter();
  const [driverId, setDriverId] = useState(selected ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function assign() {
    if (busy || !driverId) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/driver`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ driverId }),
      });
      const data = await response.json().catch(() => null);
      setMessage(response.ok ? "Driver assigned. Pickup and delivery can now be simulated." : (data?.error?.message ?? "Assignment failed."));
      router.refresh();
    } catch {
      setMessage("Network result unknown. Refresh to check the assignment before retrying.");
      router.refresh();
    } finally { setBusy(false); }
  }
  return <div className="stack" style={{ gap: 12 }}>
    <div className="field"><label htmlFor="driver-select">Driver</label>
      <select id="driver-select" value={driverId} disabled={busy} onChange={event => setDriverId(event.target.value)}>
        <option value="">Choose a driver</option>
        {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name} · {driver.email}</option>)}
      </select>
    </div>
    <div><button onClick={assign} disabled={busy || !driverId}>{busy ? "Assigning…" : "Assign Driver"}</button></div>
    {message && <p role="status">{message}</p>}
    <p className="hint">Assignment can be changed before pickup. This is a simulated delivery.</p>
  </div>;
}
