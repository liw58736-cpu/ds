# Awesome Design MD UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a Shopify-inspired transactional design system with Linear-style product density to the ecommerce image studio without changing the generation workflow.

**Architecture:** Keep the existing Vite + React component structure and domain/storage/provider boundaries. Update UI copy, page structure, and CSS tokens in place; update tests to assert the corrected Chinese labels and unchanged behavior.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, CSS.

---

## File Map

- Modify `src/App.tsx`: correct history page copy while preserving mounted workspace behavior.
- Modify `src/domain/defaults.ts`: correct module labels shown across navigation, settings, and history.
- Modify `src/storage/taskStore.ts`: correct persisted task recovery messages.
- Modify `src/providers/generationProvider.ts`: correct mock failure copy and improve mock result SVG styling.
- Modify `src/components/*.tsx`: correct visible Chinese copy and add lightweight structural hooks for the refreshed layout.
- Modify `src/styles.css`: implement Shopify-inspired light commerce canvas, pill buttons, mint accents, hairline panels, dense workspace layout, and responsive behavior.
- Modify `src/**/*.test.tsx` and `tests/e2e/workspace.spec.ts`: update assertions to corrected labels and preserve workflow coverage.

## Tasks

### Task 1: Repair UI Copy

**Files:** `src/App.tsx`, `src/domain/defaults.ts`, `src/storage/taskStore.ts`, `src/providers/generationProvider.ts`, `src/components/*.tsx`, tests.

- [ ] Replace mojibake strings with clear Chinese labels: 工作台, 模板库, 历史任务, 价格, 账户, 商品图, 上传商品图, 使用示例商品, 生成素材, 下载结果, 复用参数, 重试.
- [ ] Keep semantic names and aria labels aligned with visible text.
- [ ] Run `npm test` and update test assertions where copy changed.

### Task 2: Apply Design System

**Files:** `src/styles.css`, component class hooks as needed.

- [ ] Define CSS variables based on Shopify DESIGN.md light transactional track: cream canvas, white surfaces, black primary pill, aloe/pistachio accents, hairline borders.
- [ ] Keep Linear-style density: 3-column desktop workspace, clear panel edges, product UI as the main visual, no marketing hero.
- [ ] Make all command buttons pill-shaped and keep cards at 8px or less where the app uses dense repeated UI.
- [ ] Verify mobile collapses to a vertical workflow without horizontal overflow.

### Task 3: Verify Runtime

**Files:** no planned code files unless tests reveal defects.

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run e2e`.
- [ ] Open the local app and check desktop/mobile DOM for no console errors and no horizontal overflow.
