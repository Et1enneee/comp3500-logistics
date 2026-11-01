import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { getPageSession } from "@/lib/page-auth";
import LogoutButton from "./logout-button";
import { version } from "../package.json";

export const metadata: Metadata = {
  title: "物流管理 · Group 42",
  description: "Group 42 · 下单、确认、拣货、发货、追踪、取消、库存与运营报表",
};

const ROLE_LABEL: Record<string, string> = { CUSTOMER: "客户", STAFF: "员工", ADMIN: "管理员" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getPageSession();
  // 客户导航显示未读通知数（服务端读取，不依赖前端缓存）。
  const unread = session && session.user.role === "CUSTOMER"
    ? await prisma.notification.count({ where: { userId: session.user.id, read: false } })
    : 0;
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link href={session ? (session.user.role === "STAFF" ? "/staff" : session.user.role === "ADMIN" ? "/admin" : "/") : "/login"} className="brand">
              <span className="brand-mark" aria-hidden="true">L</span>
              <span>物流管理<span className="brand-sub">GROUP 42 / v{version}</span></span>
            </Link>
            <nav aria-label="主要导航" className="nav-links">
              {!session && <Link href="/login">登录</Link>}
              {session?.user.role === "CUSTOMER" && (
                <>
                  <Link href="/">商品与下单</Link>
                  <Link href="/orders">我的订单</Link>
                  <Link href="/notifications">
                    通知{unread > 0 && <span className="nav-badge" aria-label={`${unread} 条未读`}>{unread}</span>}
                  </Link>
                </>
              )}
              {session?.user.role === "STAFF" && (
                <>
                  <Link href="/staff">订单工作台</Link>
                  <Link href="/inventory">库存与流水</Link>
                </>
              )}
              {session?.user.role === "ADMIN" && (
                <>
                  <Link href="/admin">运营报表</Link>
                  <Link href="/inventory">库存（只读）</Link>
                </>
              )}
            </nav>
            {session && (
              <div className="identity">
                <span className="role-chip">{ROLE_LABEL[session.user.role]}</span>
                <span>{session.user.name} · {session.user.email}</span>
                <LogoutButton csrfToken={session.csrfToken} />
              </div>
            )}
          </div>
        </header>
        <div className="demo-banner">
          <span className="demo-label">本地演示</span>
          真实会话登录（HttpOnly Cookie），不再使用可伪造的演示请求头；物流为本地模拟，未接入真实承运商 API 或 GPS。时间统一按 GMT+8 展示。
        </div>
        {children}
        <footer className="site-footer">
          COMP 3500SEF · Group 42
          <span>真实 SQLite 数据库 · 服务端授权 · 不用于生产环境</span>
        </footer>
      </body>
    </html>
  );
}
