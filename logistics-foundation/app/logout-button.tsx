"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton({ csrfToken }: { csrfToken: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (!response.ok) throw new Error("退出失败，服务暂不可用，请重试。");
      router.replace("/login");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error && reason.message.startsWith("退出失败") ? reason.message : "退出失败，请检查网络后重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, maxWidth: "100%" }}>
      <button type="button" onClick={logout} disabled={busy} className="small">
      {busy ? "正在退出…" : "退出登录"}
      </button>
      {error && <span role="alert" className="small" style={{ color: "var(--danger)", maxWidth: 240 }}>{error}</span>}
    </span>
  );
}
