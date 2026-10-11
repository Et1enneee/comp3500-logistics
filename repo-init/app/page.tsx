"use client";

import { useState } from "react";

type P = { sku: string; name: string; priceCents: number; stock: number };

const PRODUCTS: P[] = [
  { sku: "SKU001", name: "矿泉水 500ml", priceCents: 150, stock: 100 },
  { sku: "SKU002", name: "杯面", priceCents: 450, stock: 60 },
  { sku: "SKU003", name: "口罩 50 只装", priceCents: 2500, stock: 40 },
  { sku: "SKU004", name: "A4 打印纸", priceCents: 3000, stock: 25 },
  { sku: "SKU005", name: "签字笔 12 支", priceCents: 1000, stock: 80 },
  { sku: "SKU006", name: "笔记本", priceCents: 1200, stock: 30 },
  { sku: "SKU007", name: "透明胶带", priceCents: 500, stock: 4 },
  { sku: "SKU008", name: "中号纸箱", priceCents: 800, stock: 50 },
  { sku: "SKU009", name: "5 号电池", priceCents: 1200, stock: 45 },
  { sku: "SKU010", name: "洗手液", priceCents: 1800, stock: 12 },
];

const ACCOUNTS = ["customer@demo.com", "staff@demo.com", "admin@demo.com"];

export default function Home() {
  const [email, setEmail] = useState(ACCOUNTS[0]);
  const [qty, setQty] = useState<Record<string, string>>({ SKU001: "2" });
  const [msg, setMsg] = useState("");

  const lines = PRODUCTS.map((p) => {
    const q = parseInt(qty[p.sku] ?? "0", 10) || 0;
    return { p, q };
  }).filter((x) => x.q > 0);

  const totalCents = lines.reduce((s, x) => s + x.p.priceCents * x.q, 0);

  async function submit() {
    setMsg("");
    const items = lines.map((x) => ({ sku: x.p.sku, quantity: x.q }));
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, items }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("下单成功！订单号：" + data.order.orderNumber + "，状态：已创建");
      } else {
        setMsg("下单失败：" + (data.error?.message ?? JSON.stringify(data)));
      }
    } catch {
      setMsg("没连上服务器：确认终端里 npm run dev 还在跑，然后刷新本页。");
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "24px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>物流管理系统 · 演示版</h1>
      <p>
        演示账号：
        <select value={email} onChange={(e) => setEmail(e.target.value)}>
          {ACCOUNTS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>SKU</th>
            <th style={th}>商品</th>
            <th style={th}>单价</th>
            <th style={th}>库存</th>
            <th style={th}>数量(填数字)</th>
          </tr>
        </thead>
        <tbody>
          {PRODUCTS.map((p) => (
            <tr key={p.sku}>
              <td style={td}>{p.sku}</td>
              <td style={td}>{p.name}</td>
              <td style={td}>{(p.priceCents / 100).toFixed(2)}</td>
              <td style={td}>{p.stock}</td>
              <td style={td}>
                <input
                  type="number"
                  min={0}
                  style={{ width: 70 }}
                  value={qty[p.sku] ?? ""}
                  onChange={(e) => setQty({ ...qty, [p.sku]: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 20, marginTop: 16 }}>
        合计：<b>¥{(totalCents / 100).toFixed(2)}</b>　
        <button onClick={submit} style={{ fontSize: 16, padding: "6px 18px" }}>
          提交订单
        </button>
      </p>
      {msg && (
        <p style={{ padding: 8, background: "#eef3ff", borderRadius: 6 }}>{msg}</p>
      )}
    </main>
  );
}

const th = { border: "1px solid #ccc", padding: 6, textAlign: "left" as const };
const td = { border: "1px solid #ccc", padding: 6 };
