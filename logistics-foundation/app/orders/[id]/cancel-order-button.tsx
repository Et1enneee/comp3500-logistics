"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type State = { kind: "idle" } | { kind: "confirm" } | { kind: "busy" } | { kind: "error"; message: string } | { kind: "unknown" };

/** 客户取消：仅 CREATED / CONFIRMED；危险动作需要二次确认。 */
export default function CancelOrderButton({ orderId, csrfToken, status }: { orderId: string; csrfToken: string; status: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const lock = useRef(false);
  const busy = state.kind === "busy";
  const allowed = status === "CREATED" || status === "CONFIRMED";
  if (!allowed) return <p className="hint">当前状态不可取消（已进入拣货/发货之后，或已结束）。</p>;

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
        setState({ kind: "error", message: data?.error?.message || `取消失败（HTTP ${response.status}）。` });
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
          网络中断，取消结果未知。请刷新本页确认状态，不要连续重试。
        </div>
      )}
      {state.kind === "confirm" ? (
        <div className="feedback info" role="alertdialog" aria-label="确认取消订单" style={{ margin: 0 }}>
          <strong>确认取消这张订单？</strong>
          <p>{status === "CONFIRMED" ? "取消后库存会回补一次并写释放流水，订单不可恢复。" : "CREATED 订单取消不涉及库存回补，订单不可恢复。"}</p>
          <div className="inline-actions">
            <button className="danger" onClick={send} disabled={busy}>确认取消</button>
            <button onClick={() => setState({ kind: "idle" })}>返回</button>
          </div>
        </div>
      ) : (
        <button className="danger" onClick={() => setState({ kind: "confirm" })} disabled={busy}>
          {busy ? "正在取消…" : "取消订单"}
        </button>
      )}
    </div>
  );
}
