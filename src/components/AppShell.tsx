import type { ReactNode } from "react";
import type { AppPage } from "../App";

interface AppShellProps {
  page: AppPage;
  onPageChange: (page: AppPage) => void;
  children: ReactNode;
}

const topNavItems = [
  { page: "workspace", label: "工作台" },
  { page: "templates", label: "模板库" },
  { page: "history", label: "历史任务" },
  { page: "pricing", label: "价格" },
  { page: "account", label: "账户" },
] satisfies Array<{ page: AppPage; label: string }>;

export function AppShell({ page, onPageChange, children }: AppShellProps) {
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
              key={item.page}
              className={`topnav-button${page === item.page ? " nav-active" : ""}`}
              onClick={() => onPageChange(item.page)}
              aria-current={page === item.page ? "page" : undefined}
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
