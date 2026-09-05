import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationTask } from "../domain/types";
import { defaultConfig } from "../domain/defaults";
import { initializeSession, clearAccountSession } from "../storage/accountStore";
import { getTaskStorageKey, loadTasks } from "../storage/taskStore";
import { refreshKromaSession } from "./accountApi";
import { listSavedMaterials } from "./materialImportApi";
import {
  getCachedMaterialLibraryAssets,
  listMaterialLibraryAssets,
  prefetchMaterialLibraryAssets,
  rememberMaterialLibraryAssets,
  type MaterialLibraryProgress,
} from "./materialLibraryApi";

vi.mock("./materialImportApi", () => ({ listSavedMaterials: vi.fn() }));
vi.mock("./accountApi", () => ({ refreshKromaSession: vi.fn() }));
const listGenerationTasks = vi.fn<() => Promise<GenerationTask[]>>();
const fetchMock = vi.fn<typeof fetch>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
function login(id: string) {
  initializeSession({ identifier: `${id}@example.com`, userId: id, provider: "kroma",
    accessToken: `token-${id}`, refreshToken: `refresh-${id}`, authView: "login",
    mode: "password", storeName: "", inviteCode: "", createdAt: "2026-09-05" });
}
function task(id: string, extra: Partial<GenerationTask> = {}): GenerationTask {
  return { id, config: defaultConfig, productInput: { id: "product", imageUrl: "https://fixture.invalid/product.png",
    fileName: "product", source: "upload", createdAt: "2026-09-01" }, status: "completed",
    resultUrls: [`https://fixture.invalid/${id}.png`], creditCost: 1, createdAt: "2026-09-05",
    completedAt: "2026-09-05", attempt: 1, ...extra };
}
function saved(id: string) {
  return { id, imageUrl: `https://fixture.invalid/${id}.png`, fileName: id,
    createdAt: "2026-09-04", contentType: "image/png", size: 100 };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_WEB_API_BASE_URL", "https://fixture.invalid/api/v1");
  vi.stubEnv("VITE_API_BASE_URL", "");
  vi.stubGlobal("fetch", fetchMock);
  listGenerationTasks.mockResolvedValue([]);
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(await listGenerationTasks())));
  vi.mocked(listSavedMaterials).mockResolvedValue([]);
  login("A");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("materialLibraryApi", () => {
  it("combines saved photos with completed results from every generation tool", async () => {
    vi.mocked(listSavedMaterials).mockResolvedValue([
      {
        id: "saved-1",
        imageUrl: "https://cdn.example.com/saved.webp",
        fileName: "保存照片",
        createdAt: "2026-09-02T00:00:00.000Z",
        contentType: "image/webp",
        size: 100,
      },
    ]);
    vi.mocked(listGenerationTasks).mockResolvedValue([
      {
        id: "task-main",
        productInput: {
          id: "p1",
          imageUrl: "source",
          fileName: "source",
          createdAt: "2026-09-01T00:00:00.000Z",
          source: "upload",
        },
        config: {
          module: "main_image",
          platform: "amazon",
          aspectRatio: "1:1",
          style: "studio",
          outputFormat: "png",
          sellingPoints: "",
          specifications: "",
        },
        status: "completed",
        resultUrls: ["https://cdn.example.com/main.png"],
        resultAssets: [
          { url: "https://cdn.example.com/main.png", label: "商品主图" },
        ],
        creditCost: 1,
        createdAt: "2026-09-03T00:00:00.000Z",
        completedAt: "2026-09-03T00:01:00.000Z",
        attempt: 1,
      },
      {
        id: "task-failed",
        productInput: {
          id: "p2",
          imageUrl: "source",
          fileName: "source",
          createdAt: "2026-09-01T00:00:00.000Z",
          source: "upload",
        },
        config: {
          module: "white_background",
          platform: "amazon",
          aspectRatio: "1:1",
          style: "studio",
          outputFormat: "png",
          sellingPoints: "",
          specifications: "",
        },
        status: "failed",
        resultUrls: [],
        creditCost: 0,
        createdAt: "2026-09-03T00:00:00.000Z",
        completedAt: "2026-09-03T00:01:00.000Z",
        attempt: 1,
      },
    ]);

    await expect(listMaterialLibraryAssets()).resolves.toEqual([
      expect.objectContaining({
        imageUrl: "https://cdn.example.com/main.png",
        source: "generated",
      }),
      expect.objectContaining({
        imageUrl: "https://cdn.example.com/saved.webp",
        source: "saved",
      }),
    ]);
  });

  it("does not report an empty library as success when cloud reads fail", async () => {
    vi.mocked(listSavedMaterials).mockRejectedValue(
      new Error("Failed to fetch"),
    );
    vi.mocked(listGenerationTasks).mockResolvedValue([]);
    await expect(listMaterialLibraryAssets()).rejects.toThrow(
      "图片库暂时无法同步",
    );
  });

  it("deduplicates simultaneous reads and caches a compact first page", async () => {
    let releaseSaved!: (value: Awaited<ReturnType<typeof listSavedMaterials>>) => void;
    vi.mocked(listSavedMaterials).mockReturnValue(
      new Promise((resolve) => {
        releaseSaved = resolve;
      }),
    );
    vi.mocked(listGenerationTasks).mockResolvedValue([]);

    const first = listMaterialLibraryAssets(0, 40);
    const second = listMaterialLibraryAssets(0, 40);
    expect(listSavedMaterials).toHaveBeenCalledTimes(1);
    expect(listGenerationTasks).toHaveBeenCalledTimes(1);
    expect(listSavedMaterials).toHaveBeenCalledWith(40, 0);

    releaseSaved([
      {
        id: "cached-1",
        imageUrl: "https://cdn.example.com/cached.webp",
        fileName: "最近图片",
        createdAt: "2026-09-05T00:00:00.000Z",
        contentType: "image/webp",
        size: 100,
      },
    ]);
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(getCachedMaterialLibraryAssets()).toEqual([
      expect.objectContaining({ fileName: "最近图片" }),
    ]);

    await prefetchMaterialLibraryAssets();
    expect(listSavedMaterials).toHaveBeenCalledTimes(1);
  });

  it("remembers newly saved images without waiting for another cloud read", () => {
    rememberMaterialLibraryAssets([
      {
        id: "saved:new",
        imageUrl: "https://cdn.example.com/new.webp",
        fileName: "刚保存的图片",
        createdAt: "2026-09-05T01:00:00.000Z",
        source: "saved",
        sourceLabel: "保存图片",
      },
    ]);

    expect(getCachedMaterialLibraryAssets()).toEqual([
      expect.objectContaining({ fileName: "刚保存的图片" }),
    ]);
  });
});

