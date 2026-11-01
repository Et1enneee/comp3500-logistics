"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkReadButton({ id, csrfToken, read }: { id: string; csrfToken: string; read: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  if (read) return <span className="tag">已读</span>;

  async function mark() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error?.message || `标记失败（HTTP ${response.status}）`);
        return;
      }
      router.refresh();
    } catch {
      setError("网络中断，标记结果未知。请刷新后重试。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <span className="inline-actions">
      <button className="small" onClick={mark} disabled={busy}>{busy ? "处理中…" : "标记已读"}</button>
      {error && <span className="small low" role="alert">{error}</span>}
    </span>
  );
}
