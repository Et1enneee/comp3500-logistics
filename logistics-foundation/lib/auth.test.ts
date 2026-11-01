import { describe, expect, it } from "vitest";
import {
  expiredSessionCookie,
  hashPassword,
  hashToken,
  isLoginBlocked,
  readCookie,
  recordLoginFailure,
  resetLoginRateLimit,
  sessionCookie,
  SESSION_COOKIE,
  verifyPassword,
} from "./auth";

function requestWith(headers: Record<string, string>) {
  return new Request("http://localhost/", { headers });
}

describe("密码哈希（scrypt）", () => {
  it("同一密码每次盐不同，但都能校验通过", () => {
    const first = hashPassword("Demo1234!");
    const second = hashPassword("Demo1234!");
    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("Demo1234!", first)).toBe(true);
    expect(verifyPassword("Demo1234!", second)).toBe(true);
  });

  it("错误密码与损坏哈希都返回 false，不抛异常", () => {
    const stored = hashPassword("correct-horse");
    expect(verifyPassword("wrong", stored)).toBe(false);
    expect(verifyPassword("x", "demo")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "scrypt$0$0$0$abc$def")).toBe(false);
  });

  it("哈希中不包含明文", () => {
    const stored = hashPassword("Secret-Value-42");
    expect(stored.includes("Secret-Value-42")).toBe(false);
  });
});

describe("会话 Cookie 与令牌", () => {
  it("本机 HTTP 不加 Secure，HTTPS 才加", () => {
    const http = sessionCookie(requestWith({}), "tok", new Date(Date.now() + 3600_000));
    expect(http).toContain("HttpOnly");
    expect(http).toContain("SameSite=Lax");
    expect(http).not.toContain("Secure");
    const https = sessionCookie(requestWith({ "x-forwarded-proto": "https" }), "tok", new Date(Date.now() + 3600_000));
    expect(https).toContain("Secure");
  });

  it("登出 Cookie 立即过期", () => {
    const cookie = expiredSessionCookie(requestWith({}));
    expect(cookie).toContain(`${SESSION_COOKIE}=;`);
    expect(cookie).toContain("Max-Age=0");
  });

  it("cookie 解析支持多个 Cookie", () => {
    const request = requestWith({ cookie: `a=1; ${SESSION_COOKIE}=abc%2Bdef; b=2` });
    expect(readCookie(request, SESSION_COOKIE)).toBe("abc+def");
    expect(readCookie(request, "missing")).toBeNull();
  });

  it.each(["%", "%ZZ", "%E0%A4%A", "%C0%AF"])("畸形 Cookie %s 按缺失处理", value => {
    const req = requestWith({ cookie: `theme=dark; ${SESSION_COOKIE}=${value}; other=1` });
    expect(readCookie(req, SESSION_COOKIE)).toBeNull();
  });

  it("数据库只保存 token 的 SHA-256", () => {
    const token = "raw-token-value";
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toBe(hashToken(token));
  });
});

describe("登录限流", () => {
  it("第 5 次失败后封锁，重置后恢复", () => {
    resetLoginRateLimit();
    const key = "ip|user@example.com";
    for (let attempt = 0; attempt < 4; attempt++) {
      recordLoginFailure(key);
      expect(isLoginBlocked(key)).toBe(false);
    }
    recordLoginFailure(key);
    expect(isLoginBlocked(key)).toBe(true);
    resetLoginRateLimit();
    expect(isLoginBlocked(key)).toBe(false);
  });
});
