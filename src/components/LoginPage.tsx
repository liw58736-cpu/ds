import { useState } from "react";
import type { FormEvent } from "react";
import type { AppPage } from "./AppShell";
import { loginOrRegister } from "../api/accountApi";
import kromaLogo from "../assets/brand/kroma-logo.png";

type LegalTarget = Extract<AppPage, "terms" | "privacy">;

interface LoginPageProps {
  onOpenLegal: (page: LegalTarget) => void;
}

export function LoginPage({ onOpenLegal }: LoginPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState("使用手机号或邮箱登录，保存积分、订单和历史任务。");
  const [messageType, setMessageType] = useState<"status" | "alert">("status");

  const showStatus = (nextMessage: string) => {
    setMessage(nextMessage);
    setMessageType("status");
  };

  const showError = (nextMessage: string) => {
    setMessage(nextMessage);
    setMessageType("alert");
  };

  const handleSendCode = () => {
    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier) {
      showError("请输入手机号或邮箱后再获取验证码。");
      return;
    }

    showStatus(`验证码已发送至 ${normalizedIdentifier}，请查看短信或邮箱。`);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedIdentifier = identifier.trim();
    const normalizedCode = code.trim();

    if (!normalizedIdentifier) {
      showError("请输入手机号或邮箱。");
      return;
    }

    if (!normalizedCode) {
      showError("请输入验证码。");
      return;
    }

    if (!agreed) {
      showError("请先同意服务条款和隐私政策。");
      return;
    }

    try {
      const account = await loginOrRegister({
        identifier: normalizedIdentifier,
        credential: normalizedCode,
        authView: "login",
        mode: "code",
        storeName: "",
        inviteCode: "",
        createdAt: new Date().toISOString(),
      });

      if (account.session?.provider === "kroma") {
        showStatus("登录成功，已同步账户积分。");
        return;
      }

      showStatus(`已为 ${normalizedIdentifier} 创建当前会话，积分与历史任务会在此账户下保存。`);
    } catch (error) {
      showError(
        error instanceof Error
          ? `登录失败：${error.message}`
          : "登录失败，请检查账户后重试。",
      );
    }
  };

  return (
    <main className="login-page page-surface">
      <section className="login-card panel" aria-labelledby="login-title">
        <div className="login-card-header">
          <div className="login-logo-row">
            <img className="login-brand-mark" src={kromaLogo} alt="kroma logo" />
            <div>
              <p className="eyebrow">Secure Access</p>
              <h1 id="login-title">登录</h1>
            </div>
          </div>
          <p>登录后同步积分、订单和历史任务。</p>
        </div>

        <form className="login-form" aria-label="登录表单" onSubmit={handleSubmit}>
          <label className="field login-field">
            <span>手机号或邮箱</span>
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              placeholder="seller@example.com"
            />
          </label>

          <div className="login-code-row">
            <label className="field login-field">
              <span>验证码</span>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="one-time-code"
                placeholder="6 位验证码"
              />
            </label>
            <button
              type="button"
              className="secondary-button"
              onClick={handleSendCode}
            >
              获取验证码
            </button>
          </div>

          <div className="login-agreement">
            <label>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>我已阅读并同意</span>
            </label>
            <button type="button" onClick={() => onOpenLegal("terms")}>
              服务条款
            </button>
            <span>和</span>
            <button type="button" onClick={() => onOpenLegal("privacy")}>
              隐私政策
            </button>
          </div>

          <p
            className={`login-message ${messageType === "alert" ? "is-error" : ""}`}
            role={messageType}
          >
            {message}
          </p>

          <button type="submit" className="primary-button login-submit">
            登录 kroma
          </button>
        </form>
      </section>
    </main>
  );
}
