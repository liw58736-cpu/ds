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
import { MotionStudioPage } from "./components/MotionStudioPage";
import { ImageCleanupPage } from "./components/ImageCleanupPage";
import { getCurrentAccountSnapshot } from "./api/accountApi";
import { ACCOUNT_CHANGED_EVENT, clearAccountSession } from "./storage/accountStore";
import type { GenerationModule, ProductInput } from "./domain/types";

const studioPages = [
  "main_image",
  "white_background",
  "detail_page",
  "inspiration",
] as const satisfies readonly AppPage[];

type StudioPage = (typeof studioPages)[number];

function isStudioPage(page: AppPage): page is StudioPage {
  return (studioPages as readonly AppPage[]).includes(page);
}

function getWorkspaceModule(
  page: StudioPage,
): Extract<
  GenerationModule,
  "main_image" | "white_background" | "detail_page" | "lifestyle"
> {
  return page === "inspiration" ? "lifestyle" : page;
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
  const [cleanupSeed, setCleanupSeed] = useState<ProductInput | null>(null);
  const [motionSeed, setMotionSeed] = useState<ProductInput | null>(null);
  const isWorkspaceVisible = isStudioPage(page);
  const shouldMountWorkspace = page !== "home" && page !== "history";

  const handlePageChange = (nextPage: AppPage) => {
    const hasSavedSession = Boolean(getCurrentAccountSnapshot().session);

    if (hasSavedSession !== isAuthenticated) {
      setIsAuthenticated(hasSavedSession);
    }

    if (nextPage === "login" && hasSavedSession) {
      setPage("account");
      return;
    }

    if (
      (nextPage === "history" || nextPage === "account") &&
      !hasSavedSession
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
      <PricingPage onRequireLogin={() => handlePageChange("login")} />
    ) : page === "motion" ? (
      <MotionStudioPage
        initialProduct={motionSeed}
        onInitialProductConsumed={() => setMotionSeed(null)}
        isAuthenticated={isAuthenticated}
        onRequireLogin={() => handlePageChange("login")}
        onOpenPricing={() => handlePageChange("pricing")}
      />
    ) : page === "cleanup" ? (
      <ImageCleanupPage
        isAuthenticated={isAuthenticated}
        onRequireLogin={() => handlePageChange("login")}
        onOpenPricing={() => handlePageChange("pricing")}
        initialProduct={cleanupSeed}
        onInitialProductConsumed={() => setCleanupSeed(null)}
      />
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
    const syncAccountState = () => {
      const hasSavedSession = Boolean(getCurrentAccountSnapshot().session);

      setIsAuthenticated(hasSavedSession);
      setPage((currentPage) => {
        if (hasSavedSession && currentPage === "login") {
          return "account";
        }

        if (!hasSavedSession && (currentPage === "account" || currentPage === "history")) {
          return "login";
        }

        return currentPage;
      });
    };

    window.addEventListener(ACCOUNT_CHANGED_EVENT, syncAccountState);
    window.addEventListener("storage", syncAccountState);
    syncAccountState();

    return () => {
      window.removeEventListener(ACCOUNT_CHANGED_EVENT, syncAccountState);
      window.removeEventListener("storage", syncAccountState);
    };
  }, []);

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
            activeModule={getWorkspaceModule(activeStudioModule)}
            isVisible={isWorkspaceVisible}
            isAuthenticated={isAuthenticated}
            onOpenPricing={() => handlePageChange("pricing")}
            onRequireLogin={() => handlePageChange("login")}
            onOpenCleanup={(imageUrl, title) => {
              setCleanupSeed({
                id: `cleanup-import-${Date.now().toString(36)}`,
                imageUrl,
                fileName: title || "xiaohongshu-image",
                createdAt: new Date().toISOString(),
                source: "upload",
              });
              setPage("cleanup");
            }}
            onOpenMotion={(imageUrl, title) => {
              setMotionSeed({
                id: `motion-result-${Date.now().toString(36)}`,
                imageUrl,
                fileName: title || "generated-image",
                createdAt: new Date().toISOString(),
                source: "upload",
              });
              setPage("motion");
            }}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
