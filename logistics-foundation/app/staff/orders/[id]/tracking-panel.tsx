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
 * 追踪时间线由客户端显式请求（GET /api/v1/orders/{id}/tracking）。
 * 读取失败只影响本卡片：不会把已经成功的确认/发货误报为失败。
 * refreshKey 来自服务端 order.updatedAt，写操作后 router.refresh() 会触发重新读取。
 */
export default function TrackingPanel({ orderId, hasShipment, refreshKey }: {
  orderId: string; hasShipment: boolean; refreshKey: string;
}) {
  // 无运单是渲染期就能确定的状态，不需要在 effect 里 setState。
  const [state, setState] = useState<State>(() => (hasShipment ? { kind: "loading" } : { kind: "none" }));

  useEffect(() => {
    if (!hasShipment) return;
    // 刷新时保留上一次结果直到新结果返回，避免闪烁；错误由 fetch 结果覆盖。
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
        // 明确的“尚无运单”是空状态；其它一律视为读取失败。
        if (response.status === 404 && body?.error?.code === "SHIPMENT_NOT_FOUND") {
          setState({ kind: "none" });
          return;
        }
        const detail = body?.error?.message ? `HTTP ${response.status} · ${body.error.message}` : `HTTP ${response.status}`;
        setState({ kind: "error", detail });
      } catch {
        if (!cancelled) setState({ kind: "error", detail: "网络错误" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, hasShipment, refreshKey]);

  if (state.kind === "loading") return <div className="card-body"><p className="loading" role="status">正在读取运单追踪…</p></div>;
  if (state.kind === "error") {
    return (
      <div className="card-body">
        <div className="feedback error" role="alert" style={{ margin: 0 }} data-testid="tracking-warning">
          运单追踪读取失败（{state.detail}）。订单状态与运单不受影响，可稍后刷新重试。
        </div>
      </div>
    );
  }
  if (state.kind === "none") {
    return <div className="empty"><strong>暂无运单</strong>发货后会在同一事务内生成唯一 LG 运单与初始事件。</div>;
  }
  const { data } = state;
  return (
    <>
      <div className="card-body">
        <dl className="order-meta">
          <div><dt>运单号</dt><dd className="mono" data-testid="tracking-number">{data.trackingNumber}</dd></div>
          <div><dt>承运商</dt><dd>{data.carrier}</dd></div>
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
        <p className="hint" style={{ margin: 0 }} data-testid="tracking-events">共 {data.events.length} 条追踪事件，按时间正序。</p>
      </div>
    </>
  );
}
