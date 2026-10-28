import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: "物流管理 · 核心演示",
  description: "Group 42 · 下单、查询、确认、拣货、发货与追踪的本地演示基线",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>
    <header className="site-header"><div className="header-inner">
      <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">L</span><span>物流管理<span className="brand-sub">GROUP 42 / FOUNDATION v0.3.1</span></span></Link>
      <nav aria-label="主要导航"><Link href="/">客户下单</Link><Link href="/staff">员工工作台</Link></nav>
    </div></header>
    <div className="demo-banner"><span className="demo-label">本地演示</span>演示邮箱不是正式登录（可被冒用）；本地模拟，非真实认证。当前实现下单、查询、确认、拣货、发货与追踪；取消、通知、补货未实现。</div>
    {children}
    <footer className="site-footer">COMP 3500SEF · Group 42<span>真实数据库 · 模拟身份 · 不用于生产环境</span></footer>
  </body></html>;
}
