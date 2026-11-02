"use client";
import { useEffect, useState } from "react";
import type { TrackingResponse } from "@/types/orders";
import { formatGmt8 } from "@/lib/time";

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: TrackingResponse }
  | { kind: "none" }
  | { kind: "error"; detail: string };

/**
 * The tracking timeline is fetched explicitly on the client (GET /api/v1/orders/{id}/tracking).
 * A read failure affects only this card: a successful confirm/ship is never misreported as failed.
 * refreshKey comes from the server-side order.updatedAt; router.refresh() after a write triggers a re-read.
 */
export default function TrackingPanel({ orderId, hasShipment, refreshKey }: {
  orderId: string; hasShipment: boolean; refreshKey: string;
}) {
  // No shipment is determined during render; no need to setState inside an effect.
  const [state, setState] = useState<State>(() => (hasShipment ? { kind: "loading" } : { kind: "none" }));

  useEffect(() => {
    if (!hasShipment) return;
    // Keep the previous result visible during a refresh to avoid flicker; errors are overwritten by the fetch result.
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/tracking`, { cache: "no-store" });
        let body: { error?: { code?: string; message?: string } } & Partial<TrackingResponse> | null = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        if (cancelled) return;
        if (response.ok && body) {
          setState({ kind: "ok", data: body as TrackingResponse });
          return;
        }
        // An explicit "no shipment yet" is an empty state; everything else is a read failure.
        if (response.status === 404 && body?.error?.code === "SHIPMENT_NOT_FOUND") {
          setState({ kind: "none" });
          return;
        }
        const detail = body?.error?.message ? `HTTP ${response.status} · ${body.error.message}` : `HTTP ${response.status}`;
        setState({ kind: "error", detail });
      } catch {
        if (!cancelled) setState({ kind: "error", detail: "Network error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, hasShipment, refreshKey]);

  if (state.kind === "loading") return <div className="card-body"><p className="loading" role="status">Loading shipment tracking…</p></div>;
  if (state.kind === "error") {
    return (
      <div className="card-body">
        <div className="feedback error" role="alert" style={{ margin: 0 }} data-testid="tracking-warning">
          Failed to load shipment tracking ({state.detail}). The order status and shipment are unaffected; refresh and try again later.
        </div>
      </div>
    );
  }
  if (state.kind === "none") {
    return <div className="empty"><strong>No shipment yet</strong>Shipping generates a unique LG tracking number and the initial event within the same transaction.</div>;
  }
  const { data } = state;
  return (
    <>
      <div className="card-body">
        <dl className="order-meta">
          <div><dt>Tracking Number</dt><dd className="mono" data-testid="tracking-number">{data.trackingNumber}</dd></div>
          <div><dt>Carrier</dt><dd>{data.carrier}</dd></div>
        </dl>
      </div>
      <ul className="timeline" data-testid="tracking-timeline">
        {data.events.map((event, index) => (
          <li key={index}>
            <time dateTime={new Date(event.at).toISOString()}>{formatGmt8(event.at)}</time>
            <span><span className="where">{event.location}</span> · {event.description}</span>
          </li>
        ))}
      </ul>
      <div className="card-body" style={{ borderTop: "1px solid var(--line)" }}>
        <p className="hint" style={{ margin: 0 }} data-testid="tracking-events">{data.events.length} tracking events, in chronological order.</p>
      </div>
    </>
  );
}