describe("material library isolation and pagination", () => {

it("cancels an abandoned subscription promptly and never reuses or caches its late result", async () => {
  const pending = deferred<Awaited<ReturnType<typeof listSavedMaterials>>>();
  vi.mocked(listSavedMaterials).mockReturnValueOnce(pending.promise).mockResolvedValueOnce([saved("fresh")]);
  const controller = new AbortController();
  const progress = vi.fn();
  const old = listMaterialLibraryAssets(0, 40, { signal: controller.signal, onProgress: progress });
  const canceled = expect(old).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  expect(await listMaterialLibraryAssets(0, 40)).toEqual([expect.objectContaining({ fileName: "fresh" })]);
  await canceled;
  const count = progress.mock.calls.length;
  pending.resolve([saved("stale")]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(progress).toHaveBeenCalledTimes(count);
  expect(getCachedMaterialLibraryAssets()).toEqual([expect.objectContaining({ fileName: "fresh" })]);
});

it("keeps other subscribers alive without letting their old snapshot overwrite a reopened cache", async () => {
  const pending = deferred<Awaited<ReturnType<typeof listSavedMaterials>>>();
  vi.mocked(listSavedMaterials).mockReturnValueOnce(pending.promise).mockResolvedValueOnce([saved("fresh")]);
  const prefetch = listMaterialLibraryAssets(0, 40);
  const controller = new AbortController();
  const dialog = listMaterialLibraryAssets(0, 40, { signal: controller.signal });
  const canceled = expect(dialog).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await listMaterialLibraryAssets(0, 40);
  await canceled;
  pending.resolve([saved("prefetched")]);
  expect(await prefetch).toEqual([expect.objectContaining({ fileName: "prefetched" })]);
  expect(getCachedMaterialLibraryAssets()).toEqual([expect.objectContaining({ fileName: "fresh" })]);
});

it("does not overwrite a newly remembered upload with an older cloud snapshot", async () => {
  const pending = deferred<Awaited<ReturnType<typeof listSavedMaterials>>>();
  vi.mocked(listSavedMaterials).mockReturnValue(pending.promise);
  const result = listMaterialLibraryAssets(0, 40);
  rememberMaterialLibraryAssets([{ ...saved("uploaded"), source: "saved", sourceLabel: "保存图片" }]);
  pending.resolve([]);
  await result;
  expect(getCachedMaterialLibraryAssets()).toEqual([expect.objectContaining({ fileName: "uploaded" })]);
});

  it("reads tasks without modifying processing, queued or partial blob records", () => {
    const original = JSON.stringify([
      task("processing", { status: "processing", backendTaskId: "running", resultUrls: [] }),
      task("queued", { status: "queued", resultUrls: [] }),
      task("partial", { status: "partial", productInput: { ...task("base").productInput, imageUrl: "blob:expired" } }),
    ]);
    localStorage.setItem(getTaskStorageKey("account:A"), original);
    const write = vi.spyOn(Storage.prototype, "setItem");
    expect(getCachedMaterialLibraryAssets()).toEqual([expect.objectContaining({ imageUrl: "https://fixture.invalid/partial.png" })]);
    expect(loadTasks({ owner: "account:A", readOnly: true }).map((row) => row.status)).toEqual(["processing", "queued", "partial"]);
    expect(localStorage.getItem(getTaskStorageKey("account:A"))).toBe(original);
    expect(write).not.toHaveBeenCalled();
  });

  it("does not initialize guest storage while reading an empty cache", () => {
    localStorage.clear();
    const write = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    expect(getCachedMaterialLibraryAssets()).toEqual([]);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it("reads only the requested owner's generated results without writeback", () => {
    localStorage.setItem(getTaskStorageKey("account:A"), JSON.stringify([task("A-result")]));
    localStorage.setItem(getTaskStorageKey("account:B"), JSON.stringify([task("B-result")]));
    login("B");
    const write = vi.spyOn(Storage.prototype, "setItem");
    expect(getCachedMaterialLibraryAssets("account:A").map((row) => row.imageUrl)).toEqual(["https://fixture.invalid/A-result.png"]);
    expect(write).not.toHaveBeenCalled();
  });

  it("tolerates unavailable browser storage without writing a fallback", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    const write = vi.spyOn(Storage.prototype, "setItem");
    expect(getCachedMaterialLibraryAssets()).toEqual([]);
    expect(write).not.toHaveBeenCalled();
  });

  it("does not mutate task recovery state during background cloud sync either", async () => {
    const original = JSON.stringify([task("running", { status: "processing", resultUrls: [] })]);
    localStorage.setItem(getTaskStorageKey("account:A"), original);
    const write = vi.spyOn(Storage.prototype, "setItem");
    await listMaterialLibraryAssets(0, 40);
    expect(localStorage.getItem(getTaskStorageKey("account:A"))).toBe(original);
    expect(write.mock.calls.some(([key]) => key === getTaskStorageKey("account:A"))).toBe(false);
  });

  it("retains all local-only results when cloud history has not saved them", async () => {
    localStorage.setItem(getTaskStorageKey("account:A"), JSON.stringify(
      Array.from({ length: 55 }, (_, i) => task("unsynced-" + i)),
    ));
    const progress = vi.fn();
    expect(await listMaterialLibraryAssets(0, 40, { onProgress: progress })).toHaveLength(55);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ hasMore: false }));
    expect(getCachedMaterialLibraryAssets()).toHaveLength(40);
  });

  it("publishes the fast source to every subscriber before the slow source completes", async () => {
    const slow = deferred<Response>();
    fetchMock.mockReturnValue(slow.promise);
    vi.mocked(listSavedMaterials).mockResolvedValue([saved("fast")]);
    const first = vi.fn();
    const second = vi.fn();
    const result = listMaterialLibraryAssets(0, 40, { onProgress: first });
    await vi.waitFor(() => expect(first).toHaveBeenCalledWith(expect.objectContaining({
      pending: true, assets: [expect.objectContaining({ fileName: "fast" })],
    })));
    const shared = listMaterialLibraryAssets(0, 40, { onProgress: second });
    expect(second).toHaveBeenCalledWith(expect.objectContaining({ pending: true, assets: [expect.objectContaining({ fileName: "fast" })] }));
    slow.resolve(new Response(JSON.stringify([task("slow")])));
    expect(await result).toHaveLength(2);
    expect(await shared).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenLastCalledWith(expect.objectContaining({ pending: false, hasMore: false }));
  });

  it("keeps pagination through pages containing only failed tasks", async () => {
    fetchMock.mockImplementation(async (url) => new Response(JSON.stringify(
      String(url).includes("offset=40") ? [task("older")]
        : Array.from({ length: 40 }, (_, i) => task("failed-" + i, { status: "failed", resultUrls: [] })),
    )));
    const progress = vi.fn();
    expect(await listMaterialLibraryAssets(0, 40, { onProgress: progress })).toEqual([]);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ hasMore: true, pending: false }));
    expect(await listMaterialLibraryAssets(40, 40, { onProgress: progress })).toEqual([expect.objectContaining({ imageUrl: "https://fixture.invalid/older.png" })]);
    expect(fetchMock).toHaveBeenLastCalledWith("https://fixture.invalid/api/v1/generations?limit=40&offset=40", expect.anything());
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ hasMore: false }));
  });

  it("does not infer exhaustion from deduplicated or expanded image counts", async () => {
    vi.mocked(listSavedMaterials).mockResolvedValue(Array.from({ length: 40 }, () => saved("duplicate")));
    const progress = vi.fn();
    expect(await listMaterialLibraryAssets(0, 40, { onProgress: progress })).toHaveLength(1);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ hasMore: true }));
    vi.mocked(listSavedMaterials).mockResolvedValue([]);
    listGenerationTasks.mockResolvedValue([task("batch", { resultUrls: Array.from({ length: 50 }, (_, i) => "https://fixture.invalid/" + i + ".png") })]);
    expect(await listMaterialLibraryAssets(0, 40, { onProgress: progress })).toHaveLength(50);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ hasMore: false }));
  });

  it("preserves cached images for a failed source and reports an incomplete refresh", async () => {
    rememberMaterialLibraryAssets([{ ...saved("cached"), source: "saved", sourceLabel: "保存图片" }]);
    const before = localStorage.getItem("kroma-material-library-v1:account%3AA");
    vi.mocked(listSavedMaterials).mockRejectedValue(new Error("offline"));
    listGenerationTasks.mockResolvedValue([task("new")]);
    const progress = vi.fn();
    expect(await listMaterialLibraryAssets(0, 40, { onProgress: progress })).toHaveLength(2);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ failedSources: ["saved"], pending: false }));
    expect(localStorage.getItem("kroma-material-library-v1:account%3AA")).toBe(before);
  });

  it("does not advance a failed older page even if the other source succeeded", async () => {
    vi.mocked(listSavedMaterials).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([saved("older-saved")]);
    listGenerationTasks.mockResolvedValue([task("older-generated")]);
    const progress = vi.fn<(value: MaterialLibraryProgress) => void>();
    await expect(listMaterialLibraryAssets(40, 40, { onProgress: progress })).rejects.toThrow("图片库暂时无法同步");
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ assets: [expect.objectContaining({ source: "generated" })], failedSources: ["saved"] }));
    expect(await listMaterialLibraryAssets(40, 40)).toHaveLength(2);
    expect(listSavedMaterials).toHaveBeenNthCalledWith(2, 40, 40);
  });

  it("rejects delayed A results after switching to B without caching or publishing them", async () => {
    const slow = deferred<Awaited<ReturnType<typeof listSavedMaterials>>>();
    vi.mocked(listSavedMaterials).mockReturnValue(slow.promise);
    const progress = vi.fn();
    const result = listMaterialLibraryAssets(0, 40, { onProgress: progress });
    const rejected = expect(result).rejects.toThrow("账户已切换");
    login("B");
    slow.resolve([saved("private-A")]);
    await rejected;
    expect(progress.mock.calls.flatMap(([entry]) => entry.assets)).not.toContainEqual(expect.objectContaining({ fileName: "private-A" }));
    expect(getCachedMaterialLibraryAssets("account:A")).toEqual([]);
    expect(getCachedMaterialLibraryAssets("account:B")).toEqual([]);
  });

  it("does not reuse a stale flight after A to B to A switches", async () => {
    const slow = deferred<Awaited<ReturnType<typeof listSavedMaterials>>>();
    vi.mocked(listSavedMaterials).mockReturnValueOnce(slow.promise).mockResolvedValueOnce([saved("fresh-A")]);
    const stale = listMaterialLibraryAssets(0, 40);
    const rejected = expect(stale).rejects.toThrow("账户已切换");
    login("B"); login("A");
    expect(await listMaterialLibraryAssets(0, 40)).toEqual([expect.objectContaining({ fileName: "fresh-A" })]);
    slow.resolve([saved("stale-A")]);
    await rejected;
    expect(getCachedMaterialLibraryAssets()).toEqual([expect.objectContaining({ fileName: "fresh-A" })]);
  });

  it("keeps signed-out pagination finite instead of rereading the first local page", async () => {
    clearAccountSession();
    localStorage.setItem(getTaskStorageKey("guest"), JSON.stringify(Array.from({ length: 41 }, (_, i) => task("local-" + i))));
    const progress = vi.fn();
    await listMaterialLibraryAssets(0, 40, { onProgress: progress });
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ hasMore: true }));
    expect(await listMaterialLibraryAssets(40, 40, { onProgress: progress })).toEqual([expect.objectContaining({ imageUrl: "https://fixture.invalid/local-40.png" })]);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ hasMore: false }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes expired cloud authorization while preserving the original owner", async () => {
    fetchMock.mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([task("authorized")])));
    vi.mocked(refreshKromaSession).mockResolvedValue("new-token");
    expect(await listMaterialLibraryAssets(0, 40)).toHaveLength(1);
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer new-token" }) }));
  });
});
