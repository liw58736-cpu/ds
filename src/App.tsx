import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import type { AppPage } from "./components/AppShell";
import { AccountPage } from "./components/AccountPage";
import { HomePage } from "./components/HomePage";
import { HistoryPage } from "./components/HistoryPage";
import { LegalPage } from "./components/LegalPage";
import { LoginPage } from "./components/LoginPage";
import { PricingPage } from "./components/PricingPage";
import { Workspace } from "./components/Workspace";
import { getCurrentAccountSnapshot } from "./api/accountApi";
import { clearAccountSession } from "./storage/accountStore";

const studioPages = [
  "main_image",
  "white_background",
  "detail_page",
] as const satisfies readonly AppPage[];

type StudioPage = (typeof studioPages)[number];

function isStudioPage(page: AppPage): page is StudioPage {
  return (studioPages as readonly AppPage[]).includes(page);
}

export default function App() {
  const initialAccount = getCurrentAccountSnapshot();
  const initialPaymentStatus =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("payment")
      : null;
  const [page, setPage] = useState<AppPage>(
    initialPaymentStatus === "paddle-success"
      ? initialAccount.session
        ? "account"
        : "login"
      : "home",
  );
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(initialAccount.session),
  );
  const [activeStudioModule, setActiveStudioModule] =
    useState<StudioPage>("main_image");
  const isWorkspaceVisible = isStudioPage(page);
  const shouldMountWorkspace = page !== "home" && page !== "history";

  const handlePageChange = (nextPage: AppPage) => {
    if (
      (nextPage === "history" || nextPage === "account") &&
      !isAuthenticated
    ) {
      setPage("login");
      return;
    }

    if (isStudioPage(nextPage)) {
      setActiveStudioModule(nextPage);
    }

    setPage(nextPage);
  };

  const handleLogout = () => {
    clearAccountSession();
    setIsAuthenticated(false);
    setPage("login");
  };

  const secondaryPage =
    page === "home" ? (
      <HomePage onOpenStudio={handlePageChange} />
    ) : page === "history" ? (
      <HistoryPage />
    ) : page === "pricing" ? (
      <PricingPage />
    ) : page === "account" ? (
      <AccountPage paymentStatus={initialPaymentStatus} onLogout={handleLogout} />
    ) : page === "login" ? (
      <LoginPage
        onOpenLegal={handlePageChange}
        onAuthenticated={() => {
          setIsAuthenticated(true);
          setPage("account");
        }}
      />
    ) : page === "terms" ? (
      <LegalPage type="terms" />
    ) : page === "privacy" ? (
      <LegalPage type="privacy" />
    ) : page === "refund" ? (
      <LegalPage type="refund" />
    ) : page === "credits" ? (
      <LegalPage type="credits" />
    ) : page === "support" ? (
      <LegalPage type="support" />
    ) : page === "about" ? (
      <LegalPage type="about" />
    ) : null;

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    if (!navigator.userAgent.toLowerCase().includes("jsdom")) {
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [page]);

  useEffect(() => {
    if (initialPaymentStatus !== "paddle-success") {
      return;
    }

    const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);
  }, [initialPaymentStatus]);

  return (
    <AppShell
      page={page}
      onPageChange={handlePageChange}
      isAuthenticated={isAuthenticated}
    >
      {secondaryPage}
      <section
        className="workspace-route"
        hidden={!isWorkspaceVisible}
        aria-hidden={!isWorkspaceVisible}
      >
        {shouldMountWorkspace ? (
          <Workspace
            activeModule={activeStudioModule}
            isVisible={isWorkspaceVisible}
            isAuthenticated={isAuthenticated}
            onOpenPricing={() => handlePageChange("pricing")}
            onRequireLogin={() => handlePageChange("login")}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
