import { test } from "node:test";
import assert from "node:assert/strict";
import { apiRequest, createTestDatabase, createTestSession, createUsers, expectApiError } from "./harness";
import { createAuthHandlers } from "../lib/auth-api";
import { createOrderHandlers } from "../lib/order-api";
import { hashPassword, hashToken, readCookie, resetLoginRateLimit, SESSION_COOKIE, verifyPassword } from "../lib/auth";

test("Authentication & session / real isolated SQLite", { timeout: 180000 }, async t => {
  const { db, dispose } = await createTestDatabase("auth");
  try {
    resetLoginRateLimit();
    const users = await createUsers(db);
    const auth = createAuthHandlers(db);
    const orders = createOrderHandlers(db);
    const login = (body: unknown, headers: Record<string, string> = {}) =>
      auth.login(apiRequest("http://localhost/api/v1/auth/login", { method: "POST", body, headers }));

    await t.test("password hashing: scrypt format, per-user salt, plaintext never stored", async () => {
      const stored = await db.user.findUniqueOrThrow({ where: { id: users.customerA.id } });
      assert.match(stored.passwordHash, /^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
      assert.equal(stored.passwordHash.includes("Demo1234!"), false);
      assert.ok(verifyPassword("Demo1234!", stored.passwordHash));
      assert.equal(verifyPassword("wrong", stored.passwordHash), false);
      const again = hashPassword("Demo1234!");
      assert.notEqual(again, stored.passwordHash, "salt must differ between hashes");
      // 已知不支持的格式返回 false，而不是抛异常
      assert.equal(verifyPassword("x", "demo"), false);
      assert.equal(verifyPassword("x", ""), false);
    });

    await t.test("login success sets HttpOnly SameSite cookie and returns no secrets", async () => {
      const response = await login({ email: users.customerA.email, password: "Demo1234!" });
      assert.equal(response.status, 200);
      const cookie = response.headers.get("set-cookie") ?? "";
      assert.match(cookie, new RegExp(`${SESSION_COOKIE}=`));
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Max-Age=\d+/);
      assert.equal(cookie.includes("Secure"), false, "local HTTP demo must remain usable");
      const data = await response.json();
      assert.equal(data.user.email, users.customerA.email);
      assert.equal(data.user.role, "CUSTOMER");
      assert.equal(typeof data.csrfToken, "string");
      const text = JSON.stringify(data);
      assert.equal(text.includes("passwordHash"), false);
      assert.equal(text.includes("Demo1234!"), false);
      assert.equal(text.includes("scrypt$"), false);
      // 会话表里只有 token 的 SHA-256，没有原始 token
      const rawToken = decodeURIComponent((cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`)) ?? [])[1] ?? "");
      assert.ok(rawToken.length > 20);
      const stored = await db.session.findMany({ where: { userId: users.customerA.id } });
      assert.ok(stored.every(session => session.tokenHash !== rawToken));
    });

    await t.test("wrong password / unknown user => same 401 message; no session created", async () => {
      const before = await db.session.count();
      const wrong = await login({ email: users.customerA.email, password: "bad-password" });
      const unknown = await login({ email: "ghost@test.local", password: "Demo1234!" });
      const wrongBody = await expectApiError(wrong, 401, "UNAUTHENTICATED");
      const unknownBody = await expectApiError(unknown, 401, "UNAUTHENTICATED");
      assert.equal(wrongBody.error.message, unknownBody.error.message);
      assert.equal(await db.session.count(), before);
    });

    await t.test("missing fields => 400; wrong content type => 400", async () => {
      await expectApiError(await login({}), 400, "INVALID_ARGUMENT");
      await expectApiError(await login({ email: users.customerA.email }), 400, "INVALID_ARGUMENT");
      const wrongType = await auth.login(apiRequest("http://localhost/api/v1/auth/login", {
        method: "POST", rawBody: JSON.stringify({ email: users.customerA.email, password: "Demo1234!" }), contentType: "text/plain",
      }));
      await expectApiError(wrongType, 400, "INVALID_ARGUMENT");
    });

    await t.test("cross-origin login is rejected", async () => {
      const response = await login(
        { email: users.customerA.email, password: "Demo1234!" },
        { origin: "https://evil.example", host: "localhost" },
      );
      await expectApiError(response, 403, "CSRF_INVALID");
    });

    await t.test("me returns identity + CSRF; unauthenticated 401", async () => {
      const response = await auth.me(apiRequest("http://localhost/api/v1/auth/me", { session: users.customerA.session }));
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.user.email, users.customerA.email);
      assert.equal(data.csrfToken, users.customerA.session.csrf);
      assert.equal(JSON.stringify(data).includes("passwordHash"), false);
      await expectApiError(await auth.me(apiRequest("http://localhost/api/v1/auth/me")), 401, "UNAUTHENTICATED");
    });

    await t.test("expired session is rejected and deleted", async () => {
      const expired = await createTestSession(db, users.customerA.id, { expiresAt: new Date(Date.now() - 1000) });
      const response = await orders.listOrders(apiRequest("http://localhost/api/v1/orders", { session: expired }));
      await expectApiError(response, 401, "UNAUTHENTICATED");
      assert.equal(await db.session.count({ where: { tokenHash: hashToken(expired.token) } }), 0);
    });

    await t.test("forged token / tampered cookie => 401", async () => {
      const forged = { cookie: `${SESSION_COOKIE}=totally-made-up`, csrf: "x", token: "x" };
      await expectApiError(await orders.listOrders(apiRequest("http://localhost/api/v1/orders", { session: forged })), 401, "UNAUTHENTICATED");
    });

    await t.test("malformed session Cookie yields 401 for reads/writes and safe logout", async () => {
      const count = await db.order.count();
      for (const value of ["%", "%ZZ", "%E0%A4%A", "%C0%AF"]) {
        const headers = { cookie: `${SESSION_COOKIE}=${value}` };
        await expectApiError(await auth.me(apiRequest("http://localhost/api/v1/auth/me", { headers })), 401, "UNAUTHENTICATED");
        await expectApiError(await orders.listOrders(apiRequest("http://localhost/api/v1/orders", { headers })), 401, "UNAUTHENTICATED");
        await expectApiError(await orders.updateStatus(apiRequest("http://localhost/api/v1/orders/x/status", { method: "PATCH", headers, body: { to: "CONFIRMED" } }), "x"), 401, "UNAUTHENTICATED");
        const logout = await auth.logout(apiRequest("http://localhost/api/v1/auth/logout", { method: "POST", headers }));
        assert.equal(logout.status, 200);
        assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/);
      }
      assert.equal(await db.order.count(), count);
    });

    await t.test("logout deletes server session; cookie reused afterwards => 401", async () => {
      const session = await createTestSession(db, users.customerB.id);
      const response = await auth.logout(apiRequest("http://localhost/api/v1/auth/logout", { method: "POST", session }));
      assert.equal(response.status, 200);
      assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
      assert.equal(await db.session.count({ where: { tokenHash: hashToken(session.token) } }), 0);
      await expectApiError(await orders.listOrders(apiRequest("http://localhost/api/v1/orders", { session })), 401, "UNAUTHENTICATED");
    });

    await t.test("logout storage failure is reported and retry invalidates the session", async () => {
      const session = await createTestSession(db, users.customerB.id);
      await db.$executeRawUnsafe("CREATE TRIGGER reject_session_delete BEFORE DELETE ON Session BEGIN SELECT RAISE(ABORT, 'injected logout failure'); END");
      try {
        const response = await auth.logout(apiRequest("http://localhost/api/v1/auth/logout", { method: "POST", session }));
        assert.equal(response.status, 500);
        assert.equal(response.headers.has("set-cookie"), false);
        assert.equal(await db.session.count({ where: { tokenHash: hashToken(session.token) } }), 1);
      } finally {
        await db.$executeRawUnsafe("DROP TRIGGER reject_session_delete");
      }
      const retry = await auth.logout(apiRequest("http://localhost/api/v1/auth/logout", { method: "POST", session }));
      assert.equal(retry.status, 200);
      assert.equal(await db.session.count({ where: { tokenHash: hashToken(session.token) } }), 0);
    });

    await t.test("logout without CSRF token => 403 and session survives", async () => {
      const session = await createTestSession(db, users.customerB.id);
      const response = await auth.logout(apiRequest("http://localhost/api/v1/auth/logout", { method: "POST", session, csrf: null }));
      await expectApiError(response, 403, "CSRF_INVALID");
      assert.equal(await db.session.count({ where: { tokenHash: hashToken(session.token) } }), 1);
    });

    await t.test("role matrix: ADMIN cannot write orders or stock; STAFF cannot read reports", async () => {
      await expectApiError(await orders.updateStatus(apiRequest("http://localhost/api/v1/orders/x/status", {
        method: "PATCH", body: { to: "CONFIRMED" }, session: users.admin.session,
      }), "x"), 403, "FORBIDDEN");
      await expectApiError(await orders.listOrders(apiRequest("http://localhost/api/v1/orders", { session: users.admin.session })), 403, "FORBIDDEN");
    });

    await t.test("login rate limit blocks after 5 failures for the same account", async () => {
      resetLoginRateLimit();
      const email = users.customerB.email;
      for (let attempt = 0; attempt < 5; attempt++) {
        const response = await login({ email, password: "wrong" });
        assert.equal(response.status, 401);
      }
      const blocked = await login({ email, password: "Demo1234!" });
      await expectApiError(blocked, 429, "RATE_LIMITED");
      resetLoginRateLimit();
      const ok = await login({ email, password: "Demo1234!" });
      assert.equal(ok.status, 200);
    });

    await t.test("rotating forwarded headers cannot evade the account limit", async () => {
      resetLoginRateLimit();
      for (let attempt = 0; attempt < 7; attempt++) {
        const response = await login({ email: `  ${users.customerA.email.toUpperCase()}  `, password: "wrong" }, {
          "x-forwarded-for": `198.51.100.${attempt + 1}`,
          "x-real-ip": `203.0.113.${attempt + 1}`,
        });
        assert.equal(response.status, attempt < 5 ? 401 : 429);
      }
      assert.equal((await login({ email: users.customerA.email, password: "Demo1234!" })).status, 429);
      assert.equal((await login({ email: users.customerB.email, password: "Demo1234!" })).status, 200, "other accounts remain usable");
      resetLoginRateLimit();
    });

    await t.test("cookie parsing tolerates multiple cookies", async () => {
      const request = apiRequest("http://localhost", {
        headers: { cookie: `theme=dark; ${users.customerA.session.cookie}; other=1` },
      });
      assert.equal(readCookie(request, SESSION_COOKIE) !== null, true);
    });
  } finally {
    await dispose();
  }
});
