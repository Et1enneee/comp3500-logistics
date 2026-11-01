import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashToken, SESSION_COOKIE, type SessionUser } from "@/lib/auth";

export interface PageSession {
  user: SessionUser;
  csrfToken: string;
}

/** 页面侧读取会话（与 API 同一张 Session 表、同一过期规则）。 */
export async function getPageSession(): Promise<PageSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  return { user: row.user as SessionUser, csrfToken: row.csrfToken };
}

/** 未登录跳转登录页；角色不符返回 null，由页面渲染 403 提示。 */
export async function requirePageRole(roles: SessionUser["role"][]): Promise<PageSession | null> {
  const session = await getPageSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.user.role)) return null;
  return session;
}

/** 首页按角色分流。 */
export function homePathForRole(role: SessionUser["role"]): string {
  if (role === "STAFF") return "/staff";
  if (role === "ADMIN") return "/admin";
  return "/";
}
