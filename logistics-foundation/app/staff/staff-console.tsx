"use client";
import { useRef, useState } from "react";
import { STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { money } from "@/lib/catalog";
import type { OrderDetail, StatusUpdateTarget, TrackingResponse } from "@/types/orders";

const panelTitle = (status: OrderStatus) =>
  status === "CREATED" ? "确认这张订单"
  : status === "CONFIRMED" ? "确认完成，可开始拣货"
  : status === "PICKING" ? "拣货中，可发货"
  : status === "SHIPPED" ? "已发货，等待揽收"
  : status === "IN_TRANSIT" ? "运输中，等待签收"
  : status === "DELIVERED" ? "订单已送达"
  : "订单已取消";

const panelHint = (status: OrderStatus) =>
  status === "CREATED" ? "确认成功将预占可用库存。库存不足时，订单、库存与流水均不会发生部分修改。"
  : status === "CONFIRMED" ? "开始拣货只变更状态，不会再次扣减库存。"
  : status === "PICKING" ? "发货将在同一事务内生成唯一运单与初始追踪事件；已预占库存不会再次扣减。"
  : status === "SHIPPED" ? "模拟揽收会写入一条揽收追踪事件。"
  : status === "IN_TRANSIT" ? "模拟签收会写入签收事件并完成订单。"
  : "当前状态没有可执行动作。";

export default function StaffConsole({ initialNumber }: { initialNumber: string }) {
  const [number, setNumber] = useState(initialNumber);
  const [email, setEmail] = useState("staff@demo.com");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [carrier, setCarrier] = useState("顺丰速运");
  const [busy, setBusy] = useState<"lookup" | "confirm" | "pick" | "ship" | "transit" | "deliver" | null>(null);
  const lock = useRef(false);
  const [message, setMessage] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [trackingNotice, setTrackingNotice] = useState<string | null>(null);
  async function readOrder(orderNumber: string) {
    const response = await fetch(`/api/v1/orders?orderNumber=${encodeURIComponent(orderNumber)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "查询失败，请重试。");
    return data.order as OrderDetail;
  }
  type TrackingRead = { kind: "ok"; data: TrackingResponse } | { kind: "none" } | { kind: "error"; detail: string };
  async function readTracking(id: string): Promise<TrackingRead> {
    try {
      const response = await fetch(`/api/v1/orders/${encodeURIComponent(id)}/tracking`, { cache: "no-store" });
      let body: { error?: { code?: string; message?: string } } | null = null;
      try { body = await response.json(); } catch { body = null; }
      if (response.ok) return { kind: "ok", data: body as unknown as TrackingResponse };
      // Only an explicit "no waybill" is treated as empty. Everything else is a read failure.
      if (response.status === 404 && body?.error?.code === "SHIPMENT_NOT_FOUND") return { kind: "none" };
      const detail = body?.error?.message ? `HTTP ${response.status} · ${body.error.message}` : `HTTP ${response.status}`;
      return { kind: "error", detail };
    } catch {
      return { kind: "error", detail: "网络错误" };
    }
  }
  async function refresh(orderNumber: string, id: string): Promise<string | null> {
    setOrder(await readOrder(orderNumber));
    const track = await readTracking(id);
    if (track.kind === "ok") { setTracking(track.data); return null; }
    setTracking(null);
    return track.kind === "none" ? null : track.detail;
  }
  async function lookup(e: React.FormEvent) {
    e.preventDefault(); if (lock.current) return;
    setOrder(null); setTracking(null); setMessage(null); setTrackingNotice(null);
    if (!number.trim()) { setMessage({kind:"error", text:"请输入 ORD 开头的订单号。"}); return; }
    lock.current = true; setBusy("lookup");
    try {
      const found = await readOrder(number.trim());
      setOrder(found);
      const track = await readTracking(found.id);
      if (track.kind === "ok") setTracking(track.data);
      else if (track.kind === "error") setTrackingNotice(`订单已读取，但运单追踪读取失败（${track.detail}）。订单详情不受影响，可稍后重新查询。`);
    }
    catch (error) { setMessage({ kind:"error", text:error instanceof Error ? error.message : "查询失败。" }); }
    finally { lock.current = false; setBusy(null); }
  }
  async function confirm() {
    if (!order || lock.current || order.status !== "CREATED") return;
    const current = order;
    lock.current = true; setBusy("confirm"); setMessage(null); setTrackingNotice(null);
    try {
      const response = await fetch(`/api/v1/orders/${encodeURIComponent(current.id)}/status`, { method:"PATCH", headers:{ "Content-Type":"application/json", "X-Demo-User-Email":email }, body:JSON.stringify({to:"CONFIRMED"}) });
      const data = await response.json();
      if (!response.ok) {
        setMessage({kind:"error", text:`${data.error?.message || "确认失败"}（HTTP ${response.status}）`});
        // Another operator may have changed the order. Do not leave a stale confirm button.
        try { await refresh(current.orderNumber, current.id); } catch { setOrder(null); setTracking(null); }
        return;
      }
      setOrder(null);
      try {
        const trackingError = await refresh(current.orderNumber, current.id);
        setMessage({kind:"success",text:"确认成功。已重新查询服务器，当前订单已确认；库存预占与流水由服务端同一事务完成。"});
        setTrackingNotice(trackingError ? `确认已成功，但运单追踪读取失败（${trackingError}）。订单状态不受影响，可稍后重新查询，无需重复确认。` : null);
      } catch {
        setMessage({kind:"info",text:"服务端已确认成功，但订单详情刷新失败。请重新查询，不要再次提交确认。"});
        setTrackingNotice(null);
      }
    } catch {
      setOrder(null); setTracking(null); setTrackingNotice(null);
      setMessage({kind:"error",text:"网络中断，确认结果未知。请重新查询状态后再决定操作，不要连续重试。"});
    } finally { lock.current = false; setBusy(null); }
  }
  async function advance(to: Extract<StatusUpdateTarget, "PICKING" | "IN_TRANSIT" | "DELIVERED">) {
    if (!order || lock.current) return;
    const current = order;
    const busyKey = to === "PICKING" ? "pick" : to === "IN_TRANSIT" ? "transit" : "deliver";
    const doneText = to === "PICKING" ? "已进入拣货中；库存不变。" : to === "IN_TRANSIT" ? "已模拟揽收，追踪事件已更新。" : "已模拟签收，订单完成。";
    lock.current = true; setBusy(busyKey); setMessage(null); setTrackingNotice(null);
    try {
      const response = await fetch(`/api/v1/orders/${encodeURIComponent(current.id)}/status`, { method:"PATCH", headers:{ "Content-Type":"application/json", "X-Demo-User-Email":email }, body:JSON.stringify({to}) });
      const data = await response.json();
      if (!response.ok) {
        setMessage({kind:"error", text:`${data.error?.message || "操作失败"}（HTTP ${response.status}）`});
        try { await refresh(current.orderNumber, current.id); } catch { setOrder(null); setTracking(null); }
        return;
      }
      setOrder(null);
      try {
        const trackingError = await refresh(current.orderNumber, current.id);
        setMessage({kind:"success", text:`${doneText}已重新查询服务器确认状态。`});
        setTrackingNotice(trackingError ? `状态已更新成功，但运单追踪读取失败（${trackingError}）。可稍后重新查询，无需重复操作。` : null);
      } catch {
        setMessage({kind:"info", text:"服务端已更新成功，但详情刷新失败。请重新查询，不要重复操作。"});
        setTrackingNotice(null);
      }
    } catch {
      setOrder(null); setTracking(null); setTrackingNotice(null);
      setMessage({kind:"error", text:"网络中断，操作结果未知。请重新查询状态后再决定，不要连续重试。"});
    } finally { lock.current = false; setBusy(null); }
  }
  async function ship() {
    if (!order || lock.current || order.status !== "PICKING") return;
    if (!carrier.trim()) { setMessage({kind:"error", text:"请填写承运商。"}); return; }
    const current = order;
    lock.current = true; setBusy("ship"); setMessage(null); setTrackingNotice(null);
    try {
      const response = await fetch("/api/v1/shipments", { method:"POST", headers:{ "Content-Type":"application/json", "X-Demo-User-Email":email }, body:JSON.stringify({ orderNumber: current.orderNumber, carrier: carrier.trim() }) });
      const data = await response.json();
      if (!response.ok) {
        setMessage({kind:"error", text:`${data.error?.message || "发货失败"}（HTTP ${response.status}）`});
        try { await refresh(current.orderNumber, current.id); } catch { setOrder(null); setTracking(null); }
        return;
      }
      setOrder(null);
      try {
        const trackingError = await refresh(current.orderNumber, current.id);
        setMessage({kind:"success", text:`发货成功，运单号 ${data.shipment?.trackingNumber ?? "已生成"}；库存不再二次扣减。`});
        setTrackingNotice(trackingError ? `发货已成功（运单号 ${data.shipment?.trackingNumber ?? "已生成"}），但运单追踪读取失败（${trackingError}）。请勿重复发货，可稍后重新查询。` : null);
      } catch {
        setMessage({kind:"info", text:"服务端已发货成功，但详情刷新失败。请重新查询，不要重复发货。"});
        setTrackingNotice(null);
      }
    } catch {
      setOrder(null); setTracking(null); setTrackingNotice(null);
      setMessage({kind:"error", text:"网络中断，发货结果未知。请重新查询状态后再决定，不要重复发货。"});
    } finally { lock.current = false; setBusy(null); }
  }
  return <div className="staff-layout">
    <section className="card"><div className="card-body"><form className="search-form" onSubmit={lookup}><div className="search-field"><label htmlFor="order-number">订单号</label><input id="order-number" name="orderNumber" autoComplete="off" placeholder="ORD-YYYYMMDD-XXXX" value={number} disabled={!!busy} onChange={e=>{setNumber(e.target.value);setOrder(null);setTracking(null);setMessage(null);}} /></div><button className="primary" disabled={!!busy} type="submit">{busy==="lookup" ? "查询中…" : "查询订单"}</button></form><p className="hint">查询使用 ORD 单号；确认与后续状态操作自动使用查询结果中的内部 ID，不需要手工填写。</p></div></section>
    {message && <div className={`feedback ${message.kind}`} role={message.kind==="error" ? "alert" : "status"} style={{margin:0}}>{message.text}</div>}
    {trackingNotice && <div className="feedback info" role="status" data-testid="tracking-warning" style={{margin:0}}>{trackingNotice}</div>}
    {busy==="lookup" && <div className="loading" role="status">正在读取订单…</div>}
    {!order && !busy && !message && <section className="card empty"><strong>先查询，再确认</strong>输入已有订单号。也可以从客户下单页创建订单后带入。</section>}
    {order && <><section className="card"><div className="card-head"><h2>订单详情</h2><span data-testid="order-status" className={`status ${order.status==="CONFIRMED" ? "confirmed" : ""}`}>{STATUS_LABEL[order.status]} / {order.status}</span></div><div className="card-body"><dl className="order-meta"><div><dt>订单号</dt><dd className="mono">{order.orderNumber}</dd></div><div><dt>客户</dt><dd>{order.customer.name} · <span className="small">{order.customer.email}</span></dd></div><div><dt>创建时间</dt><dd>{new Date(order.createdAt).toLocaleString("zh-CN",{timeZone:"Asia/Hong_Kong",hour12:false})} (GMT+8)</dd></div><div><dt>内部 ID · 接口自动使用</dt><dd className="mono">{order.id}</dd></div></dl></div><div className="table-wrap"><table><thead><tr><th>商品</th><th className="num">下单单价</th><th className="num">数量</th><th className="num">小计</th></tr></thead><tbody>{order.items.map(item=><tr key={item.id}><td>{item.product.name}<div className="sku mono">{item.product.sku}</div></td><td className="num">{money(item.unitPriceCents)}</td><td className="num">{item.quantity}</td><td className="num">{money(item.quantity*item.unitPriceCents)}</td></tr>)}</tbody></table></div><div className="order-footer"><span className="small muted">单价采用下单时快照</span><strong>合计 {money(order.totalCents)}</strong></div></section>
    <section className="confirm-panel"><div><h2>{panelTitle(order.status)}</h2><p>{panelHint(order.status)}</p><p>邮箱头仅用于本地角色演示，不能证明真实用户身份。</p></div><div className="confirm-actions"><div><label htmlFor="demo-actor">演示操作账号</label><select id="demo-actor" value={email} onChange={e=>setEmail(e.target.value)} disabled={!!busy}><option value="staff@demo.com">员工 · staff@demo.com</option><option value="customer@demo.com">客户 · 越权测试</option><option value="admin@demo.com">管理员 · 本接口不允许</option></select></div><button className="primary" onClick={confirm} disabled={!!busy || order.status!=="CREATED"}>{busy==="confirm" ? "正在确认…" : order.status==="CONFIRMED" ? "已确认，不可重复操作" : order.status==="CREATED" ? "确认订单" : "已确认，不可重复操作"}</button>{order.status==="CONFIRMED" && <button className="primary" onClick={()=>advance("PICKING")} disabled={!!busy}>{busy==="pick" ? "正在开始拣货…" : "开始拣货"}</button>}{order.status==="PICKING" && <><div><label htmlFor="carrier">承运商</label><input id="carrier" value={carrier} disabled={!!busy} onChange={e=>setCarrier(e.target.value)} /></div><button className="primary" onClick={ship} disabled={!!busy}>{busy==="ship" ? "正在发货…" : "发货"}</button></>}{order.status==="SHIPPED" && <button className="primary" onClick={()=>advance("IN_TRANSIT")} disabled={!!busy}>{busy==="transit" ? "正在更新…" : "模拟揽收"}</button>}{order.status==="IN_TRANSIT" && <button className="primary" onClick={()=>advance("DELIVERED")} disabled={!!busy}>{busy==="deliver" ? "正在更新…" : "模拟签收"}</button>}{order.status==="DELIVERED" && <button disabled>已签收</button>}</div></section>
    {tracking && <section className="card"><div className="card-head"><h2>运单追踪</h2><span className="status confirmed">{tracking.status}</span></div><div className="card-body"><dl className="order-meta"><div><dt>运单号</dt><dd className="mono" data-testid="tracking-number">{tracking.trackingNumber}</dd></div><div><dt>承运商</dt><dd>{tracking.carrier}</dd></div></dl><div className="table-wrap section-gap"><table><thead><tr><th>时间 (GMT+8)</th><th>地点</th><th>事件</th></tr></thead><tbody>{tracking.events.map((event, index) => <tr key={index}><td>{new Date(event.at).toLocaleString("zh-CN",{timeZone:"Asia/Hong_Kong",hour12:false})}</td><td>{event.location}</td><td>{event.description}</td></tr>)}</tbody></table></div><p className="hint" data-testid="tracking-events">共 {tracking.events.length} 条追踪事件，按时间正序。</p></div></section>}
    </>}
  </div>;
}
