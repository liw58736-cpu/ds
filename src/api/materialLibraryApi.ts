import { listGenerationTasks } from "./generationApi";
import { listSavedMaterials } from "./materialImportApi";
import { getTaskResultAssets } from "../domain/resultAssets";
import { getStorageOwner } from "../storage/workspaceDraftStore";
import { loadTasks } from "../storage/taskStore";

export interface MaterialLibraryAsset {
  id: string;
  imageUrl: string;
  fileName: string;
  createdAt: string;
  source: "saved" | "generated";
  sourceLabel: string;
}

const cachePrefix = "kroma-material-library-v1";
const cacheMaxAgeMs = 24 * 60 * 60 * 1000;
const cacheMaxItems = 40;
const inFlightReads = new Map<string, Promise<MaterialLibraryAsset[]>>();

function cacheKey(owner: string): string {
  return `${cachePrefix}:${encodeURIComponent(owner)}`;
}

export function getCachedMaterialLibraryAssets(
  owner = getStorageOwner(),
): MaterialLibraryAsset[] {
  let storedAssets: MaterialLibraryAsset[] = [];
  try {
    const stored = JSON.parse(localStorage.getItem(cacheKey(owner)) || "null");
    if (
      !stored ||
      typeof stored.savedAt !== "number" ||
      Date.now() - stored.savedAt > cacheMaxAgeMs ||
      !Array.isArray(stored.assets)
    ) {
      storedAssets = [];
    } else {
      storedAssets = stored.assets
        .filter(isMaterialLibraryAsset)
        .slice(0, cacheMaxItems);
    }
  } catch {
    storedAssets = [];
  }
  const localGenerated = generatedAssetsFromTasks(loadTasks());
  return mergeLibraryAssets([...storedAssets, ...localGenerated]).slice(
    0,
    cacheMaxItems,
  );
}

function isMaterialLibraryAsset(value: unknown): value is MaterialLibraryAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<MaterialLibraryAsset>;
  return (
    typeof asset.id === "string" &&
    typeof asset.imageUrl === "string" &&
    asset.imageUrl.length <= 4096 &&
    isCacheableImageUrl(asset.imageUrl) &&
    typeof asset.fileName === "string" &&
    typeof asset.createdAt === "string" &&
    (asset.source === "saved" || asset.source === "generated") &&
    typeof asset.sourceLabel === "string"
  );
}

function saveMaterialLibraryCache(
  owner: string,
  assets: MaterialLibraryAsset[],
) {
  try {
    localStorage.setItem(
      cacheKey(owner),
      JSON.stringify({
        savedAt: Date.now(),
        assets: assets
          .filter((asset) => isCacheableImageUrl(asset.imageUrl))
          .slice(0, cacheMaxItems),
      }),
    );
  } catch {
    // The remote library still works when browser storage is unavailable.
  }
}

export function rememberMaterialLibraryAssets(
  assets: MaterialLibraryAsset[],
  owner = getStorageOwner(),
) {
  saveMaterialLibraryCache(
    owner,
    mergeLibraryAssets([...assets, ...getCachedMaterialLibraryAssets(owner)]),
  );
}

function generatedAssetsFromTasks(
  tasks: Awaited<ReturnType<typeof listGenerationTasks>>,
): MaterialLibraryAsset[] {
  return tasks.flatMap((task) => {
    if (task.status !== "completed" && task.status !== "partial") return [];
    return getTaskResultAssets(task)
      .filter((asset) => isCacheableImageUrl(asset.url))
      .map((asset, index) => ({
        id: `generated:${task.id}:${index}`,
        imageUrl: asset.url,
        fileName: asset.label || `生成图片 ${index + 1}`,
        createdAt: task.completedAt ?? task.createdAt,
        source: "generated" as const,
        sourceLabel: "生成结果",
      }));
  });
}

function isCacheableImageUrl(value: string): boolean {
  return (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    (value.startsWith("/") && !value.startsWith("//"))
  );
}

function mergeLibraryAssets(
  assets: MaterialLibraryAsset[],
): MaterialLibraryAsset[] {
  const uniqueByUrl = new Map<string, MaterialLibraryAsset>();
  for (const asset of assets.sort(
    (first, second) =>
      Date.parse(second.createdAt) - Date.parse(first.createdAt),
  )) {
    if (!uniqueByUrl.has(asset.imageUrl)) uniqueByUrl.set(asset.imageUrl, asset);
  }
  return Array.from(uniqueByUrl.values());
}

export async function listMaterialLibraryAssets(
  offset = 0,
  limit = 100,
): Promise<MaterialLibraryAsset[]> {
  const owner = getStorageOwner();
  const requestLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const requestKey = `${owner}:${offset}:${requestLimit}`;
  const running = inFlightReads.get(requestKey);
  if (running) return running;
  const request = fetchMaterialLibraryAssets(owner, offset, requestLimit);
  inFlightReads.set(requestKey, request);
  try {
    return await request;
  } finally {
    inFlightReads.delete(requestKey);
  }
}

export function prefetchMaterialLibraryAssets(
  limit = 40,
): Promise<MaterialLibraryAsset[]> {
  const cached = getCachedMaterialLibraryAssets();
  return cached.length
    ? Promise.resolve(cached)
    : listMaterialLibraryAssets(0, limit);
}

async function fetchMaterialLibraryAssets(
  owner: string,
  offset: number,
  limit: number,
): Promise<MaterialLibraryAsset[]> {
  const [savedResult, generatedResult] = await Promise.allSettled([
    listSavedMaterials(limit, offset),
    listGenerationTasks({ limit, offset, strict: true }),
  ]);
  const assets: MaterialLibraryAsset[] = [];
  const cached = offset === 0 ? getCachedMaterialLibraryAssets(owner) : [];

  if (savedResult.status === "fulfilled") {
    assets.push(
      ...savedResult.value.map((material) => ({
        id: `saved:${material.id}`,
        imageUrl: material.imageUrl,
        fileName: material.fileName,
        createdAt: material.createdAt,
        source: "saved" as const,
        sourceLabel: "保存图片",
      })),
    );
  }

  if (generatedResult.status === "fulfilled") {
    assets.push(...generatedAssetsFromTasks(generatedResult.value));
  }

  if (savedResult.status === "rejected")
    assets.push(...cached.filter((asset) => asset.source === "saved"));
  if (generatedResult.status === "rejected")
    assets.push(...cached.filter((asset) => asset.source === "generated"));

  if (
    assets.length === 0 &&
    (savedResult.status === "rejected" || generatedResult.status === "rejected")
  ) {
    throw new Error("图片库暂时无法同步，请稍后重试。");
  }

  const result = mergeLibraryAssets(assets);
  if (offset === 0 && getStorageOwner() === owner)
    saveMaterialLibraryCache(owner, result);
  return result;
}
