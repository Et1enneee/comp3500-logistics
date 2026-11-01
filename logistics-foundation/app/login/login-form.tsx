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
      setError("请输入邮箱和密码。");
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
        setError(data?.error?.message || `登录失败（HTTP ${response.status}），请重试。`);
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
      setError("无法连接服务器，登录结果未知。请刷新页面后重试。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="stack">
      {error && <div className="feedback error" role="alert" style={{ margin: 0 }}><strong>登录未成功</strong><p>{error}</p></div>}
      <div>
        <label htmlFor="login-email">邮箱</label>
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
        <label htmlFor="login-password">密码</label>
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
        {busy ? "正在登录…" : "登录"}
      </button>
      <p className="hint">会话保存在 HttpOnly Cookie 中，8 小时过期；退出后立即失效。</p>
    </form>
  );
}
