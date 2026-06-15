import { useState } from "react";
import { AppShell } from "./components/AppShell";
import type { AppPage } from "./components/AppShell";
import { AccountPage } from "./components/AccountPage";
import { PricingPage } from "./components/PricingPage";
import { TemplatesPage } from "./components/TemplatesPage";
import { Workspace } from "./components/Workspace";

export default function App() {
  const [page, setPage] = useState<AppPage>("workspace");
  const isWorkspaceVisible = page === "workspace" || page === "history";

  const secondaryPage =
    page === "templates" ? (
      <TemplatesPage />
    ) : page === "pricing" ? (
      <PricingPage />
    ) : page === "account" ? (
      <AccountPage />
    ) : null;

  return (
    <AppShell page={page} onPageChange={setPage}>
      {secondaryPage}
      <section
        className="workspace-route"
        hidden={!isWorkspaceVisible}
        aria-hidden={!isWorkspaceVisible}
      >
        {page === "history" ? (
          <section
            className="page-surface history-notice"
            aria-labelledby="history-page-title"
          >
            <div className="page-heading">
              <p className="eyebrow">History</p>
              <h1 id="history-page-title">历史任务</h1>
              <p>在工作台左侧查看最近任务，并复用参数或重试失败任务。</p>
            </div>
          </section>
        ) : null}
        <Workspace />
      </section>
    </AppShell>
  );
}
