import { useEffect, useState } from "react";
import {
  getAccountTransactions,
  type AccountTransaction,
  getCurrentAccountSnapshot,
  getCurrentAccountWithCreditSync,
} from "../api/accountApi";
import type { AccountCreditSyncStatus } from "../api/accountApi";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

interface AccountPageProps {
  paymentStatus?: string | null;
  onLogout?: () => void;
}

export function AccountPage({ paymentStatus, onLogout }: AccountPageProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [ledgerError, setLedgerError] = useState("");
  const [account, setAccount] = useState(() => getCurrentAccountSnapshot());
  const [creditSyncStatus, setCreditSyncStatus] =
    useState<AccountCreditSyncStatus>(() =>
      getCurrentAccountSnapshot().session ? "cloud_sync_failed" : "trial",
    );

  const refresh = async () => {
    setLoading(true);
    setLedgerError("");
    const [balance, ledger] = await Promise.allSettled([
      getCurrentAccountWithCreditSync(),
      getAccountTransactions(),
    ]);
    if (balance.status === "fulfilled") {
      setAccount(balance.value.account);
      setCreditSyncStatus(balance.value.creditSyncStatus);
    }
    if (ledger.status === "fulfilled") setTransactions(ledger.value);
    else setLedgerError("记录暂时无法读取，可稍后刷新。");
    setLoading(false);
  };
  useEffect(() => {
    void refresh();
  }, []);

  const isCloudAccount = Boolean(account.session?.provider === "kroma");
  const balanceLabel = isCloudAccount ? "云端积分余额" : "试用积分余额";
  const balanceNote = loading
    ? "正在同步余额…"
    : creditSyncStatus === "cloud"
      ? "当前显示网页端云端积分余额。"
      : creditSyncStatus === "cloud_sync_failed"
        ? "余额暂未同步，当前显示上次余额；请刷新重试。"
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
        {account.session ? (
          <div className="account-session-card">
            <div>
              <p className="summary-label">{"当前登录邮箱"}</p>
              <p className="summary-value account-email">
                {account.session.identifier}
              </p>
              <p className="summary-note">
                {"当前账号的积分、订单和历史任务会记录在这个邮箱下。"}
              </p>
            </div>
            <button
              type="button"
              className="secondary-button account-logout-button"
              onClick={onLogout}
            >
              {"退出登录"}
            </button>
          </div>
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
      </section>
      <section className="panel account-ledger">
        <div className="library-toolbar">
          <h2>积分与订单记录</h2>
          <button
            type="button"
            className="secondary-button"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? "正在同步" : "刷新余额与记录"}
          </button>
        </div>
        {ledgerError ? <p role="status">{ledgerError}</p> : null}
        {transactions.length ? (
          <div className="ledger-table">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>内容</th>
                  <th>积分变化</th>
                  <th>订单 / 任务</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                    <td>{item.description}</td>
                    <td>
                      {item.amount > 0 ? "+" : ""}
                      {item.amount}
                    </td>
                    <td>{item.reference_id || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !loading && !ledgerError ? (
          <p>暂无积分变动记录。</p>
        ) : null}
      </section>
    </main>
  );
}
