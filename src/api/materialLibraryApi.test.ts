import { afterEach, describe, expect, it, vi } from "vitest";
import { listGenerationTasks } from "./generationApi";
import { listSavedMaterials } from "./materialImportApi";
import { listMaterialLibraryAssets } from "./materialLibraryApi";

vi.mock("./generationApi", () => ({ listGenerationTasks: vi.fn() }));
vi.mock("./materialImportApi", () => ({ listSavedMaterials: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe("materialLibraryApi", () => {
  it("combines saved photos with completed results from every generation tool", async () => {
    vi.mocked(listSavedMaterials).mockResolvedValue([{
      id: "saved-1",
      imageUrl: "https://cdn.example.com/saved.webp",
      fileName: "保存照片",
      createdAt: "2026-09-02T00:00:00.000Z",
      contentType: "image/webp",
      size: 100,
    }]);
    vi.mocked(listGenerationTasks).mockResolvedValue([
      {
        id: "task-main",
        productInput: { id: "p1", imageUrl: "source", fileName: "source", createdAt: "2026-09-01T00:00:00.000Z", source: "upload" },
        config: { module: "main_image", platform: "amazon", aspectRatio: "1:1", style: "studio", outputFormat: "png", sellingPoints: "", specifications: "" },
        status: "completed",
        resultUrls: ["https://cdn.example.com/main.png"],
        resultAssets: [{ url: "https://cdn.example.com/main.png", label: "商品主图" }],
        creditCost: 1,
        createdAt: "2026-09-03T00:00:00.000Z",
        completedAt: "2026-09-03T00:01:00.000Z",
        attempt: 1,
      },
      {
        id: "task-failed",
        productInput: { id: "p2", imageUrl: "source", fileName: "source", createdAt: "2026-09-01T00:00:00.000Z", source: "upload" },
        config: { module: "white_background", platform: "amazon", aspectRatio: "1:1", style: "studio", outputFormat: "png", sellingPoints: "", specifications: "" },
        status: "failed",
        resultUrls: [],
        creditCost: 0,
        createdAt: "2026-09-03T00:00:00.000Z",
        completedAt: "2026-09-03T00:01:00.000Z",
        attempt: 1,
      },
    ]);

    await expect(listMaterialLibraryAssets()).resolves.toEqual([
      expect.objectContaining({ imageUrl: "https://cdn.example.com/main.png", source: "generated" }),
      expect.objectContaining({ imageUrl: "https://cdn.example.com/saved.webp", source: "saved" }),
    ]);
  });

  it("keeps available history when saved-material sync fails", async () => {
    vi.mocked(listSavedMaterials).mockRejectedValue(new Error("Failed to fetch"));
    vi.mocked(listGenerationTasks).mockResolvedValue([]);
    await expect(listMaterialLibraryAssets()).resolves.toEqual([]);
  });
});
