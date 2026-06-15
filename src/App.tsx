import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { AccountPage } from "./components/AccountPage";
import { PricingPage } from "./components/PricingPage";
import { TemplatesPage } from "./components/TemplatesPage";
import { Workspace } from "./components/Workspace";

export type AppPage = "workspace" | "templates" | "history" | "pricing" | "account";

export default function App() {
  const [page, setPage] = useState<AppPage>("workspace");

  const pageContent =
    page === "templates" ? (
      <TemplatesPage />
    ) : page === "pricing" ? (
      <PricingPage />
    ) : page === "account" ? (
      <AccountPage />
    ) : (
      <Workspace />
    );

  return (
    <AppShell page={page} onPageChange={setPage}>
      {pageContent}
    </AppShell>
  );
}
