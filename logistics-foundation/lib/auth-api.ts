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
 * Auth HTTP handlers (db is injectable for real-SQLite integration tests).
 * Security essentials: scrypt verification, a uniform error message to prevent enumeration,
 * login rate limiting, HttpOnly cookies, and CSRF protection.
 */
export function createAuthHandlers(db: PrismaClient) {
  async function login(req: Request): Promise<Response> {
    const origin = req.headers.get("origin");
    if (origin) {
      const host = req.headers.get("host");
      try {
        if (host && new URL(origin).host !== host) {
          return errorResponse(403, "CSRF_INVALID", "The cross-site sign-in request was rejected");
        }
      } catch {
        return errorResponse(403, "CSRF_INVALID", "The request origin could not be identified");
      }
    }
    try {
      const body = await readJsonBody(req);
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!email || !password) throw new HttpError(400, "INVALID_ARGUMENT", "Please enter both email and password");

      const key = loginAttemptKey(email);
      if (isLoginBlocked(key)) throw new HttpError(429, "RATE_LIMITED", "Too many sign-in attempts. Please try again in 10 minutes");

      const user = await db.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, role: true, passwordHash: true },
      });
      // A missing user and a wrong password return the same message to prevent email enumeration.
      const valid = user ? verifyPassword(password, user.passwordHash) : false;
      if (!user || !valid) {
        recordLoginFailure(key);
        throw new HttpError(401, "UNAUTHENTICATED", "Incorrect email or password");
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
          throw new HttpError(403, "CSRF_INVALID", "The write request lacks a valid anti-CSRF token. Please refresh the page and try again");
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
      if (!authenticated) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in first");
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
