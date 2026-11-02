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

describe("Password hashing (scrypt)", () => {
  it("the same password gets a different salt each time, but both verify", () => {
    const first = hashPassword("Demo1234!");
    const second = hashPassword("Demo1234!");
    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("Demo1234!", first)).toBe(true);
    expect(verifyPassword("Demo1234!", second)).toBe(true);
  });

  it("wrong passwords and corrupted hashes return false without throwing", () => {
    const stored = hashPassword("correct-horse");
    expect(verifyPassword("wrong", stored)).toBe(false);
    expect(verifyPassword("x", "demo")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "scrypt$0$0$0$abc$def")).toBe(false);
  });

  it("the hash never contains the plaintext", () => {
    const stored = hashPassword("Secret-Value-42");
    expect(stored.includes("Secret-Value-42")).toBe(false);
  });
});

describe("Session cookies and tokens", () => {
  it("local HTTP omits Secure; HTTPS adds it", () => {
    const http = sessionCookie(requestWith({}), "tok", new Date(Date.now() + 3600_000));
    expect(http).toContain("HttpOnly");
    expect(http).toContain("SameSite=Lax");
    expect(http).not.toContain("Secure");
    const https = sessionCookie(requestWith({ "x-forwarded-proto": "https" }), "tok", new Date(Date.now() + 3600_000));
    expect(https).toContain("Secure");
  });

  it("the logout cookie expires immediately", () => {
    const cookie = expiredSessionCookie(requestWith({}));
    expect(cookie).toContain(`${SESSION_COOKIE}=;`);
    expect(cookie).toContain("Max-Age=0");
  });

  it("cookie parsing handles multiple cookies", () => {
    const request = requestWith({ cookie: `a=1; ${SESSION_COOKIE}=abc%2Bdef; b=2` });
    expect(readCookie(request, SESSION_COOKIE)).toBe("abc+def");
    expect(readCookie(request, "missing")).toBeNull();
  });

  it.each(["%", "%ZZ", "%E0%A4%A", "%C0%AF"])("malformed cookie %s is treated as missing", value => {
    const req = requestWith({ cookie: `theme=dark; ${SESSION_COOKIE}=${value}; other=1` });
    expect(readCookie(req, SESSION_COOKIE)).toBeNull();
  });

  it("the database stores only the SHA-256 of the token", () => {
    const token = "raw-token-value";
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toBe(hashToken(token));
  });
});

describe("Login rate limiting", () => {
  it("blocks after the 5th failure and recovers after a reset", () => {
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
