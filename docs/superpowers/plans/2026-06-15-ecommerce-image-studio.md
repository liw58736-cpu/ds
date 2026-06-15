# Ecommerce Image Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable ecommerce image generation studio that supports real upload previews, generation tasks, history, retry, export controls, and mock AI results behind a replaceable provider boundary.

**Architecture:** Use a Vite React TypeScript single-page app with domain logic isolated under `src/domain`, browser persistence under `src/storage`, provider implementations under `src/providers`, and UI components under `src/components`. The UI owns rendering and form state; generation behavior flows through `GenerationProvider`, so a real AI backend can replace the mock provider later without rewriting the workspace.

**Tech Stack:** Vite, React, TypeScript, Vitest, React Testing Library, Playwright, CSS modules via plain CSS files, browser `localStorage`, object URLs for local upload previews.

---

## File Structure

- Create `package.json`: scripts and dependencies.
- Create `index.html`: app mount point.
- Create `vite.config.ts`: Vite, React, and Vitest config.
- Create `tsconfig.json`: strict TypeScript settings.
- Create `.gitignore`: generated files and local preview artifacts.
- Create `src/main.tsx`: React entry.
- Create `src/App.tsx`: top-level app state and page routing.
- Create `src/styles.css`: global responsive layout.
- Create `src/domain/types.ts`: product, config, task, provider types.
- Create `src/domain/defaults.ts`: module, platform, size, style, and format options.
- Create `src/domain/taskState.ts`: task creation, completion, failure, retry helpers.
- Create `src/domain/taskState.test.ts`: task lifecycle tests.
- Create `src/providers/generationProvider.ts`: provider interface and mock provider.
- Create `src/providers/generationProvider.test.ts`: mock result and failure tests.
- Create `src/storage/taskStore.ts`: localStorage load/save helpers.
- Create `src/storage/taskStore.test.ts`: persistence tests.
- Create `src/components/AppShell.tsx`: navigation frame.
- Create `src/components/Workspace.tsx`: main studio layout.
- Create `src/components/UploadPanel.tsx`: upload and sample product input.
- Create `src/components/ModuleNav.tsx`: generation module selector.
- Create `src/components/ParameterPanel.tsx`: platform, size, style, text, format controls.
- Create `src/components/ResultPreview.tsx`: original/result preview and export controls.
- Create `src/components/TaskHistory.tsx`: recent tasks, retry, reuse, download.
- Create `src/components/TemplatesPage.tsx`: template cards that prefill the workspace.
- Create `src/components/PricingPage.tsx`: static pricing surface.
- Create `src/components/AccountPage.tsx`: static account/status surface.
- Create `src/components/workspace.test.tsx`: interaction tests.
- Create `tests/e2e/workspace.spec.ts`: Playwright user-flow tests.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Initialize git**

Run:

```powershell
git init
```

Expected: repository initialized under the current directory.

- [ ] **Step 2: Create package and config files**

Write `package.json`:

```json
{
  "name": "ecommerce-image-studio",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "lucide-react": "^0.468.0",
    "vite": "^6.0.0",
    "typescript": "^5.7.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^25.0.0",
    "vitest": "^2.1.0"
  }
}
```

