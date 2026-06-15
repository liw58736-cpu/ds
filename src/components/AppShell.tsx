import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

const topNavItems = [
  { label: "工作台", active: true },
  { label: "模板库", active: false },
  { label: "历史任务", active: false },
  { label: "价格", active: false },
  { label: "账户", active: false },
];

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <h1>Commerce Studio</h1>
          <p>跨境电商生图工作台</p>
        </div>
        <nav className="topnav" aria-label="主导航">
          {topNavItems.map((item) => (
            <button
              type="button"
              key={item.label}
              className={`topnav-button${item.active ? " is-active" : ""}`}
              disabled={!item.active}
              aria-current={item.active ? "page" : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
