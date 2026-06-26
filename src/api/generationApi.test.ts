import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGenerationTask,
  generateAsset,
  getGenerationTaskSnapshot,
  listGenerationTasks,
  resumeGenerationTask,
  saveGenerationTasks,
} from "./generationApi";
import type { GenerateInput } from "../providers/generationProvider";
import type { GenerationTask } from "../domain/types";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const input: GenerateInput = {
  product: {
    id: "product-1",
    imageUrl: "/sample/product.png",
    fileName: "product.png",
    createdAt: "2026-06-15T00:00:00.000Z",
    source: "sample",
  },
  config: {
    module: "main_image",
    platform: "shopify",
    aspectRatio: "1:1",
    style: "premium",
    outputFormat: "png",
    sellingPoints: "Premium launch key visual",
    specifications: "Limited campaign",
    resolution: "2K",
    selectedMainModules: ["hero_kv"],
  },
};

describe("generationApi", () => {
  it("creates a backend-style generation task response through the mock adapter", async () => {
    const response = await createGenerationTask(input);

    expect(response).toMatchObject({
      status: "completed",
      creditCost: 2,
      routeMode: "hd",
    });
    expect(response.taskId).toMatch(/^mock-generation-/);
    expect(response.resultUrls[0]).toContain("data:image/svg+xml;charset=utf-8,");
  });

  it("submits generation tasks to the remote backend when VITE_API_BASE_URL is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          taskId: "remote-task-1",
          status: "completed",
          resultUrls: ["https://cdn.example.com/result.png"],
          creditCost: 1,
          routeMode: "hd",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await createGenerationTask(input);

    expect(response.taskId).toBe("remote-task-1");
    expect(response.resultUrls).toEqual(["https://cdn.example.com/result.png"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.com/api/generation/tasks",
    );
  });

  it("submits generation tasks to the Kroma-compatible image backend when configured", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "Content-Type": "image/png" }),
        arrayBuffer: () => Promise.resolve(new Uint8Array([137, 80]).buffer),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            task_id: "kroma-task-1",
            status: "processing",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            task_id: "kroma-task-1",
            status: "done",
            image_url: "https://cdn.example.com/kroma-result.png",
            channel_used: "rightcode",
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const response = await createGenerationTask(input);

    expect(response).toMatchObject({
      taskId: "kroma-task-1",
      status: "completed",
      resultUrls: ["https://cdn.example.com/kroma-result.png"],
      creditCost: 2,
    });
    expect(fetchMock).toHaveBeenCalledWith("/sample/product.png");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/image/generate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/image/task/kroma-task-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("does not use mock generation in production without a real backend", async () => {
    vi.stubEnv("PROD", true);

    await expect(createGenerationTask(input)).resolves.toMatchObject({
      status: "failed",
      creditCost: 0,
      errorCode: "generation_backend_unconfigured",
      errorMessage: "真实生图后端未配置，请联系支持。",
    });

    await expect(generateAsset(input)).rejects.toMatchObject({
      code: "generation_backend_unconfigured",
      message: "真实生图后端未配置，请联系支持。",
    });
  });

  it("lists generation tasks from the remote backend when VITE_API_BASE_URL is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const remoteTasks: GenerationTask[] = [
      {
        id: "remote-task-1",
        productInput: input.product,
        config: input.config,
        status: "completed",
        resultUrls: ["https://cdn.example.com/result.png"],
        creditCost: 1,
        createdAt: "2026-06-17T00:00:00.000Z",
        completedAt: "2026-06-17T00:00:01.000Z",
        attempt: 1,
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(remoteTasks),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listGenerationTasks()).resolves.toEqual(remoteTasks);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/generation/tasks?accountId=guest",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("generates an asset through the backend-ready API boundary", async () => {
    const result = await generateAsset(input);

    expect(result.creditCost).toBe(2);
    expect(result.resultUrls[0]).toContain("data:image/svg+xml;charset=utf-8,");
  });

  it("generates one result per selected main image module without duplicating brand edition credits", async () => {
    const result = await generateAsset({
      ...input,
      config: {
        ...input.config,
        resolution: "1K",
        generationVersion: "brand",
        selectedMainModules: ["hero_kv", "overall_show"],
      },
    });

    expect(result.resultUrls).toHaveLength(2);
    expect(decodeURIComponent(result.resultUrls[0])).toContain("首屏 KV");
    expect(decodeURIComponent(result.resultUrls[1])).toContain("整体展示");
    expect(result.resultAssets).toEqual([
      { url: result.resultUrls[0], label: "首屏 KV" },
      { url: result.resultUrls[1], label: "整体展示" },
    ]);
    expect(result.creditCost).toBe(4);
  });

  it("generates one result per selected detail page module count", async () => {
    const result = await generateAsset({
      ...input,
      config: {
        ...input.config,
        module: "detail_page",
        aspectRatio: "long_page",
        resolution: "1K",
        generationVersion: "standard",
        detailModuleCounts: {
          blogger_outfit: 2,
          main_display: 1,
          brand_intro: 2,
        },
      },
    });

    expect(result.resultUrls).toHaveLength(5);
    expect(result.resultAssets).toEqual([
      { url: result.resultUrls[0], label: "博主穿搭" },
      { url: result.resultUrls[1], label: "博主穿搭" },
      { url: result.resultUrls[2], label: "主图展示" },
      { url: result.resultUrls[3], label: "品牌介绍" },
      { url: result.resultUrls[4], label: "品牌介绍" },
    ]);
    expect(result.creditCost).toBe(5);
  });

  it("submits one Kroma backend task per selected detail page image", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    let submittedCount = 0;
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const requestUrl = String(url);

      if (requestUrl === "/sample/product.png") {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "Content-Type": "image/png" }),
          arrayBuffer: () => Promise.resolve(new Uint8Array([137, 80]).buffer),
        } as Response);
      }

      if (requestUrl.endsWith("/image/generate")) {
        submittedCount += 1;
        const taskIndex = submittedCount;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              task_id: `kroma-detail-${taskIndex}`,
              status: "done",
              image_url: `https://cdn.example.com/detail-${taskIndex}.png`,
              channel_used: "rightcode",
            }),
        } as Response);
      }

      return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateAsset({
      ...input,
      config: {
        ...input.config,
        module: "detail_page",
        aspectRatio: "long_page",
        resolution: "1K",
        generationVersion: "standard",
        detailModuleCounts: {
          blogger_outfit: 2,
          main_display: 1,
          brand_intro: 2,
        },
      },
    });

    expect(result.resultUrls).toEqual([
      "https://cdn.example.com/detail-1.png",
      "https://cdn.example.com/detail-2.png",
      "https://cdn.example.com/detail-3.png",
      "https://cdn.example.com/detail-4.png",
      "https://cdn.example.com/detail-5.png",
    ]);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/image/generate")),
    ).toHaveLength(5);
  });

  it("resumes every backend task for a multi-image detail page task", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const task: GenerationTask = {
      id: "detail-task-resume",
      productInput: input.product,
      config: {
        ...input.config,
        module: "detail_page",
        aspectRatio: "long_page",
        resolution: "1K",
        generationVersion: "standard",
        detailModuleCounts: {
          blogger_outfit: 2,
          main_display: 1,
          brand_intro: 2,
        },
      },
      status: "processing",
      backendTaskId: "kroma-detail-5",
      backendTaskIds: [
        "kroma-detail-1",
        "kroma-detail-2",
        "kroma-detail-3",
        "kroma-detail-4",
        "kroma-detail-5",
      ],
      resultUrls: [],
      creditCost: 0,
      createdAt: "2026-06-17T00:00:00.000Z",
      attempt: 1,
    };
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const requestUrl = String(url);
      const taskId = requestUrl.split("/").pop() ?? "";

      if (requestUrl.includes("/image/task/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              task_id: taskId,
              status: "done",
              image_url: `https://cdn.example.com/${taskId}.png`,
              channel_used: "rightcode",
            }),
        } as Response);
      }

      return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resumeGenerationTask(task);

    expect(result.resultUrls).toEqual([
      "https://cdn.example.com/kroma-detail-1.png",
      "https://cdn.example.com/kroma-detail-2.png",
      "https://cdn.example.com/kroma-detail-3.png",
      "https://cdn.example.com/kroma-detail-4.png",
      "https://cdn.example.com/kroma-detail-5.png",
    ]);
    expect(result.resultAssets).toEqual([
      { url: result.resultUrls[0], label: "博主穿搭" },
      { url: result.resultUrls[1], label: "博主穿搭" },
      { url: result.resultUrls[2], label: "主图展示" },
      { url: result.resultUrls[3], label: "品牌介绍" },
      { url: result.resultUrls[4], label: "品牌介绍" },
    ]);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("/image/task/")),
    ).toHaveLength(5);
  });

  it("forwards generation failures without consuming credits in this layer", async () => {
    await expect(
      createGenerationTask({
        ...input,
        config: {
          ...input.config,
          sellingPoints: "fail",
        },
      }),
    ).resolves.toMatchObject({
      status: "failed",
      errorCode: "mock_generation_failed",
    });

    await expect(
      generateAsset({
        ...input,
        config: {
          ...input.config,
          sellingPoints: "fail",
        },
      }),
    ).rejects.toMatchObject({
      code: "mock_generation_failed",
    });
  });

  it("persists and lists generation tasks through the API boundary", async () => {
    const task: GenerationTask = {
      id: "task-1",
      productInput: input.product,
      config: input.config,
      status: "completed",
      resultUrls: ["data:image/png;base64,result"],
      creditCost: 1,
      createdAt: "2026-06-17T00:00:00.000Z",
      completedAt: "2026-06-17T00:00:01.000Z",
      attempt: 1,
    };

    await saveGenerationTasks([task]);

    const tasks = await listGenerationTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: "task-1",
      status: "completed",
      creditCost: 1,
      config: {
        selectedMainModules: ["hero_kv"],
        whiteBackgroundMode: "pure_white",
        shadowMode: "natural",
      },
    });
    expect(getGenerationTaskSnapshot()[0]).toMatchObject({
      id: "task-1",
      status: "completed",
    });
  });
});
