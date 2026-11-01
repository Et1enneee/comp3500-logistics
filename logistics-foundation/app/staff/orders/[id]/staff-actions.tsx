"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Key = "CONFIRMED" | "PICKING" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
type Feedback = { kind: "success" | "error" | "info"; text: string } | null;

const ACTION_LABEL: Record<Key, string> = {
  CONFIRMED: "确认订单",
  PICKING: "开始拣货",
  IN_TRANSIT: "模拟揽收",
  DELIVERED: "模拟签收",
  CANCELLED: "取消订单（员工）",
};

/** 员工履约动作面板：每次操作后重新从服务器读取，不依赖本地状态推断。 */
export default function StaffActions({ orderId, orderNumber, status, csrfToken }: {
  orderId: string; orderNumber: string; status: string; csrfToken: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Key | "SHIPPED" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [carrier, setCarrier] = useState("顺丰速运");
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
        setFeedback({ kind: "error", text: `${data?.error?.message || "操作失败"}（HTTP ${response.status}）` });
        router.refresh();
        return;
      }
      const successText: Record<string, string> = {
        CONFIRMED: "已确认。库存预占与 ORDER_CONFIRM 流水已由同一事务写入。",
        PICKING: "已进入拣货中；库存不再变动。",
        SHIPPED: `已发货，运单号 ${data?.shipment?.trackingNumber ?? "已生成"}；库存不再二次扣减。`,
        IN_TRANSIT: "已模拟揽收，追踪事件已追加。",
        DELIVERED: "已模拟签收，订单完成。",
        CANCELLED: "已取消；CONFIRMED 订单已回补库存并写释放流水。",
      };
      setFeedback({ kind: "success", text: successText[action] ?? "操作成功。" });
      setConfirmingCancel(false);
      setConfirmingStock(false);
      router.refresh();
    } catch {
      setFeedback({ kind: "info", text: "网络中断，操作结果未知。请刷新页面核对状态，不要连续重试。" });
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
          <label htmlFor="carrier">承运商（发货时写入运单）</label>
          <input id="carrier" value={carrier} disabled={!!busy} onChange={event => setCarrier(event.target.value)} />
        </div>
      )}
      <div className="confirm-actions" style={{ minWidth: 0 }}>
        {nextAction === "CONFIRMED" && !confirmingStock && (
          <button className="primary" onClick={() => setConfirmingStock(true)} disabled={!!busy}>确认订单</button>
        )}
        {nextAction === "CONFIRMED" && confirmingStock && (
          <div className="feedback info" role="alertdialog" aria-label="确认占用库存" style={{ margin: 0 }}>
            <strong>确认订单 {orderNumber}？</strong>
            <p>将按订单数量扣减可用库存；确认前仍可返回。</p>
            <div className="inline-actions">
              <button className="primary" onClick={() => run("CONFIRMED")} disabled={!!busy}>
                {busy === "CONFIRMED" ? "处理中…" : "确认扣减库存"}
              </button>
              <button onClick={() => setConfirmingStock(false)} disabled={!!busy}>返回</button>
            </div>
          </div>
        )}
        {nextAction && nextAction !== "PICKING" && nextAction !== "CONFIRMED" && (
          <button className="primary" onClick={() => run(nextAction)} disabled={!!busy}>
            {busy === nextAction ? "处理中…" : ACTION_LABEL[nextAction]}
          </button>
        )}
        {status === "CONFIRMED" && (
          <button className="primary" onClick={() => run("PICKING")} disabled={!!busy}>
            {busy === "PICKING" ? "处理中…" : "开始拣货"}
          </button>
        )}
        {status === "PICKING" && (
          <button className="primary" onClick={() => run("SHIPPED")} disabled={!!busy || !carrier.trim()}>
            {busy === "SHIPPED" ? "正在发货…" : "发货并生成运单"}
          </button>
        )}
        {cancelAllowed && !confirmingCancel && (
          <button className="danger" onClick={() => setConfirmingCancel(true)} disabled={!!busy}>
            取消该订单
          </button>
        )}
        {cancelAllowed && confirmingCancel && (
          <div className="feedback info" role="alertdialog" aria-label="员工取消确认" style={{ margin: 0 }}>
            <strong>确认取消已确认订单？</strong>
            <p>库存将回补一次并写入 ORDER_CANCEL_RELEASE 正流水；订单不可恢复。</p>
            <div className="inline-actions">
              <button className="danger" onClick={() => run("CANCELLED")} disabled={!!busy}>
                {busy === "CANCELLED" ? "正在取消…" : "确认取消"}
              </button>
              <button onClick={() => setConfirmingCancel(false)}>返回</button>
            </div>
          </div>
        )}
        {!nextAction && status !== "CONFIRMED" && status !== "PICKING" && (
          <p className="hint" style={{ margin: 0 }}>当前状态没有可执行的履约动作{cancelAllowed ? "，仅可取消" : ""}。</p>
        )}
      </div>
      <p className="hint" style={{ margin: 0 }}>
        规则：PATCH 只能做确认/拣货/揽收/签收/取消；发货必须走 POST /api/v1/shipments。重复或并发操作返回 409，不会重复扣减或重复生成运单。
      </p>
    </div>
  );
}
