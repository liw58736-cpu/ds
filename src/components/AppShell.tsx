import { useEffect, useState, type ReactNode } from "react";
import kromaLogo from "../assets/brand/kroma-logo.png";
import { Image, Layers3, WandSparkles, Sparkles, Film, type LucideIcon } from "lucide-react";

export type AppPage =
  | "home"
  | "main_image"
  | "white_background"
  | "detail_page"
  | "inspiration"
  | "motion"
  | "materials"
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
  { page: "main_image", label: "创作工作台" },
  { page: "materials", label: "图片库" },
  { page: "history", label: "任务中心" },
  { page: "pricing", label: "价格" },
  { page: "account", label: "账户" },
  { page: "login", label: "登录" },
] satisfies Array<{ page: AppPage; label: string }>;

const studioNavigation: Array<{ page: AppPage; label: string; icon: LucideIcon }> = [
  { page: "main_image", label: "商品主图", icon: Image },
  { page: "detail_page", label: "详情页", icon: Layers3 },
  { page: "white_background", label: "AI工具", icon: WandSparkles },
  { page: "inspiration", label: "灵感创作", icon: Sparkles },
  { page: "motion", label: "Live图", icon: Film },
];
const legalLinks = [
  { page: "terms", label: "服务条款" },
  { page: "privacy", label: "隐私政策" },
  { page: "refund", label: "退款政策" },
  { page: "credits", label: "积分说明" },
  { page: "support", label: "联系支持" },
  { page: "about", label: "关于我们" },
] satisfies Array<{ page: AppPage; label: string }>;

function getPageHref(page: AppPage): string {
  if (legalLinks.some((item) => item.page === page)) {
    return `/${page}/index.html`;
  }

  return `/${page}`;
}

const privatePages = new Set<AppPage>(["history", "account"]);

export function AppShell({
  page,
  onPageChange,
  isAuthenticated = false,
  children,
}: AppShellProps) {
  const [lastStudio, setLastStudio] = useState<AppPage>("main_image");
  const inStudio = studioNavigation.some((item) => item.page === page);
  useEffect(() => {
    if (inStudio) setLastStudio(page);
  }, [page, inStudio]);
  const visibleTopNavItems = topNavItems.filter(
    (item) =>
      (isAuthenticated || !privatePages.has(item.page)) &&
      (!isAuthenticated || item.page !== "login"),
  );

  return (
    <div className="app-shell" data-page={page}>
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
              className={`topnav-button${(item.page === "main_image" ? inStudio : page === item.page) ? " nav-active" : ""}`}
              onClick={() =>
                onPageChange(
                  item.page === "main_image" ? lastStudio : item.page,
                )
              }
              aria-current={(item.page === "main_image" ? inStudio : page === item.page) ? "page" : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      {inStudio ? (
        <nav className="studio-navigation" aria-label="创作功能">
          {studioNavigation.map((item) => (
            <button
              type="button"
              key={item.page}
              className={page === item.page ? "nav-active" : ""}
              data-tool={item.page}
              aria-current={page === item.page ? "page" : undefined}
              onClick={() => onPageChange(item.page)}
            >
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      ) : null}
      {children}
      <footer className="site-footer" aria-label="页脚">
        <p>© 2026 kroma. All rights reserved.</p>
        <nav aria-label="法律与支持">
          {legalLinks.map((item) => (
            <a
              href={getPageHref(item.page)}
              key={item.page}
              onClick={(event) => {
                event.preventDefault();
                onPageChange(item.page);
              }}
              aria-current={page === item.page ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
