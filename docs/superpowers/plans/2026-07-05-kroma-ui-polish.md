# Kroma UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Kroma web frontend feel more like a polished ecommerce image-production tool without changing generation behavior.

**Architecture:** Keep the current React pages and workflow intact. Apply a final CSS override layer that consolidates visible theme tokens, improves layout rhythm, and fixes AI-looking UI tells such as thick one-sided accent borders.

**Tech Stack:** React, Vite, TypeScript, Vitest, CSS.

---

### Task 1: Add Style Quality Guard

**Files:**
- Create: `src/styles.test.ts`

- [x] **Step 1: Write the failing test**

Add a Vitest check that reads `src/styles.css` and fails when it finds `border-left` or `border-right` thicker than `1px`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/styles.test.ts`
Expected: FAIL on the existing `border-left: 2px solid` rule.

### Task 2: Polish Theme, Homepage, And Workspace

**Files:**
- Modify: `src/styles.css`

- [x] **Step 1: Remove thick one-sided accent border**

Change `.field-hint` from a left accent border to a full subtle border.

- [x] **Step 2: Add a final Kroma product UI polish layer**

Append a final override block that:
- stabilizes the color tokens around deep cyan-blue with restrained logo accents,
- darkens primary and selected buttons,
- reduces oversized homepage hero typography,
- tightens card and panel radii,
- improves workspace module card density and selected states,
- removes visible default feature numbering on the homepage.

- [x] **Step 3: Run the style test**

Run: `npm test -- --run src/styles.test.ts`
Expected: PASS.

### Task 3: Verify In Browser

**Files:**
- No source changes expected.

- [x] **Step 1: Build**

Run: `npm run build`
Expected: PASS.

- [x] **Step 2: Capture desktop and mobile screenshots**

Use the running Vite server at `http://127.0.0.1:5173/` to capture homepage and workspace screenshots. Check for obvious overlap, unreadable text, or broken layout.
