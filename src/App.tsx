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
  const [page, setPage] = useState<AppPage>("home");
  const [activeStudioModule, setActiveStudioModule] =
    useState<StudioPage>("main_image");
  const isWorkspaceVisible = isStudioPage(page);
  const shouldMountWorkspace = page !== "home" && page !== "history";

  const handlePageChange = (nextPage: AppPage) => {
    if (isStudioPage(nextPage)) {
      setActiveStudioModule(nextPage);
    }

    setPage(nextPage);
  };

  const secondaryPage =
    page === "home" ? (
      <HomePage onOpenStudio={handlePageChange} />
    ) : page === "history" ? (
      <HistoryPage />
    ) : page === "pricing" ? (
      <PricingPage />
    ) : page === "account" ? (
      <AccountPage />
    ) : page === "login" ? (
      <LoginPage onOpenLegal={handlePageChange} />
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
    ) : page === "business" ? (
      <LegalPage type="business" />
    ) : null;

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    if (!navigator.userAgent.toLowerCase().includes("jsdom")) {
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [page]);

  return (
    <AppShell page={page} onPageChange={handlePageChange}>
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
            onOpenPricing={() => handlePageChange("pricing")}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
