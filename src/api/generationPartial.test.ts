import { afterEach, expect, it, vi } from "vitest";
import { generateAsset, resumeGenerationTask } from "./generationApi";
import { submitKromaGenerationTask } from "./kromaGenerationAdapter";
import { defaultConfig } from "../domain/defaults";
vi.mock("./kromaGenerationAdapter", () => ({
  shouldUseKromaGenerationBackend: () => true,
  submitKromaGenerationTask: vi.fn(),
  cancelKromaGenerationTask: vi.fn(),
  resumeKromaGenerationTask: vi.fn(),
}));
vi.mock("../storage/accountStore", async (importOriginal) => ({
  ...await importOriginal<typeof import("../storage/accountStore")>(),
  getAccountAccessToken: () => "fixture-access-token",
}));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("restores a server-managed batch without requiring every child request id in this browser", async () => {
  vi.stubEnv("VITE_WEB_API_BASE_URL", "https://fixture.invalid/api/v1");
  const task = {
    id: "group", billingManaged: true, status: "processing" as const,
    productInput: { id: "p", imageUrl: "https://fixture.invalid/p.png", fileName: "p.png", source: "upload" as const, createdAt: "2026-09-04" },
    config: { ...defaultConfig, selectedMainModules: ["hero_kv", "overall_show"] as ("hero_kv" | "overall_show")[] },
    resultUrls: [], creditCost: 0, createdAt: "2026-09-04", attempt: 1,
    backendTaskIds: ["child-0"],
  };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
    ...task, status: "partial", creditCost: 1,
    resultUrls: ["https://fixture.invalid/result.png"],
    failedItems: [{ index: 1, label: "整体展示", config: { ...defaultConfig, selectedMainModules: ["overall_show"] }, error: "未送达" }],
  }])));
  vi.stubGlobal("fetch", fetch);
  const result = await resumeGenerationTask(task);
  expect(result.billingManaged).toBe(true);
  expect(result.creditCost).toBe(1);
  expect(result.failedItems?.[0].index).toBe(1);
  expect(String(fetch.mock.calls[0][0])).toContain("group_id=group");
});
it("keeps successful child images and charges only server-confirmed successful work", async () => {
  vi.mocked(submitKromaGenerationTask)
    .mockResolvedValueOnce({
      taskId: "one",
      status: "completed",
      resultUrls: ["https://example.invalid/one.png"],
      creditCost: 1,
      billingManaged: true,
      routeMode: "standard",
    })
    .mockRejectedValueOnce(new Error("provider failed"));
  const result = await generateAsset({
    product: {
      id: "p",
      imageUrl: "https://example.invalid/source.png",
      fileName: "source.png",
      source: "upload",
      createdAt: "2026-09-04",
    },
    config: {
      ...defaultConfig,
      selectedMainModules: ["hero_kv", "overall_show"],
    },
    groupId: "parent",
  });
  expect(result.resultUrls).toEqual(["https://example.invalid/one.png"]);
  expect(result.creditCost).toBe(1);
  expect(result.billingManaged).toBe(true);
  expect(result.failedItems?.[0]).toMatchObject({
    index: 1,
    config: { selectedMainModules: ["overall_show"] },
    error: "provider failed",
  });
  expect(
    vi.mocked(submitKromaGenerationTask).mock.calls[1][0].body.context
      ?.requestId,
  ).toBe("parent:1:1");
});
