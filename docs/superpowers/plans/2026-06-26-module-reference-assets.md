# Module Reference Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-module reference uploads and notes so modules like packaging and multi-color sets can pass user-provided assets into image2/reference-image generation.

**Architecture:** Store module reference assets inside `GenerationConfig`, keyed by module id. The parameter panel edits those assets per card, prompt building injects the matching notes, and the Kroma adapter sends the matching module images as `template_image_base64`, `template_image_base64s`, `image2`, and `reference_image2` for the current expanded child task.

**Tech Stack:** React, TypeScript, Vitest, Vite, localStorage task persistence, Kroma-compatible web image backend.

---

### Task 1: Data Contract And Prompt

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/promptBuilder.ts`
- Modify: `src/storage/taskStore.ts`
- Test: `src/domain/promptBuilder.test.ts`
- Test: `src/storage/taskStore.test.ts`

- [ ] Add `ModuleReferenceAsset` and `moduleReferenceAssets` to generation config.
- [ ] Add tests proving module notes are included only for the selected module.
- [ ] Preserve uploaded reference assets through task storage parsing.

### Task 2: Image2 Request Mapping

**Files:**
- Modify: `src/api/kromaGenerationAdapter.ts`
- Modify: `web-backend/src/image-router.mjs`
- Test: `src/api/kromaGenerationAdapter.test.ts`
- Test: `web-backend/test/web-backend-contract.test.mjs`

- [ ] Send module reference images as image2/reference_image2 fields.
- [ ] Preserve multiple uploaded images in the provider image array.
- [ ] Keep the primary product image as Image 1.

### Task 3: Module Card UI

**Files:**
- Modify: `src/components/ParameterPanel.tsx`
- Modify: `src/styles.css`
- Test: `src/components/workspace.test.tsx`

- [ ] Add a per-card material button.
- [ ] Add a modal for uploading reference images and text notes.
- [ ] Show a small count on cards with saved module assets.
- [ ] Ensure clicking the material button does not toggle module selection unexpectedly.

### Task 4: Verification

**Files:**
- Run tests and build.

- [ ] Run `npm test -- src/domain/promptBuilder.test.ts src/api/kromaGenerationAdapter.test.ts src/components/workspace.test.tsx`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit, push, deploy, and run `npm run check:production`.
