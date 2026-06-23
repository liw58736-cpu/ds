import { useEffect, useState } from "react";
import {
  getCurrentAccountSnapshot,
  getCurrentAccountWithCreditSync,
  getWebBackendHealth,
} from "../api/accountApi";
import type { AccountCreditSyncStatus, WebBackendHealth } from "../api/accountApi";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

interface AccountPageProps {
  paymentStatus?: string | null;
}

export function AccountPage({ paymentStatus }: AccountPageProps) {
  const [account, setAccount] = useState(() => getCurrentAccountSnapshot());
  const [backendHealth, setBackendHealth] =
    useState<WebBackendHealth | null>(null);
  const [creditSyncStatus, setCreditSyncStatus] =
    useState<AccountCreditSyncStatus>(() =>
      getCurrentAccountSnapshot().session ? "cloud_sync_failed" : "trial",
    );

  useEffect(() => {
    void getCurrentAccountWithCreditSync().then((result) => {
      setAccount(result.account);
      setCreditSyncStatus(result.creditSyncStatus);
    });
    void getWebBackendHealth().then(setBackendHealth);
  }, []);

  const isCloudAccount = Boolean(account.session?.provider === "kroma");
  const balanceLabel = isCloudAccount ? "云端积分余额" : "试用积分余额";
  const balanceNote =
    creditSyncStatus === "cloud"
      ? "当前显示网页端云端积分余额。"
      : creditSyncStatus === "cloud_sync_failed"
        ? "已登录，云端余额暂时同步失败，请刷新后重试。"
        : "未登录时仅显示本机试用积分，登录后同步云端余额。";

  const usageItems = [
    {
      label: "账户状态",
      value: account.session ? "已登录" : "试用中",
      note: account.session
        ? isCloudAccount
          ? "当前使用 kroma 云端账号。"
          : "当前会话已生效。"
        : "登录后保存积分与任务记录。",
    },
    {
      label: balanceLabel,
      value: `${formatNumber(account.balance)} credits`,
      note: balanceNote,
    },
    {
      label: "历史保存",
      value: "任务记录",
      note: "生成结果与扣点记录集中查看",
    },
    {
      label: "计费策略",
      value: "成功后扣点",
      note: "失败任务不计成功消耗",
    },
  ];
  const systemItems = [
    {
      label: "账号服务",
      value: backendHealth
        ? backendHealth.config.supabaseUrl &&
          backendHealth.config.supabaseAnonKey &&
          backendHealth.config.supabaseServiceRoleKey &&
          backendHealth.config.resendApiKey &&
          backendHealth.database?.webUsers !== false &&
          backendHealth.database?.webAuthCodes !== false
          ? "正常"
          : "待配置"
        : "未连接",
      note: backendHealth
        ? "注册、登录和验证码服务状态"
        : "未检测到网页账号后端",
    },
    {
      label: "支付入账",
      value: backendHealth
        ? backendHealth.config.paddleWebhookSecret &&
          backendHealth.config.internalBillingKey &&
          backendHealth.database?.webBillingEvents !== false
          ? "正常"
          : "待配置"
        : "未连接",
      note: "Paddle 付款后自动入账",
    },
    {
      label: "真实生图",
      value: import.meta.env.VITE_KROMA_API_BASE_URL?.trim()
        ? "已连接"
        : "待配置",
      note: "未配置时生产环境不会使用模拟出图",
    },
  ];

  return (
    <main className="account-page page-surface">
      <section className="panel account-panel">
        <div className="panel-heading">
          <p className="eyebrow">Account</p>
          <h2>账户与用量</h2>
          <p>查看积分余额、套餐购买和最近扣点记录。</p>
        </div>
        {paymentStatus === "paddle-success" ? (
          <p className="account-payment-status" role="status">
            支付已完成，积分到账可能需要几秒钟，请刷新账户余额确认。
          </p>
        ) : null}
        <div className="account-grid">
          {usageItems.map((item) => (
            <article className="usage-card" key={item.label}>
              <p className="summary-label">{item.label}</p>
              <p className="summary-value">{item.value}</p>
              <p className="summary-note">{item.note}</p>
            </article>
          ))}
        </div>
        <div className="account-system-status" aria-label="系统状态">
          {systemItems.map((item) => (
            <article className="usage-card" key={item.label}>
              <p className="summary-label">{item.label}</p>
              <p className="summary-value">{item.value}</p>
              <p className="summary-note">{item.note}</p>
            </article>
          ))}
        </div>
        <p className="account-disclosure">
          生成成功后才会扣除积分；失败、取消或通道异常的任务不会计入成功消耗。
        </p>
      </section>
    </main>
  );
}
