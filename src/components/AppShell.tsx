import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

const topNavItems = ["工作台", "模板库", "历史任务", "价格", "账户"];

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <h1>Commerce Studio</h1>
          <p>跨境电商生图工作台</p>
          <span className="sr-only">电商主图与详情页生成工作台</span>
        </div>
        <nav className="topnav" aria-label="主导航">
          {topNavItems.map((item) => (
            <button type="button" key={item} className="topnav-button">
              {item}
            </button>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
