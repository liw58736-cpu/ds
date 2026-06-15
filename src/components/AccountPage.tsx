export function AccountPage() {
  return (
    <main className="page-surface">
      <div className="page-heading">
        <p className="eyebrow">Account</p>
        <h1>账户</h1>
      </div>
      <section className="account-panel">
        <h2>本地演示账户</h2>
        <p>当前为本地演示账户。</p>
        <p>
          当前任务、credits 和历史记录都保存在本地浏览器中。接入真实登录、配额和云端历史后，这里会显示正式账户状态和用量。
        </p>
      </section>
    </main>
  );
}
