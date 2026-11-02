"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("customer.a@demo.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error?.message || `Sign-in failed (HTTP ${response.status}). Please try again.`);
        return;
      }
      const role = data?.user?.role as "CUSTOMER" | "STAFF" | "ADMIN" | undefined;
      if (nextPath && nextPath.startsWith("/")) {
        router.replace(nextPath);
      } else {
        router.replace(role === "STAFF" ? "/staff" : role === "ADMIN" ? "/admin" : "/");
      }
      router.refresh();
    } catch {
      setError("Could not reach the server; the sign-in result is unknown. Please refresh the page and try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="stack">
      {error && <div className="feedback error" role="alert" style={{ margin: 0 }}><strong>Sign-in failed</strong><p>{error}</p></div>}
      <div>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          disabled={busy}
          onChange={event => setEmail(event.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      <div>
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          disabled={busy}
          onChange={event => setPassword(event.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      <button className="primary full" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign In"}
      </button>
      <p className="hint">The session is stored in an HttpOnly cookie and expires after 8 hours; it becomes invalid immediately after sign-out.</p>
    </form>
  );
}
