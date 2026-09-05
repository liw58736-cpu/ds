import { listSavedMaterials } from "./materialImportApi";
import { refreshKromaSession } from "./accountApi";
import { fetchWithTimeout } from "./requestTimeout";
import { buildTaskListRequest } from "./apiContracts";
import { requestRemoteJson, shouldUseRemoteBackend } from "./remoteBackendClient";
import { getTaskResultAssets } from "../domain/resultAssets";
import type { GenerationTask } from "../domain/types";
import { ACCOUNT_CHANGED_EVENT, type AccountSession } from "../storage/accountStore";
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
export interface MaterialLibraryProgress {
  assets: MaterialLibraryAsset[];
  pending: boolean;
  hasMore: boolean;
  failedSources: MaterialLibraryAsset["source"][];
}

interface MaterialLibraryReadOptions {
  onProgress?: (progress: MaterialLibraryProgress) => void;
  signal?: AbortSignal;
}

interface LibraryRead {
  promise: Promise<MaterialLibraryAsset[]>;
  listeners: Set<NonNullable<MaterialLibraryReadOptions["onProgress"]>>;
  progress?: MaterialLibraryProgress;
  subscribers: number;
  abandoned: boolean;
}

const inFlightReads = new Map<string, LibraryRead>();
let latestCacheRead: LibraryRead | undefined;

// accountStore's snapshot getter initializes guest storage. Cache reads must
// also work before that initialization and when browser storage is unavailable.
function readLibrarySession(): AccountSession | null {
  try {
    const account = JSON.parse(
      localStorage.getItem("commerce-studio-account-v1") || "null",
    );
    const session = account?.session;
    if (
      typeof account?.balance !== "number" ||
      !Array.isArray(account?.transactions) ||
      typeof session?.identifier !== "string" ||
      !["login", "register"].includes(session.authView) ||
      !["code", "password"].includes(session.mode) ||
      typeof session.createdAt !== "string"
    ) return null;
    return session;
  } catch {
    return null;
  }
}

function getLibraryOwner(): string {
  const session = readLibrarySession();
  return session
    ? `account:${typeof session.userId === "string" && session.userId ? session.userId : session.identifier.trim().toLowerCase()}`
    : "guest";
}

let activeOwner = getLibraryOwner();
let ownerRevision = 0;
function syncLibraryOwner() {
  const owner = getLibraryOwner();
  if (owner !== activeOwner) {
    activeOwner = owner;
    ownerRevision++;
    inFlightReads.clear();
    latestCacheRead = undefined;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener(ACCOUNT_CHANGED_EVENT, syncLibraryOwner);
  window.addEventListener("storage", syncLibraryOwner);
}

function cacheKey(owner: string): string {
  return `${cachePrefix}:${encodeURIComponent(owner)}`;
}

export function getCachedMaterialLibraryAssets(
  owner = getLibraryOwner(),
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
  const localGenerated = generatedAssetsFromTasks(loadTasks({ owner, readOnly: true }));
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
  owner = getLibraryOwner(),
) {
  // A pending list snapshot predates this explicit save.
  latestCacheRead = undefined;
  saveMaterialLibraryCache(
    owner,
    mergeLibraryAssets([...assets, ...getCachedMaterialLibraryAssets(owner)]),
  );
}

function generatedAssetsFromTasks(
  tasks: GenerationTask[],
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
  options: MaterialLibraryReadOptions = {},
): Promise<MaterialLibraryAsset[]> {
  if (options.signal?.aborted) throw new DOMException("读取已取消", "AbortError");
  syncLibraryOwner();
  const owner = activeOwner;
  const revision = ownerRevision;
  const requestLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(100, Math.floor(limit))) : 100;
  const requestOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const requestKey = `${revision}:${owner}:${requestOffset}:${requestLimit}`;
  const isCurrent = () => {
    syncLibraryOwner();
    return activeOwner === owner && ownerRevision === revision;
  };
  let running = inFlightReads.get(requestKey);
  if (!running) {
    const read: LibraryRead = {
      promise: Promise.resolve([]), listeners: new Set(), subscribers: 1, abandoned: false,
    };
    if (options.onProgress) read.listeners.add(options.onProgress);
    inFlightReads.set(requestKey, read);
    if (requestOffset === 0) latestCacheRead = read;
    read.promise = fetchMaterialLibraryAssets(owner, requestOffset, requestLimit, () => isCurrent() && !read.abandoned, (progress) => {
      read.progress = progress;
      for (const listener of read.listeners) {
        // A consumer closing its dialog must not interrupt shared reads.
        try { listener(progress); } catch { /* Other subscribers still receive progress. */ }
      }
    }, () => latestCacheRead === read).finally(() => {
      if (inFlightReads.get(requestKey) === read) inFlightReads.delete(requestKey);
    });
    running = read;
  } else {
    running.subscribers++;
    if (options.onProgress) {
      running.listeners.add(options.onProgress);
      if (running.progress) {
        try { options.onProgress(running.progress); } catch { /* Isolate subscriber failures. */ }
      }
    }
  }
  const read = running;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    if (options.onProgress) read.listeners.delete(options.onProgress);
    if (--read.subscribers === 0) read.abandoned = true;
    // A reopened dialog starts a fresh read. Existing subscribers may still
    // finish their shared request, but new subscribers cannot join that scene.
    if ((read.abandoned || options.signal?.aborted) && inFlightReads.get(requestKey) === read)
      inFlightReads.delete(requestKey);
  };
  options.signal?.addEventListener("abort", release, { once: true });
  try {
    const assets = await waitForLibraryRead(read.promise, options.signal);
    if (!isCurrent()) throw new Error("账户已切换，请重新读取图片库。");
    return assets;
  } finally {
    options.signal?.removeEventListener("abort", release);
    release();
  }
}

