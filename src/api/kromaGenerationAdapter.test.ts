import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGenerationTaskRequest } from "./apiContracts";
import {
  buildKromaGenerateRequest,
  cancelKromaGenerationTask,
  resumeKromaGenerationTask,
  submitKromaGenerationTask,
} from "./kromaGenerationAdapter";
import type { GenerateInput } from "../providers/generationProvider";
import { initializeSession } from "../storage/accountStore";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  localStorage.clear();
});

const baseInput: GenerateInput = {
  product: {
    id: "product-1",
    imageUrl: "https://cdn.example.com/product.png",
    fileName: "product.png",
    createdAt: "2026-06-17T00:00:00.000Z",
    source: "upload",
  },
  config: {
    module: "main_image",
    platform: "shopify",
    aspectRatio: "1:1",
    style: "premium",
    outputFormat: "png",
    sellingPoints: "Premium ceramic bottle, gift campaign",
    specifications: "Launch discount 20%",
    resolution: "1K",
    selectedMainModules: ["hero_kv", "detail_closeup"],
  },
};

describe("kromaGenerationAdapter", () => {
  it("maps standard commerce tasks to the reference backend generation shape", () => {
    const request = buildGenerationTaskRequest(baseInput);

    expect(buildKromaGenerateRequest(request)).toMatchObject({
      prompt: request.body.prompt.finalPrompt,
      task_type: "ecommerce",
      image_url: "https://cdn.example.com/product.png",
      size: "1024x1024",
      quality: "standard",
      use_template_mode: false,
      keep_user_outfit_pose: false,
      style: "main_image:standard",
    });
  });

  it("maps browser-held data images to image_base64 for the reference backend", () => {
    const request = buildGenerationTaskRequest({
      ...baseInput,
      product: {
        ...baseInput.product,
        imageUrl: "data:image/png;base64,abc123",
      },
    });

    expect(buildKromaGenerateRequest(request)).toMatchObject({
      image_base64: "data:image/png;base64,abc123",
    });
    expect(buildKromaGenerateRequest(request)).not.toHaveProperty("image_url");
  });

  it("maps white-background 1K work to the edit-tool backend path", () => {
    const request = buildGenerationTaskRequest({
      ...baseInput,
      config: {
        ...baseInput.config,
        module: "white_background",
        whiteBackgroundMode: "pure_white",
        shadowMode: "contact_shadow",
      },
    });

    expect(buildKromaGenerateRequest(request)).toMatchObject({
      task_type: "image_edit",
      image_url: "https://cdn.example.com/product.png",
      size: "1024x1024",
      quality: "standard",
      use_template_mode: false,
      style: "white_background:edit_tool",
    });
  });

  it("maps HD requests to the 2K/4K quality values used by the reference router", () => {
    const request = buildGenerationTaskRequest({
      ...baseInput,
      config: {
        ...baseInput.config,
        aspectRatio: "16:9",
        resolution: "4K",
      },
    });

    expect(buildKromaGenerateRequest(request)).toMatchObject({
      size: "3840x2160",
      quality: "4k",
    });
  });

  it("posts to the reference async endpoint, polls the task, and maps success to the frontend task response", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1/");
    initializeSession({
      identifier: "seller@example.com",
      authView: "login",
      mode: "password",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-06-17T00:00:00.000Z",
      accessToken: "access-token-1",
    });
    const onProgress = vi.fn();
    const onTaskStarted = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            task_id: "kroma-task-1",
            status: "processing",
            progress: "Preparing...",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            task_id: "kroma-task-1",
            status: "processing",
            progress: "Trying first channel...",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            task_id: "kroma-task-1",
            status: "done",
            image_url: "https://cdn.example.com/result.png",
            channel_used: "wuyinkeji",
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const request = buildGenerationTaskRequest(baseInput);
    const response = await submitKromaGenerationTask(request, {
      pollIntervalMs: 0,
      onProgress,
      onTaskStarted,
    });

    expect(response).toMatchObject({
      taskId: "kroma-task-1",
      status: "completed",
      resultUrls: ["https://cdn.example.com/result.png"],
      creditCost: 2,
      routeMode: "standard",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8000/api/v1/image/generate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-1",
          "X-Kroma-Client": "web",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8000/api/v1/image/task/kroma-task-1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(onProgress).toHaveBeenCalledWith("Preparing...");
    expect(onProgress).toHaveBeenCalledWith("Trying first channel...");
    expect(onTaskStarted).toHaveBeenCalledWith("kroma-task-1");
  });

  it("resumes polling an existing reference backend task by task id", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const onProgress = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            task_id: "kroma-task-resume",
            status: "processing",
            progress: "Trying Wuyinkeji HD...",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            task_id: "kroma-task-resume",
            status: "done",
            image_url: "https://cdn.example.com/resumed.png",
          }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const request = buildGenerationTaskRequest(baseInput);

    const response = await resumeKromaGenerationTask(
      request,
      "kroma-task-resume",
      { pollIntervalMs: 0, onProgress },
    );

    expect(response).toMatchObject({
      taskId: "kroma-task-resume",
      status: "completed",
      resultUrls: ["https://cdn.example.com/resumed.png"],
      creditCost: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8000/api/v1/image/task/kroma-task-resume",
      expect.objectContaining({ method: "GET" }),
    );
    expect(onProgress).toHaveBeenCalledWith("Trying Wuyinkeji HD...");
  });

  it("cancels an existing reference backend task by task id", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1/");
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          task_id: "kroma-task-cancel",
          status: "error",
          progress: "已取消",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      cancelKromaGenerationTask("kroma-task-cancel"),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/image/task/kroma-task-cancel/cancel",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("treats missing reference cancel support as a local-only cancellation fallback", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      }),
    );

    await expect(
      cancelKromaGenerationTask("kroma-task-no-cancel"),
    ).resolves.toBe(false);
  });

  it("resolves relative frontend image assets to image_base64 before posting", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const imageBytes = new Uint8Array([137, 80, 78, 71]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "Content-Type": "image/png" }),
        arrayBuffer: () => Promise.resolve(imageBytes.buffer),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            task_id: "kroma-task-2",
            status: "done",
            image_url: "https://cdn.example.com/result.png",
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await submitKromaGenerationTask(
      buildGenerationTaskRequest({
        ...baseInput,
        product: {
          ...baseInput.product,
          imageUrl: "/assets/product.png",
        },
      }),
      { pollIntervalMs: 0 },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/assets/product.png");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8000/api/v1/image/generate",
      expect.objectContaining({
        body: expect.stringContaining("data:image/png;base64"),
      }),
    );
  });

  it("maps failed reference responses without charging credits", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              task_id: "kroma-task-3",
              status: "processing",
              progress: "Preparing...",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              task_id: "kroma-task-3",
              status: "error",
              error: "All providers failed. Please try again later.",
            }),
        }),
    );

    await expect(
      submitKromaGenerationTask(buildGenerationTaskRequest(baseInput), {
        pollIntervalMs: 0,
      }),
    ).resolves.toMatchObject({
      taskId: "kroma-task-3",
      status: "failed",
      resultUrls: [],
      creditCost: 0,
      errorCode: "kroma_generation_failed",
      errorMessage: "All providers failed. Please try again later.",
    });
  });
});
