import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { getPageSession } from "@/lib/page-auth";
import LogoutButton from "./logout-button";
import { version } from "../package.json";

export const metadata: Metadata = {
  title: "Logistics Management · Group 42",
  description: "Group 42 · Ordering, confirmation, picking, shipping, tracking, cancellation, inventory and operations reports",
};

const ROLE_LABEL: Record<string, string> = { CUSTOMER: "Customer", STAFF: "Staff", ADMIN: "Administrator" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getPageSession();
  // Customer navigation shows the unread notification count (read server-side, no client cache).
  const unread = session && session.user.role === "CUSTOMER"
    ? await prisma.notification.count({ where: { userId: session.user.id, read: false } })
    : 0;
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link href={session ? (session.user.role === "STAFF" ? "/staff" : session.user.role === "ADMIN" ? "/admin" : "/") : "/login"} className="brand">
              <span className="brand-mark" aria-hidden="true">L</span>
              <span>Logistics Management<span className="brand-sub">GROUP 42 / v{version}</span></span>
            </Link>
            <nav aria-label="Primary navigation" className="nav-links">
              {!session && <Link href="/login">Sign In</Link>}
              {session?.user.role === "CUSTOMER" && (
                <>
                  <Link href="/">Products & Ordering</Link>
                  <Link href="/orders">My Orders</Link>
                  <Link href="/notifications">
                    Notifications{unread > 0 && <span className="nav-badge" aria-label={`${unread} unread`}>{unread}</span>}
                  </Link>
                </>
              )}
              {session?.user.role === "STAFF" && (
                <>
                  <Link href="/staff">Order Workbench</Link>
                  <Link href="/inventory">Inventory & Ledger</Link>
                </>
              )}
              {session?.user.role === "ADMIN" && (
                <>
                  <Link href="/admin">Operations Reports</Link>
                  <Link href="/inventory">Inventory (Read-only)</Link>
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
          <span className="demo-label">Local Demo</span>
          Real session login (HttpOnly cookie); the spoofable demo request header is no longer used. Logistics is simulated locally — no real carrier API or GPS is connected. All times are shown in GMT+8.
        </div>
        {children}
        <footer className="site-footer">
          COMP 3500SEF · Group 42
          <span>Real SQLite database · Server-side authorization · Not for production use</span>
        </footer>
      </body>
    </html>
  );
}
