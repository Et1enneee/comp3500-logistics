import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashToken, SESSION_COOKIE, type SessionUser } from "@/lib/auth";

export interface PageSession {
  user: SessionUser;
  csrfToken: string;
}

/** Page-side session read (same Session table and expiry rules as the API). */
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

/** Not signed in redirects to the sign-in page; a role mismatch returns null and the page renders a 403 notice. */
export async function requirePageRole(roles: SessionUser["role"][]): Promise<PageSession | null> {
  const session = await getPageSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.user.role)) return null;
  return session;
}

/** Routes the home page by role. */
export function homePathForRole(role: SessionUser["role"]): string {
  if (role === "STAFF") return "/staff";
  if (role === "ADMIN") return "/admin";
  if (role === "DRIVER") return "/driver";
  return "/";
}
