import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <section className="card empty" role="alert">
        <strong>404 · 未找到该页面</strong>
        <p>链接可能已失效，或该订单不属于当前账号（出于隐私，不对他人订单泄露是否存在）。</p>
        <p><Link className="button" href="/">返回首页</Link></p>
      </section>
    </main>
  );
}
