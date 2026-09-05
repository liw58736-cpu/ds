import { defaultConfig } from "../domain/defaults";
import type { GenerationConfig, ProductInput } from "../domain/types";
import { getAccountSnapshot } from "./accountStore";

export type WorkspaceModule =
  "main_image" | "detail_page" | "white_background" | "lifestyle";
export interface WorkspaceDraft {
  config: GenerationConfig;
  product: ProductInput | null;
  updatedAt?: string;
}
export type WorkspaceDrafts = Record<WorkspaceModule, WorkspaceDraft>;
export const workspaceModules: WorkspaceModule[] = [
  "main_image",
  "detail_page",
  "white_background",
  "lifestyle",
];

export function getStorageOwner(): string {
  const session = getAccountSnapshot().session;
  return session
    ? `account:${session.userId || session.identifier.trim().toLowerCase()}`
    : "guest";
}

export function createDefaultDraft(module: WorkspaceModule): WorkspaceDraft {
  return {
    product: null,
    config: {
      ...defaultConfig,
      module,
      selectedMainModules: [],
      detailModuleCounts: {},
      moduleReferenceAssets: {},
      ...(module === "detail_page"
        ? { aspectRatio: "long_page", outputFormat: "jpg" }
        : {}),
      ...(module === "white_background"
        ? { aspectRatio: "original", whiteBackgroundMode: "white_background" }
        : {}),
      ...(module === "lifestyle"
        ? { aspectRatio: "4:5", outputFormat: "jpg", style: "lifestyle" }
        : {}),
    },
  };
}
const key = (owner: string, module: string) =>
  `kroma-draft-v1:${encodeURIComponent(owner)}:${module}`;
export function loadWorkspaceDrafts(
  owner = getStorageOwner(),
): WorkspaceDrafts {
  return Object.fromEntries(
    workspaceModules.map((module) => {
      const fallback = createDefaultDraft(module);
      try {
        const saved = JSON.parse(
          localStorage.getItem(key(owner, module)) || "null",
        );
        if (saved?.config?.module === module) {
          const product =
            saved.product?.imageUrl &&
            !saved.product.imageUrl.startsWith("blob:")
              ? saved.product
              : null;
          return [
            module,
            {
              ...saved,
              product,
              config: { ...fallback.config, ...saved.config },
            },
          ];
        }
      } catch {
        /* Invalid draft never blocks opening the editor. */
      }
      return [module, fallback];
    }),
  ) as WorkspaceDrafts;
}
export function saveWorkspaceDraft(
  owner: string,
  module: WorkspaceModule,
  draft: WorkspaceDraft,
): boolean {
  try {
    localStorage.setItem(
      key(owner, module),
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    );
    return true;
  } catch {
    return false;
  }
}

export function reuseTaskDraft(task: {
  config: GenerationConfig;
  productInput: ProductInput;
}) {
  const module = task.config.module as WorkspaceModule;
  if (!workspaceModules.includes(module)) return;
  saveWorkspaceDraft(getStorageOwner(), module, {
    config: task.config,
    product: task.productInput,
  });
  window.dispatchEvent(new CustomEvent("kroma-reuse-task", { detail: task }));
}
