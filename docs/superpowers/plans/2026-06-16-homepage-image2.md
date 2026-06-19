# Homepage Image2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a polished homepage that introduces the ecommerce AI image studio and routes users into the three generation pages, using project-local images generated with gpt-image-2.

**Architecture:** Keep the existing Vite React app and mounted workspace behavior. Add a `home` route to `AppShell`, create `HomePage.tsx`, store generated image assets under `src/assets/home/`, and style the homepage in `src/styles.css` using the existing SaaS design system.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, CSS, gpt-image-2 image CLI.

---

### Task 1: Generate Homepage Assets

**Files:**
- Create: `tmp/imagegen/home-prompts.jsonl`
- Create: `src/assets/home/home-hero.png`
- Create: `src/assets/home/home-main-image.png`
- Create: `src/assets/home/home-white-bg.png`
- Create: `src/assets/home/home-detail-page.png`

- [ ] Generate one hero image and three capability images with gpt-image-2.
- [ ] Save the final PNG files into `src/assets/home/`.
- [ ] Use prompts that avoid logos, trademarks, watermarks, and fake readable UI text.

### Task 2: Add Home Route

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/App.tsx`
- Create: `src/components/HomePage.tsx`
- Modify: `src/App.test.tsx`

- [ ] Add `home` to `AppPage`.
- [ ] Add a top navigation item labelled `首页`.
- [ ] Make `home` the default page.
- [ ] Render `HomePage` for the home route.
- [ ] Wire homepage CTA buttons to `main_image`, `white_background`, and `detail_page`.
- [ ] Keep workspace mounted only when studio pages or history are visible.

### Task 3: Style Homepage

**Files:**
- Modify: `src/styles.css`
- Modify: `DESIGN.md`

- [ ] Add a first-screen hero with image background and direct workflow entry cards.
- [ ] Add capability image cards for 商品主图, 白底图, and 详情页.
- [ ] Add a compact workflow strip: 上传商品图 -> 选择模块 -> 填写要求 -> 生成预览.
- [ ] Keep the current premium overseas-commerce SaaS visual direction.

### Task 4: Verify

**Files:**
- Modify tests only if stable text changes require it.

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run e2e`.
- [ ] Browser-check desktop and mobile for no horizontal overflow, no console errors, and visible image assets.
