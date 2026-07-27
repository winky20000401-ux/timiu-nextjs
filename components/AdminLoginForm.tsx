"use client";

import { FormEvent, useState } from "react";

export function AdminLoginForm({ returnTo }: { returnTo: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/auth/request-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await response.json() as { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) return setMessage(result.error ?? "验证码发送失败");
    setMessage(result.message ?? "验证码已发送");
    setPhase("code");
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/auth/verify-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(result.error ?? "登录失败");
    window.location.assign(returnTo);
  }

  return (
    <div className="admin-login-card">
      <div className="login-mark">TIMIU</div>
      <h1>管理员登录</h1>
      <p>验证码只发送给管理员白名单中的邮箱，10 分钟内有效。</p>
      {phase === "email" ? (
        <form onSubmit={requestCode}>
          <label htmlFor="admin-email">管理员邮箱</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
          <button className="primary-button" disabled={busy}>{busy ? "正在发送…" : "发送验证码"}</button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <label htmlFor="admin-code">六位验证码</label>
          <input
            id="admin-code"
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
          />
          <button className="primary-button" disabled={busy}>{busy ? "正在验证…" : "登录后台"}</button>
          <button className="text-button" type="button" onClick={() => { setPhase("email"); setCode(""); setMessage(""); }}>更换邮箱</button>
        </form>
      )}
      {message && <p className="login-message" role="status">{message}</p>}
      <p className="muted">登录会话保存在安全的 HttpOnly Cookie 中，有效期 7 天。</p>
    </div>
  );
}
