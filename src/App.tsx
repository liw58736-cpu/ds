import { StudioDashboard } from "./components/StudioDashboard";
import {
  OPEN_LIBRARY_EVENT,
  RETURN_LIBRARY_EVENT,
  OPEN_LOGIN_EVENT,
  REUSE_TASK_EVENT,
} from "./domain/navigationEvents";
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
import { MaterialLibraryPage } from "./components/MaterialLibraryPage";
import { getCurrentAccountSnapshot } from "./api/accountApi";
import {
  ACCOUNT_CHANGED_EVENT,
  clearAccountSession,
} from "./storage/accountStore";
import { getStorageOwner } from "./storage/workspaceDraftStore";
import type { GenerationModule, ProductInput } from "./domain/types";

const routablePages = new Set<AppPage>([
  "home",
  "main_image",
  "white_background",
  "detail_page",
  "inspiration",
  "motion",
  "materials",
  "history",
  "pricing",
  "account",
  "login",
  "terms",
  "privacy",
  "refund",
  "credits",
  "support",
  "about",
]);
function routeFromUrl(): AppPage {
  const route = window.location.hash.replace(/^#\/?/, "") as AppPage;
  return routablePages.has(route) ? route : "home";
}

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
      : ["account", "history"].includes(routeFromUrl()) &&
          !initialAccount.session
        ? "login"
        : routeFromUrl(),
  );
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(initialAccount.session),
  );
  const [activeStudioModule, setActiveStudioModule] = useState<StudioPage>(
    () =>
      isStudioPage(routeFromUrl())
        ? (routeFromUrl() as StudioPage)
        : "main_image",
  );
  const [libraryReturn, setLibraryReturn] = useState<{
    page: AppPage;
    pickerId?: string;
  } | null>(null);
  const [motionMounted, setMotionMounted] = useState(
    () => routeFromUrl() === "motion",
  );
  const [motionSeed, setMotionSeed] = useState<ProductInput | null>(null);
  const isWorkspaceVisible = isStudioPage(page);
  const [shouldMountWorkspace, setShouldMountWorkspace] = useState(() =>
    isStudioPage(routeFromUrl()),
  );
  const [storageOwner, setStorageOwner] = useState(getStorageOwner);

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
      setShouldMountWorkspace(true);
      setActiveStudioModule(nextPage);
    }

    if (nextPage === "motion") setMotionMounted(true);
    setPage(nextPage);
  };

  useEffect(() => {
    const toLibrary = (event: Event) => {
      setLibraryReturn({
        page,
        pickerId: (event as CustomEvent).detail?.pickerId,
      });
      setPage("materials");
    };
    const toLogin = () => handlePageChange("login");
    const reuse = (event: Event) => {
      const task = (event as CustomEvent).detail;
      const target =
        task?.config?.module === "lifestyle"
          ? "inspiration"
          : task?.config?.module;
      if (studioPages.includes(target)) handlePageChange(target);
    };
    window.addEventListener(OPEN_LIBRARY_EVENT, toLibrary);
    window.addEventListener(OPEN_LOGIN_EVENT, toLogin);
    window.addEventListener(REUSE_TASK_EVENT, reuse);
    return () => {
      window.removeEventListener(OPEN_LIBRARY_EVENT, toLibrary);
      window.removeEventListener(OPEN_LOGIN_EVENT, toLogin);
      window.removeEventListener(REUSE_TASK_EVENT, reuse);
    };
  }, [page, isAuthenticated]);
  const returnFromLibrary = () => {
    if (!libraryReturn) return;
    handlePageChange(libraryReturn.page);
    const detail = libraryReturn;
    setLibraryReturn(null);
    setTimeout(
      () =>
        window.dispatchEvent(new CustomEvent(RETURN_LIBRARY_EVENT, { detail })),
      0,
    );
  };

  useEffect(() => {
    const url = `${window.location.pathname}${window.location.search}${page === "home" ? "" : `#/${page}`}`;
    if (
      `${window.location.pathname}${window.location.search}${window.location.hash}` !==
      url
    )
      window.history.pushState({}, "", url);
  }, [page]);
  useEffect(() => {
    const navigate = () => handlePageChange(routeFromUrl());
    window.addEventListener("popstate", navigate);
    window.addEventListener("hashchange", navigate);
    return () => {
      window.removeEventListener("popstate", navigate);
      window.removeEventListener("hashchange", navigate);
    };
  }, []);
  const handleLogout = () => {
    clearAccountSession();
    setIsAuthenticated(false);
    setPage("login");
  };

  const secondaryPage =
    page === "home" ? (
      isAuthenticated ? (
        <StudioDashboard onNavigate={handlePageChange} />
      ) : (
        <HomePage onOpenStudio={handlePageChange} />
      )
    ) : page === "history" ? (
      <HistoryPage />
    ) : page === "pricing" ? (
      <PricingPage onRequireLogin={() => handlePageChange("login")} />
    ) : page === "materials" ? (
      <MaterialLibraryPage
        onReturn={libraryReturn ? returnFromLibrary : undefined}
        isAuthenticated={isAuthenticated}
        onRequireLogin={() => handlePageChange("login")}
      />
    ) : page === "account" ? (
      <AccountPage
        paymentStatus={initialPaymentStatus}
        onLogout={handleLogout}
      />
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
      setStorageOwner(getStorageOwner());
      setPage((currentPage) => {
        if (hasSavedSession && currentPage === "login") {
          return "account";
        }

        if (
          !hasSavedSession &&
          (currentPage === "account" || currentPage === "history")
        ) {
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
      {motionMounted ? (
        <section hidden={page !== "motion"}>
          <MotionStudioPage
            key={storageOwner}
            initialProduct={motionSeed}
            onInitialProductConsumed={() => setMotionSeed(null)}
            isAuthenticated={isAuthenticated}
            onRequireLogin={() => handlePageChange("login")}
            onOpenPricing={() => handlePageChange("pricing")}
          />
        </section>
      ) : null}
      <section
        className="workspace-route"
        hidden={!isWorkspaceVisible}
        aria-hidden={!isWorkspaceVisible}
      >
        {shouldMountWorkspace ? (
          <Workspace
            key={storageOwner}
            activeModule={getWorkspaceModule(activeStudioModule)}
            isVisible={isWorkspaceVisible}
            isAuthenticated={isAuthenticated}
            onOpenPricing={() => handlePageChange("pricing")}
            onRequireLogin={() => handlePageChange("login")}
            onOpenMotion={(imageUrl, title) => {
              setMotionSeed({
                id: `motion-result-${Date.now().toString(36)}`,
                imageUrl,
                fileName: title || "generated-image",
                createdAt: new Date().toISOString(),
                source: "upload",
              });
              setMotionMounted(true);
              setPage("motion");
            }}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
