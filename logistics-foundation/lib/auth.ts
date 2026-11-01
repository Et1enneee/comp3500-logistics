import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

// 密码哈希使用 Node 内置的 scrypt（成熟 KDF），不自行设计算法，也不新增加密依赖。
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LENGTH = 64;

export type Role = "CUSTOMER" | "STAFF" | "ADMIN";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface SessionInfo {
  id: string;
  csrfToken: string;
  expiresAt: Date;
}

export const SESSION_COOKIE = "g42_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 小时
export const CSRF_HEADER = "x-csrf-token";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p });
  return `scrypt$${SCRYPT_N}$${SCRYPT_r}$${SCRYPT_p}$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expected = Buffer.from(parts[5], "hex");
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || expected.length === 0) return false;
  let derived: Buffer;
  try {
    derived = scryptSync(password, salt, expected.length, { N: n, r, p });
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 读取 Cookie 头的单个值，无则返回 null。 */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      try { return decodeURIComponent(part.slice(index + 1).trim()); }
      catch { return null; }
    }
  }
  return null;
}

export function isHttpsRequest(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sessionCookie(req: Request, token: string, expiresAt: Date): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  // 本机 HTTP 演示不加 Secure，否则浏览器不会保存；HTTPS 下自动加上。
  if (isHttpsRequest(req)) parts.push("Secure");
  return parts.join("; ");
}

export function expiredSessionCookie(req: Request): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isHttpsRequest(req)) parts.push("Secure");
  return parts.join("; ");
}

export async function createSession(db: PrismaClient, userId: string): Promise<{ token: string; csrfToken: string; expiresAt: Date }> {
  const token = newToken();
  const csrfToken = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { tokenHash: hashToken(token), csrfToken, userId, expiresAt } });
  return { token, csrfToken, expiresAt };
}

export interface Authenticated {
  user: SessionUser;
  session: SessionInfo;
}

/** 从请求 Cookie 解析会话；过期会话会被删除并视为未登录。 */
export async function readSession(db: PrismaClient, req: Request): Promise<Authenticated | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const row = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: row.id } }).catch(() => undefined);
    return null;
  }
  return {
    user: row.user as SessionUser,
    session: { id: row.id, csrfToken: row.csrfToken, expiresAt: row.expiresAt },
  };
}

export async function destroySession(db: PrismaClient, sessionId: string): Promise<void> {
  // 并发退出已删除的会话可视为成功；实际存储失败必须反馈给调用者。
  await db.session.deleteMany({ where: { id: sessionId } });
}

// 按规范化邮箱计数，客户端更换代理来源头不能重置账户的失败次数。
// 进程内限制：重启/多进程的边界见 known-issues.md。
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const loginFailures = new Map<string, { count: number; resetAt: number }>();

export function loginAttemptKey(email: string): string {
  return email.trim().toLowerCase();
}

export function isLoginBlocked(key: string, now = Date.now()): boolean {
  const entry = loginFailures.get(key);
  if (!entry) return false;
  if (entry.resetAt <= now) {
    loginFailures.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const entry = loginFailures.get(key);
  if (!entry || entry.resetAt <= now) {
    loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(key: string): void {
  loginFailures.delete(key);
}

/** 仅用于测试：清空限流状态。 */
export function resetLoginRateLimit(): void {
  loginFailures.clear();
}
