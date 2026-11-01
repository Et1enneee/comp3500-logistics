import type { PrismaClient } from "@prisma/client";
import {
  clearLoginFailures,
  createSession,
  destroySession,
  expiredSessionCookie,
  isLoginBlocked,
  loginAttemptKey,
  readSession,
  recordLoginFailure,
  sessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { errorResponse, failure, HttpError, readJsonBody } from "@/lib/http";

/**
 * 认证 HTTP 处理器（可注入 db，便于真实 SQLite 集成测试）。
 * 安全要点：scrypt 校验、统一错误提示防枚举、登录限流、HttpOnly Cookie、CSRF。
 */
export function createAuthHandlers(db: PrismaClient) {
  async function login(req: Request): Promise<Response> {
    const origin = req.headers.get("origin");
    if (origin) {
      const host = req.headers.get("host");
      try {
        if (host && new URL(origin).host !== host) {
          return errorResponse(403, "CSRF_INVALID", "跨站登录请求已被拒绝");
        }
      } catch {
        return errorResponse(403, "CSRF_INVALID", "请求来源无法识别");
      }
    }
    try {
      const body = await readJsonBody(req);
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!email || !password) throw new HttpError(400, "INVALID_ARGUMENT", "请输入邮箱和密码");

      const key = loginAttemptKey(email);
      if (isLoginBlocked(key)) throw new HttpError(429, "RATE_LIMITED", "登录尝试过于频繁，请 10 分钟后再试");

      const user = await db.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, role: true, passwordHash: true },
      });
      // 用户不存在与密码错误返回同一提示，避免邮箱枚举。
      const valid = user ? verifyPassword(password, user.passwordHash) : false;
      if (!user || !valid) {
        recordLoginFailure(key);
        throw new HttpError(401, "UNAUTHENTICATED", "邮箱或密码不正确");
      }
      clearLoginFailures(key);
      const session = await createSession(db, user.id);
      return Response.json(
        {
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
          csrfToken: session.csrfToken,
          expiresAt: session.expiresAt.toISOString(),
        },
        {
          status: 200,
          headers: {
            "set-cookie": sessionCookie(req, session.token, session.expiresAt),
            "cache-control": "no-store",
          },
        },
      );
    } catch (error) {
      return failure(error, "Login unexpected failure");
    }
  }

  async function logout(req: Request): Promise<Response> {
    try {
      const authenticated = await readSession(db, req);
      if (authenticated) {
        const token = req.headers.get("x-csrf-token");
        if (token !== authenticated.session.csrfToken) {
          throw new HttpError(403, "CSRF_INVALID", "写请求缺少有效的防跨站令牌，请刷新页面后重试");
        }
        await destroySession(db, authenticated.session.id);
      }
      return Response.json(
        { ok: true },
        { status: 200, headers: { "set-cookie": expiredSessionCookie(req), "cache-control": "no-store" } },
      );
    } catch (error) {
      return failure(error, "Logout unexpected failure");
    }
  }

  async function me(req: Request): Promise<Response> {
    try {
      const authenticated = await readSession(db, req);
      if (!authenticated) throw new HttpError(401, "UNAUTHENTICATED", "请先登录");
      return Response.json(
        {
          user: authenticated.user,
          csrfToken: authenticated.session.csrfToken,
          expiresAt: authenticated.session.expiresAt.toISOString(),
        },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (error) {
      return failure(error, "Me unexpected failure");
    }
  }

  return { login, logout, me };
}