function waitForLibraryRead<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException("读取已取消", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", abort); resolve(value); },
      (error) => { signal.removeEventListener("abort", abort); reject(error); },
    );
    if (signal.aborted) abort();
  });
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
  isCurrent: () => boolean,
  onProgress: (progress: MaterialLibraryProgress) => void,
  canCache: () => boolean,
): Promise<MaterialLibraryAsset[]> {
  const cached = offset === 0 ? getCachedMaterialLibraryAssets(owner) : [];
  const sources: MaterialLibraryAsset["source"][] = ["saved", "generated"];
  const pages = new Map<MaterialLibraryAsset["source"], MaterialLibraryAsset[]>();
  const counts = new Map<MaterialLibraryAsset["source"], number>();
  const failedSources: MaterialLibraryAsset["source"][] = [];
  const snapshot = (): MaterialLibraryProgress => ({
    assets: mergeLibraryAssets(sources.flatMap((source) =>
      pages.get(source) ?? cached.filter((asset) => asset.source === source),
    )),
    pending: counts.size + failedSources.length < sources.length,
    // Count source records, not flattened images: a page of pending/failed
    // jobs can contain no selectable images and still have older results.
    hasMore: counts.size < sources.length || [...counts.values()].some((count) => count >= limit),
    failedSources: [...failedSources],
  });
  const publish = () => { if (isCurrent()) onProgress(snapshot()); };
  publish();

  await Promise.all(sources.map(async (source) => {
    try {
      if (source === "saved") {
        const materials = await listSavedMaterials(limit, offset);
        pages.set(source, materials.map((material) => ({
          id: `saved:${material.id}`,
          imageUrl: material.imageUrl,
          fileName: material.fileName,
          createdAt: material.createdAt,
          source,
          sourceLabel: "保存图片",
        })));
        counts.set(source, materials.length);
      } else {
        const tasks = await listLibraryGenerationTasks(owner, offset, limit, isCurrent);
        const cloudIds = new Set(tasks.map((task) => task.id));
        const local = offset === 0
          ? generatedAssetsFromTasks(loadTasks({ owner, readOnly: true })
              .filter((task) => !cloudIds.has(task.id)))
          : [];
        pages.set(source, [...generatedAssetsFromTasks(tasks), ...local]);
        counts.set(source, tasks.length);
      }
    } catch {
      failedSources.push(source);
    }
    publish();
  }));
  if (!isCurrent()) throw new Error("账户已切换，请重新读取图片库。");
  const result = snapshot().assets;
  // Never let an offset-based caller skip the failed source's older page.
  if (failedSources.length && (offset > 0 || result.length === 0)) {
    throw new Error("图片库暂时无法同步，请稍后重试。");
  }
  if (offset === 0 && !failedSources.length && canCache())
    saveMaterialLibraryCache(owner, result);
  return result;
}

async function listLibraryGenerationTasks(
  owner: string,
  offset: number,
  limit: number,
  isCurrent: () => boolean,
): Promise<GenerationTask[]> {
  const baseUrl = import.meta.env.VITE_WEB_API_BASE_URL?.trim().replace(/\/+$/, "");
  let token = readLibrarySession()?.accessToken;
  if (baseUrl && token) {
    // Read raw cloud pages. generationApi merges local tasks and normalizes
    // their recovery state, which both mutates storage and hides page lengths.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!isCurrent()) throw new Error("账户已切换");
      const response = await fetchWithTimeout(
        `${baseUrl}/generations?limit=${limit}${offset ? `&offset=${offset}` : ""}`,
        { headers: { "Content-Type": "application/json", "X-Kroma-Client": "web", Authorization: `Bearer ${token}` } },
      );
      if (!isCurrent()) throw new Error("账户已切换");
      if ((response.status === 401 || response.status === 403) && attempt === 0) {
        await response.text();
        token = (await refreshKromaSession()) ?? undefined;
        if (token) continue;
        throw new Error("登录状态已失效");
      }
      if (!response.ok) throw new Error(`生成记录读取失败（HTTP ${response.status}）`);
      const tasks: unknown = await response.json();
      if (!Array.isArray(tasks)) throw new Error("生成记录格式不正确");
      return tasks as GenerationTask[];
    }
  }
  if (shouldUseRemoteBackend()) {
    const tasks = await requestRemoteJson<GenerationTask[]>(buildTaskListRequest());
    return tasks.slice(offset, offset + limit);
  }
  return loadTasks({ owner, readOnly: true }).slice(offset, offset + limit);
}