Write `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Commerce Studio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Write `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/testSetup.ts"],
    globals: true,
  },
});
```

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

Write `.gitignore`:

```gitignore
node_modules
dist
coverage
playwright-report
test-results
.superpowers
.env
*.log
```

- [ ] **Step 3: Create smoke app and test setup**

Write `src/testSetup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Write `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Write `src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app">
      <h1>Commerce Studio</h1>
      <p>电商主图与详情页生成工作台</p>
    </main>
  );
}
```

Write `src/styles.css`:

```css
:root {
  color: #172026;
  background: #f4f1ea;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app {
  min-height: 100vh;
  padding: 32px;
}
```

Write `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the studio title", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Commerce Studio" })).toBeInTheDocument();
    expect(screen.getByText("电商主图与详情页生成工作台")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Install dependencies**

Run:

```powershell
npm install
```

Expected: `node_modules` and `package-lock.json` are created without dependency resolution errors.

- [ ] **Step 5: Verify scaffold**

Run:

```powershell
npm test
npm run build
```

Expected: tests pass and Vite build completes.

- [ ] **Step 6: Commit scaffold**

Run:

```powershell
git add .
git commit -m "chore: scaffold ecommerce image studio"
```

Expected: a commit is created.

## Task 2: Domain Model and Task Lifecycle

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/defaults.ts`
- Create: `src/domain/taskState.ts`
- Test: `src/domain/taskState.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Write `src/domain/taskState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTask, failTask, retryTask, completeTask } from "./taskState";
import type { GenerationConfig, ProductInput } from "./types";

const product: ProductInput = {
  id: "product-1",
  imageUrl: "blob:product",
  fileName: "chair.png",
  createdAt: "2026-06-15T00:00:00.000Z",
  source: "upload",
};

const config: GenerationConfig = {
  module: "main_image",
  platform: "amazon",
  aspectRatio: "1:1",
  style: "studio",
  outputFormat: "png",
  sellingPoints: "Lightweight aluminum frame",
  specifications: "42 x 38 x 80 cm",
};

describe("task lifecycle", () => {
  it("creates a queued task with a success-only credit cost", () => {
    const task = createTask({ product, config, now: "2026-06-15T01:00:00.000Z" });
    expect(task.status).toBe("queued");
    expect(task.creditCost).toBe(0);
    expect(task.productInput.id).toBe("product-1");
  });

  it("marks a task completed and records credit cost", () => {
    const task = createTask({ product, config, now: "2026-06-15T01:00:00.000Z" });
    const completed = completeTask(task, {
      resultUrls: ["/mock/main-image.svg"],
      completedAt: "2026-06-15T01:00:02.000Z",
      creditCost: 1,
    });
    expect(completed.status).toBe("completed");
    expect(completed.resultUrls).toEqual(["/mock/main-image.svg"]);
    expect(completed.creditCost).toBe(1);
  });

  it("keeps failed tasks uncharged and retryable", () => {
    const task = createTask({ product, config, now: "2026-06-15T01:00:00.000Z" });
    const failed = failTask(task, {
      errorCode: "generation_timeout",
      errorMessage: "生成超时，请重试。",
      completedAt: "2026-06-15T01:00:03.000Z",
    });
    const retried = retryTask(failed, "2026-06-15T01:01:00.000Z");
    expect(failed.status).toBe("failed");
    expect(failed.creditCost).toBe(0);
    expect(retried.status).toBe("queued");
    expect(retried.errorCode).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm test -- src/domain/taskState.test.ts
```

Expected: failure because `types.ts` and `taskState.ts` do not exist.

- [ ] **Step 3: Implement domain files**

Write `src/domain/types.ts`:

```ts
export type ProductSource = "upload" | "sample";
export type GenerationModule =
  | "main_image"
  | "white_background"
  | "lifestyle"
  | "detail_page"
  | "shopify_banner"
  | "video_preview";
export type Platform = "amazon" | "shopify" | "independent_store";
export type AspectRatio = "1:1" | "4:5" | "16:9" | "long_page";
export type VisualStyle = "studio" | "lifestyle" | "premium" | "minimal";
export type OutputFormat = "png" | "jpg" | "webp";
export type TaskStatus = "queued" | "processing" | "completed" | "failed";

export interface ProductInput {
  id: string;
  imageUrl: string;
  fileName: string;
  createdAt: string;
  source: ProductSource;
}

export interface GenerationConfig {
  module: GenerationModule;
  platform: Platform;
  aspectRatio: AspectRatio;
  style: VisualStyle;
  outputFormat: OutputFormat;
  sellingPoints: string;
  specifications: string;
}

export interface GenerationTask {
  id: string;
  productInput: ProductInput;
  config: GenerationConfig;
  status: TaskStatus;
  resultUrls: string[];
  errorCode?: string;
  errorMessage?: string;
  creditCost: number;
  createdAt: string;
  completedAt?: string;
  attempt: number;
}

export interface GenerationResult {
  resultUrls: string[];
  creditCost: number;
}
```

Write `src/domain/defaults.ts`:

```ts
import type { GenerationConfig } from "./types";

export const defaultConfig: GenerationConfig = {
  module: "main_image",
  platform: "amazon",
  aspectRatio: "1:1",
  style: "studio",
  outputFormat: "png",
  sellingPoints: "",
  specifications: "",
};

export const moduleLabels = {
  main_image: "商品主图",
  white_background: "白底图",
  lifestyle: "生活方式场景图",
  detail_page: "详情页长图",
  shopify_banner: "Shopify Banner",
  video_preview: "商品视频入口",
} as const;
```

Write `src/domain/taskState.ts`:

```ts
import type { GenerationConfig, GenerationTask, ProductInput } from "./types";

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createTask(input: {
  product: ProductInput;
  config: GenerationConfig;
  now: string;
}): GenerationTask {
  return {
    id: createId("task"),
    productInput: input.product,
    config: input.config,
    status: "queued",
    resultUrls: [],
    creditCost: 0,
    createdAt: input.now,
    attempt: 1,
  };
}

export function markProcessing(task: GenerationTask): GenerationTask {
  return { ...task, status: "processing" };
}

export function completeTask(
  task: GenerationTask,
  input: { resultUrls: string[]; completedAt: string; creditCost: number },
): GenerationTask {
  return {
    ...task,
    status: "completed",
    resultUrls: input.resultUrls,
    completedAt: input.completedAt,
    creditCost: input.creditCost,
    errorCode: undefined,
    errorMessage: undefined,
  };
}

export function failTask(
  task: GenerationTask,
  input: { errorCode: string; errorMessage: string; completedAt: string },
): GenerationTask {
  return {
    ...task,
    status: "failed",
    resultUrls: [],
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    completedAt: input.completedAt,
    creditCost: 0,
  };
}

export function retryTask(task: GenerationTask, now: string): GenerationTask {
  return {
    ...task,
    status: "queued",
    resultUrls: [],
    errorCode: undefined,
    errorMessage: undefined,
    creditCost: 0,
    createdAt: now,
    completedAt: undefined,
    attempt: task.attempt + 1,
  };
}
```

- [ ] **Step 4: Verify lifecycle tests**

Run:

```powershell
npm test -- src/domain/taskState.test.ts
```

Expected: all task lifecycle tests pass.

- [ ] **Step 5: Commit domain model**

Run:

```powershell
git add src/domain
git commit -m "feat: add generation task domain model"
```

Expected: a commit is created.

## Task 3: Mock Generation Provider

**Files:**
- Create: `src/providers/generationProvider.ts`
- Test: `src/providers/generationProvider.test.ts`

- [ ] **Step 1: Write failing provider tests**

Write `src/providers/generationProvider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MockGenerationProvider } from "./generationProvider";
import type { GenerationConfig, ProductInput } from "../domain/types";

const product: ProductInput = {
  id: "sample-1",
  imageUrl: "/sample.svg",
  fileName: "sample.svg",
  createdAt: "2026-06-15T00:00:00.000Z",
  source: "sample",
};

const config: GenerationConfig = {
  module: "detail_page",
  platform: "shopify",
  aspectRatio: "long_page",
  style: "premium",
  outputFormat: "png",
  sellingPoints: "Foldable, lightweight, outdoor ready",
  specifications: "60 x 60 x 72 cm",
};

describe("MockGenerationProvider", () => {
  it("returns a stable mock result for a successful task", async () => {
    const provider = new MockGenerationProvider({ delayMs: 0 });
    const result = await provider.generate({ product, config });
    expect(result.creditCost).toBe(1);
    expect(result.resultUrls[0]).toContain("detail_page");
  });

  it("can return a controlled failure", async () => {
    const provider = new MockGenerationProvider({ delayMs: 0, forceFailure: true });
    await expect(provider.generate({ product, config })).rejects.toMatchObject({
      code: "mock_generation_failed",
      message: "模拟生成失败，请重试。",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm test -- src/providers/generationProvider.test.ts
```

Expected: failure because provider file does not exist.

- [ ] **Step 3: Implement provider**

Write `src/providers/generationProvider.ts`:

```ts
import type { GenerationConfig, GenerationResult, ProductInput } from "../domain/types";

export interface GenerateInput {
  product: ProductInput;
  config: GenerationConfig;
}

export interface GenerationProvider {
  generate(input: GenerateInput): Promise<GenerationResult>;
}

export class GenerationProviderError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GenerationProviderError";
    this.code = code;
  }
}

export class MockGenerationProvider implements GenerationProvider {
  private delayMs: number;
  private forceFailure: boolean;

  constructor(options: { delayMs?: number; forceFailure?: boolean } = {}) {
    this.delayMs = options.delayMs ?? 700;
    this.forceFailure = options.forceFailure ?? false;
  }

  async generate(input: GenerateInput): Promise<GenerationResult> {
    await new Promise((resolve) => window.setTimeout(resolve, this.delayMs));

    if (this.forceFailure || input.config.sellingPoints.toLowerCase().includes("fail")) {
      throw new GenerationProviderError("mock_generation_failed", "模拟生成失败，请重试。");
    }

    return {
      resultUrls: [createMockSvgDataUrl(input.config)],
      creditCost: 1,
    };
  }
}

function createMockSvgDataUrl(config: GenerationConfig) {
  const label = encodeURIComponent(`${config.module} · ${config.platform} · ${config.aspectRatio}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <rect width="1200" height="900" fill="#f7f4ed"/>
    <rect x="90" y="70" width="1020" height="760" rx="28" fill="#ffffff" stroke="#d8d0c4" stroke-width="3"/>
    <rect x="170" y="150" width="360" height="500" rx="22" fill="#d8e7de"/>
    <circle cx="350" cy="325" r="120" fill="#2f6f62"/>
    <rect x="610" y="170" width="360" height="44" rx="10" fill="#172026"/>
    <rect x="610" y="250" width="430" height="26" rx="8" fill="#b4aa9b"/>
    <rect x="610" y="300" width="360" height="26" rx="8" fill="#b4aa9b"/>
    <rect x="610" y="390" width="250" height="86" rx="18" fill="#e7bd62"/>
    <text x="610" y="585" font-family="Arial" font-size="36" fill="#172026">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
```

- [ ] **Step 4: Verify provider tests**

Run:

```powershell
npm test -- src/providers/generationProvider.test.ts
```

Expected: provider tests pass.

- [ ] **Step 5: Commit provider**

Run:

```powershell
git add src/providers
git commit -m "feat: add mock generation provider"
```

Expected: a commit is created.

## Task 4: Browser Persistence

**Files:**
- Create: `src/storage/taskStore.ts`
- Test: `src/storage/taskStore.test.ts`

- [ ] **Step 1: Write failing persistence tests**

Write `src/storage/taskStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { loadTasks, saveTasks } from "./taskStore";
import type { GenerationTask } from "../domain/types";

const task: GenerationTask = {
  id: "task-1",
  productInput: {
    id: "product-1",
    imageUrl: "/sample.svg",
    fileName: "sample.svg",
    createdAt: "2026-06-15T00:00:00.000Z",
    source: "sample",
  },
  config: {
    module: "main_image",
    platform: "amazon",
    aspectRatio: "1:1",
    style: "studio",
    outputFormat: "png",
    sellingPoints: "Portable",
    specifications: "1 kg",
  },
  status: "completed",
  resultUrls: ["/mock.svg"],
  creditCost: 1,
  createdAt: "2026-06-15T00:00:01.000Z",
  completedAt: "2026-06-15T00:00:02.000Z",
  attempt: 1,
};

describe("taskStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads tasks", () => {
    saveTasks([task]);
    expect(loadTasks()).toEqual([task]);
  });

  it("returns an empty list when stored data is invalid", () => {
    localStorage.setItem("commerce-studio-tasks-v1", "{broken");
    expect(loadTasks()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm test -- src/storage/taskStore.test.ts
```

Expected: failure because storage file does not exist.

- [ ] **Step 3: Implement storage**

Write `src/storage/taskStore.ts`:

```ts
import type { GenerationTask } from "../domain/types";

const STORAGE_KEY = "commerce-studio-tasks-v1";

export function loadTasks(): GenerationTask[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: GenerationTask[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
```

- [ ] **Step 4: Verify storage tests**

Run:

```powershell
npm test -- src/storage/taskStore.test.ts
```

Expected: persistence tests pass.

- [ ] **Step 5: Commit storage**

Run:

```powershell
git add src/storage
git commit -m "feat: persist generation tasks locally"
```

Expected: a commit is created.

## Task 5: Workspace UI and Upload Flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/Workspace.tsx`
- Create: `src/components/UploadPanel.tsx`
- Create: `src/components/ModuleNav.tsx`
- Create: `src/components/ParameterPanel.tsx`
- Create: `src/components/ResultPreview.tsx`
- Test: `src/components/workspace.test.tsx`

- [ ] **Step 1: Write failing workspace interaction tests**

Write `src/components/workspace.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Workspace } from "./Workspace";

describe("Workspace", () => {
  it("loads a sample product and preserves it while changing modules", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    expect(screen.getByAltText("当前商品图")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "详情页长图" }));
    expect(screen.getByDisplayValue("详情页长图")).toBeInTheDocument();
    expect(screen.getByAltText("当前商品图")).toBeInTheDocument();
  });

  it("updates platform and output controls", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.selectOptions(screen.getByLabelText("平台"), "shopify");
    await user.selectOptions(screen.getByLabelText("输出格式"), "webp");

    expect(screen.getByLabelText("平台")).toHaveValue("shopify");
    expect(screen.getByLabelText("输出格式")).toHaveValue("webp");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm test -- src/components/workspace.test.tsx
```

Expected: failure because workspace components do not exist.

- [ ] **Step 3: Implement workspace components**

Write `src/components/ModuleNav.tsx`:

```tsx
import { moduleLabels } from "../domain/defaults";
import type { GenerationModule } from "../domain/types";

const modules = Object.keys(moduleLabels) as GenerationModule[];

export function ModuleNav(props: {
  selected: GenerationModule;
  onSelect: (module: GenerationModule) => void;
}) {
  return (
    <nav className="module-nav" aria-label="生成模块">
      {modules.map((module) => (
        <button
          key={module}
          className={props.selected === module ? "module-item active" : "module-item"}
          onClick={() => props.onSelect(module)}
          type="button"
        >
          {moduleLabels[module]}
        </button>
      ))}
    </nav>
  );
}
```

Write `src/components/UploadPanel.tsx`:

```tsx
import type { ProductInput } from "../domain/types";

const sampleSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#f6f1e8"/><circle cx="400" cy="350" r="160" fill="#2f6f62"/><rect x="260" y="500" width="280" height="60" rx="20" fill="#172026"/></svg>`,
)}`;

export function createSampleProduct(): ProductInput {
  return {
    id: "sample-product",
    imageUrl: sampleSvg,
    fileName: "sample-product.svg",
    createdAt: new Date().toISOString(),
    source: "sample",
  };
}

export function UploadPanel(props: {
  product: ProductInput | null;
  onProductChange: (product: ProductInput) => void;
}) {
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    props.onProductChange({
      id: `upload-${Date.now()}`,
      imageUrl: URL.createObjectURL(file),
      fileName: file.name,
      createdAt: new Date().toISOString(),
      source: "upload",
    });
  }

  return (
    <section className="panel upload-panel">
      <div>
        <p className="eyebrow">商品输入</p>
        <h2>上传商品图</h2>
      </div>
      <label className="drop-zone">
        <input aria-label="上传商品图" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleFileChange} />
        <span>拖拽或选择商品图片</span>
      </label>
      <button type="button" className="secondary-button" onClick={() => props.onProductChange(createSampleProduct())}>
        使用示例商品
      </button>
      {props.product ? (
        <div className="product-preview">
          <img src={props.product.imageUrl} alt="当前商品图" />
          <span>{props.product.fileName}</span>
        </div>
      ) : (
        <p className="muted">支持 PNG、JPG、WebP。第一版在浏览器中预览并保存任务。</p>
      )}
    </section>
  );
}
```

Write `src/components/ParameterPanel.tsx`:

```tsx
import { moduleLabels } from "../domain/defaults";
import type { GenerationConfig } from "../domain/types";

export function ParameterPanel(props: {
  config: GenerationConfig;
  onChange: (config: GenerationConfig) => void;
}) {
  const set = <K extends keyof GenerationConfig>(key: K, value: GenerationConfig[K]) => {
    props.onChange({ ...props.config, [key]: value });
  };

  return (
    <aside className="panel parameter-panel">
      <p className="eyebrow">参数</p>
      <label>
        模块
        <input readOnly value={moduleLabels[props.config.module]} />
      </label>
      <label>
        平台
        <select value={props.config.platform} onChange={(event) => set("platform", event.target.value as GenerationConfig["platform"])}>
          <option value="amazon">Amazon</option>
          <option value="shopify">Shopify</option>
          <option value="independent_store">独立站</option>
        </select>
      </label>
      <label>
        尺寸
        <select value={props.config.aspectRatio} onChange={(event) => set("aspectRatio", event.target.value as GenerationConfig["aspectRatio"])}>
          <option value="1:1">1:1 主图</option>
          <option value="4:5">4:5 竖图</option>
          <option value="16:9">16:9 横幅</option>
          <option value="long_page">详情页长图</option>
        </select>
      </label>
      <label>
        风格
        <select value={props.config.style} onChange={(event) => set("style", event.target.value as GenerationConfig["style"])}>
          <option value="studio">Studio</option>
          <option value="lifestyle">Lifestyle</option>
          <option value="premium">Premium</option>
          <option value="minimal">Minimal</option>
        </select>
      </label>
      <label>
        输出格式
        <select value={props.config.outputFormat} onChange={(event) => set("outputFormat", event.target.value as GenerationConfig["outputFormat"])}>
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
          <option value="webp">WebP</option>
        </select>
      </label>
      <label>
        卖点
        <textarea value={props.config.sellingPoints} onChange={(event) => set("sellingPoints", event.target.value)} />
      </label>
      <label>
        规格
        <textarea value={props.config.specifications} onChange={(event) => set("specifications", event.target.value)} />
      </label>
    </aside>
  );
}
```

Write `src/components/ResultPreview.tsx`:

```tsx
import type { GenerationTask, ProductInput } from "../domain/types";

export function ResultPreview(props: { product: ProductInput | null; latestTask: GenerationTask | null }) {
  const resultUrl = props.latestTask?.resultUrls[0];

  return (
    <section className="panel result-panel">
      <div>
        <p className="eyebrow">预览</p>
        <h2>原图与生成结果</h2>
      </div>
      <div className="preview-grid">
        <div className="preview-box">
          {props.product ? <img src={props.product.imageUrl} alt="原始商品图" /> : <span>等待商品图</span>}
        </div>
        <div className="preview-box">
          {resultUrl ? <img src={resultUrl} alt="生成结果" /> : <span>生成后显示结果</span>}
        </div>
      </div>
      <div className="export-row">
        <button type="button" disabled={!resultUrl}>下载结果</button>
        <button type="button" disabled={!resultUrl}>复制参数</button>
      </div>
    </section>
  );
}
```

Write `src/components/Workspace.tsx`:

```tsx
import { useMemo, useState } from "react";
import { defaultConfig } from "../domain/defaults";
import type { GenerationConfig, GenerationModule, GenerationTask, ProductInput } from "../domain/types";
import { ModuleNav } from "./ModuleNav";
import { ParameterPanel } from "./ParameterPanel";
import { ResultPreview } from "./ResultPreview";
import { UploadPanel } from "./UploadPanel";

export function Workspace() {
  const [product, setProduct] = useState<ProductInput | null>(null);
  const [config, setConfig] = useState<GenerationConfig>(defaultConfig);
  const [tasks] = useState<GenerationTask[]>([]);
  const latestTask = useMemo(() => tasks[0] ?? null, [tasks]);

  function selectModule(module: GenerationModule) {
    setConfig((current) => ({ ...current, module }));
  }

  return (
    <div className="workspace">
      <ModuleNav selected={config.module} onSelect={selectModule} />
      <main className="workspace-main">
        <UploadPanel product={product} onProductChange={setProduct} />
        <ResultPreview product={product} latestTask={latestTask} />
      </main>
      <ParameterPanel config={config} onChange={setConfig} />
    </div>
  );
}
```

Write `src/components/AppShell.tsx`:

```tsx
export function AppShell(props: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <strong>Commerce Studio</strong>
          <span>跨境电商生图工作台</span>
        </div>
        <nav>
          <button type="button">工作台</button>
          <button type="button">模板库</button>
          <button type="button">历史任务</button>
          <button type="button">价格</button>
          <button type="button">账户</button>
        </nav>
      </header>
      {props.children}
    </div>
  );
}
```

Modify `src/App.tsx`:

```tsx
import { AppShell } from "./components/AppShell";
import { Workspace } from "./components/Workspace";

export function App() {
  return (
    <AppShell>
      <Workspace />
    </AppShell>
  );
}
```

- [ ] **Step 4: Replace CSS with workspace styles**

Modify `src/styles.css` with the full responsive workspace stylesheet:

```css
:root {
  color: #172026;
  background: #f4f1ea;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
button, input, select, textarea { font: inherit; }
button { border: 0; cursor: pointer; }

.shell { min-height: 100vh; }
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 28px;
  background: #172026;
  color: #fff;
}
.topbar div { display: flex; gap: 12px; align-items: baseline; }
.topbar span { color: #bfc8c2; font-size: 14px; }
.topbar nav { display: flex; gap: 8px; flex-wrap: wrap; }
.topbar button {
  background: transparent;
  color: #e9eee9;
  padding: 8px 10px;
  border-radius: 6px;
}
.workspace {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr) 300px;
  gap: 16px;
  padding: 18px;
}
.module-nav, .panel {
  background: #fff;
  border: 1px solid #ddd5c8;
  border-radius: 8px;
}
.module-nav { display: flex; flex-direction: column; gap: 6px; padding: 10px; }
.module-item {
  background: transparent;
  text-align: left;
  color: #27332f;
  padding: 11px 12px;
  border-radius: 6px;
}
.module-item.active { background: #2f6f62; color: #fff; }
.workspace-main { display: grid; gap: 16px; }
.panel { padding: 18px; }
.eyebrow { margin: 0 0 6px; color: #6d766f; font-size: 12px; text-transform: uppercase; }
h2 { margin: 0 0 14px; font-size: 22px; letter-spacing: 0; }
.drop-zone {
  display: grid;
  place-items: center;
  min-height: 130px;
  border: 1px dashed #9a9185;
  border-radius: 8px;
  background: #faf8f3;
  color: #555f58;
}
.drop-zone input { width: 1px; height: 1px; opacity: 0; position: absolute; }
.secondary-button, .export-row button {
  margin-top: 12px;
  background: #172026;
  color: #fff;
  padding: 10px 12px;
  border-radius: 6px;
}
.product-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}
.product-preview img { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd5c8; }
.muted { color: #6d766f; }
.parameter-panel { display: grid; gap: 12px; align-content: start; }
.parameter-panel label { display: grid; gap: 6px; color: #3d4742; font-size: 14px; }
.parameter-panel input, .parameter-panel select, .parameter-panel textarea {
  width: 100%;
  border: 1px solid #cfc7bb;
  border-radius: 6px;
  padding: 9px 10px;
  color: #172026;
  background: #fff;
}
.parameter-panel textarea { min-height: 76px; resize: vertical; }
.preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.preview-box {
  min-height: 260px;
  display: grid;
  place-items: center;
  background: #f7f4ed;
  border: 1px solid #ddd5c8;
  border-radius: 8px;
  overflow: hidden;
  color: #6d766f;
}
.preview-box img { width: 100%; height: 100%; object-fit: contain; }
.export-row { display: flex; gap: 10px; flex-wrap: wrap; }
.export-row button:disabled { opacity: 0.45; cursor: not-allowed; }

@media (max-width: 980px) {
  .workspace { grid-template-columns: 1fr; }
  .module-nav { flex-direction: row; overflow-x: auto; }
  .module-item { white-space: nowrap; }
  .topbar { align-items: flex-start; flex-direction: column; }
}

@media (max-width: 620px) {
  .workspace { padding: 10px; }
  .preview-grid { grid-template-columns: 1fr; }
  .topbar { padding: 14px; }
}
```

- [ ] **Step 5: Verify workspace tests**

Run:

```powershell
npm test -- src/components/workspace.test.tsx
```

Expected: workspace tests pass.

- [ ] **Step 6: Commit workspace UI**

Run:

```powershell
git add src
git commit -m "feat: add ecommerce studio workspace layout"
```

Expected: a commit is created.

## Task 6: Task Execution, History, Retry, and Export Controls

**Files:**
- Modify: `src/components/Workspace.tsx`
- Create: `src/components/TaskHistory.tsx`
- Modify: `src/components/ResultPreview.tsx`
- Modify: `src/components/workspace.test.tsx`

- [ ] **Step 1: Extend workspace tests for generation and retry**

Append these tests to `src/components/workspace.test.tsx`:

```tsx
it("creates a completed generation task with a mock result", async () => {
  const user = userEvent.setup();
  render(<Workspace />);

  await user.click(screen.getByRole("button", { name: "使用示例商品" }));
  await user.click(screen.getByRole("button", { name: "生成素材" }));

  expect(await screen.findByAltText("生成结果")).toBeInTheDocument();
  expect(screen.getByText("已完成")).toBeInTheDocument();
});

it("shows a failed task and supports retry", async () => {
  const user = userEvent.setup();
  render(<Workspace />);

  await user.click(screen.getByRole("button", { name: "使用示例商品" }));
  await user.type(screen.getByLabelText("卖点"), "fail");
  await user.click(screen.getByRole("button", { name: "生成素材" }));

  expect(await screen.findByText("模拟生成失败，请重试。")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "重试" }));
  expect(screen.getByText("处理中")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm test -- src/components/workspace.test.tsx
```

Expected: failure because task execution buttons and history do not exist.

- [ ] **Step 3: Implement TaskHistory**

Write `src/components/TaskHistory.tsx`:

```tsx
import { moduleLabels } from "../domain/defaults";
import type { GenerationTask } from "../domain/types";

const statusLabels = {
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
} as const;

export function TaskHistory(props: {
  tasks: GenerationTask[];
  onRetry: (task: GenerationTask) => void;
  onReuse: (task: GenerationTask) => void;
}) {
  return (
    <section className="panel history-panel">
      <div>
        <p className="eyebrow">历史</p>
        <h2>最近任务</h2>
      </div>
      {props.tasks.length === 0 ? (
        <p className="muted">还没有生成任务。</p>
      ) : (
        <div className="task-list">
          {props.tasks.map((task) => (
            <article className="task-row" key={task.id}>
              <div>
                <strong>{moduleLabels[task.config.module]}</strong>
                <span>{statusLabels[task.status]}</span>
                {task.errorMessage ? <p>{task.errorMessage}</p> : null}
              </div>
              <div className="task-actions">
                <button type="button" onClick={() => props.onReuse(task)}>复用参数</button>
                {task.status === "failed" ? <button type="button" onClick={() => props.onRetry(task)}>重试</button> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Update Workspace with provider and persistence**

Modify `src/components/Workspace.tsx`:

```tsx
import { useMemo, useState } from "react";
import { defaultConfig } from "../domain/defaults";
import { completeTask, createTask, failTask, markProcessing, retryTask } from "../domain/taskState";
import type { GenerationConfig, GenerationModule, GenerationTask, ProductInput } from "../domain/types";
import { GenerationProviderError, MockGenerationProvider } from "../providers/generationProvider";
import { loadTasks, saveTasks } from "../storage/taskStore";
import { ModuleNav } from "./ModuleNav";
import { ParameterPanel } from "./ParameterPanel";
import { ResultPreview } from "./ResultPreview";
import { TaskHistory } from "./TaskHistory";
import { UploadPanel } from "./UploadPanel";

const provider = new MockGenerationProvider({ delayMs: 20 });

export function Workspace() {
  const [product, setProduct] = useState<ProductInput | null>(null);
  const [config, setConfig] = useState<GenerationConfig>(defaultConfig);
  const [tasks, setTasks] = useState<GenerationTask[]>(() => loadTasks());
  const latestTask = useMemo(() => tasks[0] ?? null, [tasks]);

  function updateTasks(nextTasks: GenerationTask[]) {
    setTasks(nextTasks);
    saveTasks(nextTasks);
  }

  function selectModule(module: GenerationModule) {
    setConfig((current) => ({ ...current, module }));
  }

  async function runTask(baseTask?: GenerationTask) {
    const selectedProduct = baseTask?.productInput ?? product;
    const selectedConfig = baseTask?.config ?? config;
    if (!selectedProduct) return;

    const queued = baseTask ? retryTask(baseTask, new Date().toISOString()) : createTask({
      product: selectedProduct,
      config: selectedConfig,
      now: new Date().toISOString(),
    });
    const processing = markProcessing(queued);
    updateTasks([processing, ...tasks.filter((task) => task.id !== baseTask?.id)]);

    try {
      const result = await provider.generate({ product: selectedProduct, config: selectedConfig });
      const completed = completeTask(processing, {
        resultUrls: result.resultUrls,
        creditCost: result.creditCost,
        completedAt: new Date().toISOString(),
      });
      updateTasks([completed, ...tasks.filter((task) => task.id !== baseTask?.id)]);
    } catch (error) {
      const providerError = error instanceof GenerationProviderError
        ? error
        : new GenerationProviderError("unknown_generation_error", "生成失败，请重试。");
      const failed = failTask(processing, {
        errorCode: providerError.code,
        errorMessage: providerError.message,
        completedAt: new Date().toISOString(),
      });
      updateTasks([failed, ...tasks.filter((task) => task.id !== baseTask?.id)]);
    }
  }

  function reuseTask(task: GenerationTask) {
    setProduct(task.productInput);
    setConfig(task.config);
  }

  return (
    <div className="workspace">
      <ModuleNav selected={config.module} onSelect={selectModule} />
      <main className="workspace-main">
        <UploadPanel product={product} onProductChange={setProduct} />
        <ResultPreview product={product} latestTask={latestTask} onGenerate={() => void runTask()} />
        <TaskHistory tasks={tasks} onRetry={(task) => void runTask(task)} onReuse={reuseTask} />
      </main>
      <ParameterPanel config={config} onChange={setConfig} />
    </div>
  );
}
```

- [ ] **Step 5: Update ResultPreview with generate button**

Modify `src/components/ResultPreview.tsx`:

```tsx
import type { GenerationTask, ProductInput } from "../domain/types";

export function ResultPreview(props: {
  product: ProductInput | null;
  latestTask: GenerationTask | null;
  onGenerate: () => void;
}) {
  const resultUrl = props.latestTask?.resultUrls[0];
  const isProcessing = props.latestTask?.status === "processing" || props.latestTask?.status === "queued";

  return (
    <section className="panel result-panel">
      <div>
        <p className="eyebrow">预览</p>
        <h2>原图与生成结果</h2>
      </div>
      <div className="preview-grid">
        <div className="preview-box">
          {props.product ? <img src={props.product.imageUrl} alt="原始商品图" /> : <span>等待商品图</span>}
        </div>
        <div className="preview-box">
          {isProcessing ? <span>处理中</span> : resultUrl ? <img src={resultUrl} alt="生成结果" /> : <span>生成后显示结果</span>}
        </div>
      </div>
      {props.latestTask?.errorMessage ? <p className="error-text">{props.latestTask.errorMessage}</p> : null}
      <div className="export-row">
        <button type="button" disabled={!props.product || isProcessing} onClick={props.onGenerate}>生成素材</button>
        <button type="button" disabled={!resultUrl}>下载结果</button>
        <button type="button" disabled={!resultUrl}>复制参数</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Add history CSS**

Append to `src/styles.css`:

```css
.history-panel { display: grid; gap: 12px; }
.task-list { display: grid; gap: 10px; }
.task-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #ddd5c8;
  border-radius: 8px;
  background: #faf8f3;
}
.task-row strong, .task-row span { display: block; }
.task-row span { color: #2f6f62; margin-top: 4px; }
.task-row p, .error-text { color: #9b2f2f; margin: 6px 0 0; }
.task-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start; justify-content: flex-end; }
.task-actions button {
  background: #ece4d7;
  color: #172026;
  padding: 8px 10px;
  border-radius: 6px;
}
@media (max-width: 620px) {
  .task-row { flex-direction: column; }
  .task-actions { justify-content: flex-start; }
}
```

- [ ] **Step 7: Verify task flow tests**

Run:

```powershell
npm test -- src/components/workspace.test.tsx
```

Expected: workspace upload, generation, failure, and retry tests pass.

- [ ] **Step 8: Commit task flow**

Run:

```powershell
git add src
git commit -m "feat: connect workspace generation tasks"
```

Expected: a commit is created.

## Task 7: Secondary Pages and Navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`
- Create: `src/components/TemplatesPage.tsx`
- Create: `src/components/PricingPage.tsx`
- Create: `src/components/AccountPage.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Replace app test with navigation tests**

Modify `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App navigation", () => {
  it("opens templates and returns to the workspace", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "模板库" }));
    expect(screen.getByRole("heading", { name: "模板库" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "工作台" }));
    expect(screen.getByRole("heading", { name: "上传商品图" })).toBeInTheDocument();
  });

  it("opens pricing and account surfaces", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "价格" }));
    expect(screen.getByRole("heading", { name: "价格" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "账户" }));
    expect(screen.getByRole("heading", { name: "账户" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: failure because navigation state and secondary pages are not implemented.

- [ ] **Step 3: Implement secondary pages**

Write `src/components/TemplatesPage.tsx`:

```tsx
const templates = [
  ["Amazon 主图", "白底、1:1、强商品识别"],
  ["Shopify Banner", "16:9 横幅、独立站首屏"],
  ["详情页长图", "卖点、规格、场景组合"],
  ["生活方式场景", "真实使用感和高级场景"],
];

export function TemplatesPage() {
  return (
    <main className="page-surface">
      <h1>模板库</h1>
      <div className="template-grid">
        {templates.map(([title, body]) => (
          <article className="template-card" key={title}>
            <div className="template-thumb" />
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
```

Write `src/components/PricingPage.tsx`:

```tsx
export function PricingPage() {
  return (
    <main className="page-surface">
      <h1>价格</h1>
      <section className="pricing-grid">
        <article className="price-card"><h2>Starter</h2><p>适合试用和少量商品。</p><strong>50 credits</strong></article>
        <article className="price-card featured"><h2>Pro</h2><p>适合跨境卖家日常出图。</p><strong>500 credits</strong></article>
        <article className="price-card"><h2>Studio</h2><p>适合批量商品和团队。</p><strong>2000 credits</strong></article>
      </section>
    </main>
  );
}
```

Write `src/components/AccountPage.tsx`:

```tsx
export function AccountPage() {
  return (
    <main className="page-surface">
      <h1>账户</h1>
      <section className="account-panel">
        <p>当前为本地演示账户。</p>
        <p>任务、消耗和历史记录先保存在浏览器中，后续可接入真实登录和配额系统。</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Wire navigation state**

Modify `src/components/AppShell.tsx`:

```tsx
export type AppPage = "workspace" | "templates" | "history" | "pricing" | "account";

const labels: Record<AppPage, string> = {
  workspace: "工作台",
  templates: "模板库",
  history: "历史任务",
  pricing: "价格",
  account: "账户",
};

export function AppShell(props: {
  page: AppPage;
  onPageChange: (page: AppPage) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <strong>Commerce Studio</strong>
          <span>跨境电商生图工作台</span>
        </div>
        <nav>
          {(Object.keys(labels) as AppPage[]).map((page) => (
            <button
              key={page}
              type="button"
              className={props.page === page ? "nav-active" : ""}
              onClick={() => props.onPageChange(page)}
            >
              {labels[page]}
            </button>
          ))}
        </nav>
      </header>
      {props.children}
    </div>
  );
}
```

Modify `src/App.tsx`:

```tsx
import { useState } from "react";
import { AccountPage } from "./components/AccountPage";
import { AppPage, AppShell } from "./components/AppShell";
import { PricingPage } from "./components/PricingPage";
import { TemplatesPage } from "./components/TemplatesPage";
import { Workspace } from "./components/Workspace";

export function App() {
  const [page, setPage] = useState<AppPage>("workspace");

  return (
    <AppShell page={page} onPageChange={setPage}>
      {page === "workspace" || page === "history" ? <Workspace /> : null}
      {page === "templates" ? <TemplatesPage /> : null}
      {page === "pricing" ? <PricingPage /> : null}
      {page === "account" ? <AccountPage /> : null}
    </AppShell>
  );
}
```

- [ ] **Step 5: Add secondary page CSS**

Append to `src/styles.css`:

```css
.topbar button.nav-active { background: #2f6f62; color: #fff; }
.page-surface { padding: 24px; }
.page-surface h1 { margin: 0 0 18px; font-size: 28px; letter-spacing: 0; }
.template-grid, .pricing-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.pricing-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.template-card, .price-card, .account-panel {
  background: #fff;
  border: 1px solid #ddd5c8;
  border-radius: 8px;
  padding: 16px;
}
.template-thumb {
  aspect-ratio: 4 / 3;
  border-radius: 6px;
  background: linear-gradient(135deg, #d8e7de, #e7bd62);
}
.template-card h2, .price-card h2 { font-size: 18px; margin: 12px 0 8px; }
.template-card p, .price-card p, .account-panel p { color: #555f58; }
.price-card.featured { border-color: #2f6f62; box-shadow: 0 0 0 2px rgba(47, 111, 98, 0.12); }
@media (max-width: 820px) {
  .template-grid, .pricing-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 6: Verify app navigation**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: navigation tests pass.

- [ ] **Step 7: Commit secondary pages**

Run:

```powershell
git add src
git commit -m "feat: add studio secondary pages"
```

Expected: a commit is created.

## Task 8: End-to-End Verification and Browser QA

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/workspace.spec.ts`
- Modify: `src/styles.css` only if QA reveals responsive defects.

- [ ] **Step 1: Add Playwright config**

Write `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
```

- [ ] **Step 2: Add E2E flow test**

Write `tests/e2e/workspace.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("sample product can generate a mock ecommerce image", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "使用示例商品" }).click();
  await expect(page.getByAltText("当前商品图")).toBeVisible();

  await page.getByLabel("平台").selectOption("shopify");
  await page.getByLabel("输出格式").selectOption("webp");
  await page.getByRole("button", { name: "生成素材" }).click();

  await expect(page.getByAltText("生成结果")).toBeVisible();
  await expect(page.getByText("已完成")).toBeVisible();
});

test("navigation surfaces render without overlap-critical missing content", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "模板库" }).click();
  await expect(page.getByRole("heading", { name: "模板库" })).toBeVisible();

  await page.getByRole("button", { name: "价格" }).click();
  await expect(page.getByRole("heading", { name: "价格" })).toBeVisible();

  await page.getByRole("button", { name: "账户" }).click();
  await expect(page.getByRole("heading", { name: "账户" })).toBeVisible();
});
```

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm run lint
npm test
npm run build
npm run e2e
```

Expected: TypeScript check, unit tests, production build, and Playwright tests pass.

- [ ] **Step 4: Open app for manual browser QA**

Run:

```powershell
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173` and manually verify:

- Desktop: left module rail, center upload/result, right parameter panel are visible.
- Mobile: upload, parameters, result, and history stack vertically without text overlap.
- Sample product creates a result.
- A selling point containing `fail` creates a readable failure and retry button.
- Template, pricing, and account pages are reachable from the top navigation.

- [ ] **Step 5: Commit verification artifacts**

Run:

```powershell
git add playwright.config.ts tests src package.json package-lock.json
git commit -m "test: add ecommerce studio end-to-end coverage"
```

Expected: a commit is created.

## Self-Review

- Spec coverage: Tasks 1-8 cover scaffold, real upload preview, module selection, parameter controls, mock provider, success-only task charging, failure handling, retry, local history, template/pricing/account surfaces, responsive layout, and E2E verification.
- Provider boundary: Task 3 defines the provider interface and mock provider; Task 6 consumes the provider through that boundary.
- First-version boundaries: video remains a module entry through `video_preview`; complex video generation and full canvas editing are not introduced.
- Verification: Task 8 requires lint, unit tests, build, E2E tests, and manual desktop/mobile browser checks.
