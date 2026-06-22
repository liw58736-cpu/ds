import { useState } from "react";
import type { FormEvent } from "react";
import type { AppPage } from "./AppShell";
import { loginOrRegister, requestLoginCode } from "../api/accountApi";
import type { AuthView, LoginMode } from "../storage/accountStore";
import kromaLogo from "../assets/brand/kroma-logo.png";

type LegalTarget = Extract<AppPage, "terms" | "privacy">;

interface LoginPageProps {
  onOpenLegal: (page: LegalTarget) => void;
  onAuthenticated?: () => void;
}

const INITIAL_STATUS = "使用手机号或邮箱登录，保存积分、订单和历史任务。";
const EMAIL_VERIFICATION_MESSAGE = "请查看邮箱完成账户验证，验证后再返回登录。";

export function LoginPage({ onOpenLegal, onAuthenticated }: LoginPageProps) {
  const [authView, setAuthView] = useState<AuthView>("login");
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState(INITIAL_STATUS);
  const [messageType, setMessageType] = useState<"status" | "alert">("status");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = authView === "register";
  const activeMode: LoginMode = isRegister ? "password" : loginMode;
  const title = isRegister ? "注册" : "登录";
  const submitLabel = isSubmitting
    ? isRegister
      ? "\u6b63\u5728\u6ce8\u518c..."
      : "\u6b63\u5728\u767b\u5f55..."
    : `${title} kroma`;

  const showStatus = (nextMessage: string) => {
    setMessage(nextMessage);
    setMessageType("status");
  };

  const showError = (nextMessage: string) => {
    setMessage(nextMessage);
    setMessageType("alert");
  };

  const switchAuthView = (nextView: AuthView) => {
    if (isSubmitting) {
      return;
    }

    setAuthView(nextView);
    setLoginMode("password");
    setMessage(
      nextView === "register"
        ? "注册后即可同步积分、订单和历史任务。"
        : INITIAL_STATUS,
    );
    setMessageType("status");
  };

  const toggleLoginMode = () => {
    if (isSubmitting) {
      return;
    }

    const nextMode = activeMode === "password" ? "code" : "password";
    setLoginMode(nextMode);
    setMessage(
      nextMode === "code"
        ? "验证码登录仅用于快速进入当前会话。"
        : INITIAL_STATUS,
    );
    setMessageType("status");
  };

  const handleSendCode = async () => {
    if (isSubmitting) {
      return;
    }

    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier) {
      showError("请输入手机号或邮箱后再获取验证码。");
      return;
    }

    setIsSubmitting(true);
    showStatus("正在发送验证码，请稍候...");

    try {
      await requestLoginCode(normalizedIdentifier);
      showStatus(`验证码已发送至 ${normalizedIdentifier}，请查看短信或邮箱。`);
    } catch (error) {
      showError(
        error instanceof Error
          ? `验证码发送失败：${error.message}`
          : "验证码发送失败，请稍后重试。",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedIdentifier = identifier.trim();
    const normalizedPassword = password.trim();
    const normalizedCode = code.trim();
    const credential =
      activeMode === "password" ? normalizedPassword : normalizedCode;

    if (!normalizedIdentifier) {
      showError("请输入手机号或邮箱。");
      return;
    }

    if (!credential) {
      showError(activeMode === "password" ? "请输入密码。" : "请输入验证码。");
      return;
    }

    if (!agreed) {
      showError("请先同意服务条款和隐私政策。");
      return;
    }

    setIsSubmitting(true);
    showStatus(
      isRegister
        ? "\u6b63\u5728\u521b\u5efa\u8d26\u6237\uff0c\u8bf7\u7a0d\u5019..."
        : "\u6b63\u5728\u767b\u5f55\uff0c\u8bf7\u7a0d\u5019...",
    );

    try {
      const account = await loginOrRegister({
        identifier: normalizedIdentifier,
        credential,
        authView,
        mode: activeMode,
        storeName: "",
        inviteCode: "",
        createdAt: new Date().toISOString(),
      });

      if (account.session?.provider === "kroma") {
        onAuthenticated?.();
        showStatus(
          isRegister
            ? "注册成功，已同步账户积分。"
            : "登录成功，已同步账户积分。",
        );
        return;
      }

      showStatus(
        `已为 ${normalizedIdentifier} 创建当前会话，积分与历史任务会在此账户下保存。`,
      );
      onAuthenticated?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : `${title}失败，请检查账户后重试。`;

      if (isRegister && errorMessage.includes("请查看邮箱完成账户验证")) {
        showStatus(EMAIL_VERIFICATION_MESSAGE);
        return;
      }

      showError(
        error instanceof Error
          ? `${title}失败：${error.message}`
          : errorMessage,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page page-surface">
      <section className="login-card panel" aria-labelledby="login-title">
        <div className="login-card-header">
          <div className="login-logo-row">
            <img className="login-brand-mark" src={kromaLogo} alt="kroma logo" />
            <h1 id="login-title">{title}</h1>
          </div>
          <p>{isRegister ? "创建账户后开始管理积分和订单。" : "登录后同步积分、订单和历史任务。"}</p>
        </div>

        <div className="login-auth-switch" aria-label="账户操作">
          <button
            type="button"
            className={!isRegister ? "is-active" : ""}
            aria-pressed={!isRegister}
            onClick={() => switchAuthView("login")}
          >
            登录
          </button>
          <button
            type="button"
            className={isRegister ? "is-active" : ""}
            aria-pressed={isRegister}
            onClick={() => switchAuthView("register")}
          >
            注册
          </button>
        </div>

        <form className="login-form" aria-label={`${title}表单`} onSubmit={handleSubmit}>
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

          {activeMode === "password" ? (
            <label className="field login-field">
              <span>密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder="请输入密码"
              />
            </label>
          ) : (
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
                disabled={isSubmitting}
              >
                获取验证码
              </button>
            </div>
          )}

          {!isRegister ? (
            <button
              type="button"
              className="login-mode-toggle"
              onClick={toggleLoginMode}
            >
              {activeMode === "password" ? "使用验证码登录" : "使用密码登录"}
            </button>
          ) : null}

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

          <button
            type="submit"
            className="primary-button login-submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {submitLabel}
          </button>
        </form>
      </section>
    </main>
  );
}
