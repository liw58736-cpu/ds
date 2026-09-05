import { useState } from "react";
import {
  requestPasswordRecovery,
  completePasswordRecovery,
} from "../api/accountApi";
export function PasswordResetForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      aria-label="找回密码"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        if (sent && (password !== confirm || password.length < 8)) {
          setMessage("两次密码需一致，且至少 8 位。");
          return;
        }
        setBusy(true);
        setMessage("");
        try {
          if (!sent) {
            await requestPasswordRecovery(email);
            setSent(true);
            setMessage("如果该邮箱已注册，验证码会发送至邮箱。");
          } else {
            await completePasswordRecovery(email, code, password);
            setSent(false);
            setCode("");
            setPassword("");
            setConfirm("");
            setMessage("密码已重置，请返回登录。");
          }
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "暂时无法处理，请重试。",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>找回密码</h2>
      <label className="field">
        邮箱
        <input
          type="email"
          required
          value={email}
          disabled={sent}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {sent ? (
        <>
          <label className="field">
            邮箱验证码
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="field">
            新密码
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            再次输入新密码
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        </>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <button className="primary-button" disabled={busy}>
        {busy ? "正在处理" : sent ? "验证并重置密码" : "发送找回验证码"}
      </button>
      <button type="button" className="secondary-button" onClick={onBack}>
        返回登录
      </button>
      {sent ? (
        <button
          type="button"
          className="secondary-button"
          onClick={() => setSent(false)}
        >
          重新发送 / 修改邮箱
        </button>
      ) : null}
    </form>
  );
}
