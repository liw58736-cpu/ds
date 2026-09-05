import { afterEach, describe, expect, it, vi } from "vitest";
import { listGenerationTasks } from "./generationApi";
import { listSavedMaterials } from "./materialImportApi";
import {
  getCachedMaterialLibraryAssets,
  listMaterialLibraryAssets,
  prefetchMaterialLibraryAssets,
  rememberMaterialLibraryAssets,
} from "./materialLibraryApi";

vi.mock("./generationApi", () => ({ listGenerationTasks: vi.fn() }));
vi.mock("./materialImportApi", () => ({ listSavedMaterials: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
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
