import type { ReactNode } from "react";
import kromaLogo from "../assets/brand/kroma-logo.png";

export type AppPage =
  | "home"
  | "main_image"
  | "white_background"
  | "detail_page"
  | "history"
  | "pricing"
  | "account"
  | "login"
  | "terms"
  | "privacy"
  | "refund"
  | "credits"
  | "support"
  | "about";

interface AppShellProps {
  page: AppPage;
  onPageChange: (page: AppPage) => void;
  isAuthenticated?: boolean;
  children: ReactNode;
}

const topNavItems = [
  { page: "home", label: "首页" },
  { page: "main_image", label: "商品主图" },
  { page: "white_background", label: "AI工具" },
  { page: "detail_page", label: "详情页" },
  { page: "history", label: "历史任务" },
  { page: "pricing", label: "价格" },
  { page: "account", label: "账户" },
  { page: "login", label: "登录" },
] satisfies Array<{ page: AppPage; label: string }>;

const legalLinks = [
  { page: "terms", label: "服务条款" },
  { page: "privacy", label: "隐私政策" },
  { page: "refund", label: "退款政策" },
  { page: "credits", label: "积分说明" },
  { page: "support", label: "联系支持" },
  { page: "about", label: "关于我们" },
] satisfies Array<{ page: AppPage; label: string }>;

const privatePages = new Set<AppPage>(["history", "account"]);

export function AppShell({
  page,
  onPageChange,
  isAuthenticated = false,
  children,
}: AppShellProps) {
  const visibleTopNavItems = topNavItems.filter(
    (item) => isAuthenticated || !privatePages.has(item.page),
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <img className="brand-mark" src={kromaLogo} alt="kroma logo" />
          <div>
            <h1>kroma</h1>
            <p>跨境电商 AI 生图工作台</p>
          </div>
        </div>
        <nav className="topnav" aria-label="主导航">
          {visibleTopNavItems.map((item) => (
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
      <footer className="site-footer" aria-label="页脚">
        <p>© 2026 kroma. All rights reserved.</p>
        <nav aria-label="法律与支持">
          {legalLinks.map((item) => (
            <button
              type="button"
              key={item.page}
              onClick={() => onPageChange(item.page)}
              aria-current={page === item.page ? "page" : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </footer>
    </div>
  );
}
