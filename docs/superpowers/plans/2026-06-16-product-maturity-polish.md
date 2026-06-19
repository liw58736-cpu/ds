# Product Maturity Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing ecommerce AI image studio feel like a more mature SaaS workspace without expanding scope or changing generation data contracts.

**Architecture:** Keep the existing React component tree and local task lifecycle. Add lightweight presentation components and derived metrics from existing `GenerationTask[]`; improve copy, empty states, template/pricing/account content, and CSS only.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, CSS.

---

## File Map

- Modify `src/components/Workspace.tsx`: derive workspace metrics from tasks and render a compact operations summary before the main columns.
- Create `src/components/WorkspaceSummary.tsx`: present product/account-like summary cards from existing state.
- Modify `src/components/ResultPreview.tsx`: show clearer generation state, selected format, credit cost, and failure guidance.
- Modify `src/components/TaskHistory.tsx`: make history entries more asset-like with attempt, credit, and timestamp metadata.
- Modify `src/components/TemplatesPage.tsx`: expand template cards with platform, size, credit, and use-case detail.
- Modify `src/components/PricingPage.tsx`: add feature lines and make the middle plan read as recommended.
- Modify `src/components/AccountPage.tsx`: replace generic local demo copy with a usage/status panel.
- Modify `src/styles.css`: add summary cards, metadata rows, richer empty states, and responsive polish.
- Modify tests only where accessible text changes.

## Tasks

### Task 1: Workspace Summary

- [ ] Add a `WorkspaceSummary` component that accepts `tasks`, `product`, and `hasRunningTask`.
- [ ] Display four derived values: current product state, completed task count, this-month mock usage, and current queue state.
- [ ] Keep it purely presentational; do not write to storage.

### Task 2: Production State Polish

- [ ] Enhance result preview with a compact status strip.
- [ ] Enhance history items with created date, attempt, and credit cost.
- [ ] Keep retry/reuse/download behavior unchanged.

### Task 3: Secondary Page Credibility

- [ ] Enrich templates with platform, ratio, credit, and purpose fields.
- [ ] Enrich pricing with feature lists and recommended plan styling.
- [ ] Enrich account with plan, monthly usage, storage, and local demo disclosure.

### Task 4: Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run e2e`.
- [ ] Browser check desktop and mobile for no console errors, no mojibake, and no horizontal overflow.
