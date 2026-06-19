import { useEffect, useState } from "react";
import {
  getCurrentAccount,
  getCurrentAccountSnapshot,
} from "../api/accountApi";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function AccountPage() {
  const [account, setAccount] = useState(() => getCurrentAccountSnapshot());

  useEffect(() => {
    void getCurrentAccount().then(setAccount);
  }, []);

  const usageItems = [
    {
      label: "账户状态",
      value: account.session ? "已登录" : "试用中",
      note: account.session ? "当前会话已生效" : "登录后保存积分与任务记录",
    },
    {
      label: "积分余额",
      value: `${formatNumber(account.balance)} credits`,
      note: "价格页购买后自动到账",
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
        <div className="account-grid">
          {usageItems.map((item) => (
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
        <div className="account-ledger" aria-label="最近积分记录">
          <h3>最近积分记录</h3>
          {account.transactions.slice(0, 5).map((transaction) => (
            <article key={transaction.id}>
              <div>
                <strong>{transaction.label}</strong>
                <span>{transaction.note}</span>
              </div>
              <p className={transaction.amount >= 0 ? "is-positive" : "is-negative"}>
                {transaction.amount >= 0 ? "+" : ""}
                {formatNumber(transaction.amount)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
