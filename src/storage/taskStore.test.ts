import type { GenerationTask } from "../domain/types";
import { loadTasks, saveTasks } from "./taskStore";
import { afterEach, vi } from "vitest";

const task: GenerationTask = {
  id: "task-1",
  productInput: {
    id: "product-1",
    imageUrl: "/sample/product.png",
    fileName: "product.png",
    createdAt: "2026-06-15T00:00:00.000Z",
    source: "upload",
  },
  config: {
    module: "main_image",
    platform: "amazon",
    aspectRatio: "1:1",
    style: "studio",
    outputFormat: "png",
    sellingPoints: "BPA-free, dishwasher safe",
    specifications: "500ml, stainless steel",
    outputLanguage: "中文",
  },
  status: "completed",
  resultUrls: ["/mock/main-image.png"],
  creditCost: 1,
  createdAt: "2026-06-15T01:00:00.000Z",
  completedAt: "2026-06-15T01:00:02.000Z",
  attempt: 1,
};

const taskWithHydratedConfig: GenerationTask = {
  ...task,
  config: {
    ...task.config,
    resolution: "1K",
    selectedMainModules: [],
    detailModuleCounts: {},
    whiteBackgroundMode: "pure_white",
    shadowMode: "natural",
  },
};

describe("taskStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round trips saved generation tasks", () => {
    saveTasks([task]);

    expect(loadTasks()).toEqual([taskWithHydratedConfig]);
  });

  it("returns empty tasks for invalid JSON", () => {
    localStorage.setItem("commerce-studio-tasks-v1", "{");

    expect(loadTasks()).toEqual([]);
  });

  it("returns empty tasks when data is missing", () => {
    expect(loadTasks()).toEqual([]);
  });

  it("returns empty tasks for non-array JSON", () => {
    localStorage.setItem("commerce-studio-tasks-v1", JSON.stringify({ task }));

    expect(loadTasks()).toEqual([]);
  });

  it("filters invalid stored task entries", () => {
    localStorage.setItem("commerce-studio-tasks-v1", JSON.stringify([{}]));

    expect(loadTasks()).toEqual([]);
  });

  it("keeps valid stored tasks when invalid entries are mixed in", () => {
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([{}, task, { ...task, id: 42 }]),
    );

    expect(loadTasks()).toEqual([taskWithHydratedConfig]);
  });

  it("round trips progress on stored task snapshots", () => {
    saveTasks([
      {
        ...task,
        progress: "Trying HD channel...",
        backendTaskId: "kroma-task-1",
      },
    ]);

    expect(loadTasks()[0]).toMatchObject({
      id: "task-1",
      progress: "Trying HD channel...",
      backendTaskId: "kroma-task-1",
    });
  });

  it("round trips ecommerce aspect ratios and output language", () => {
    const localizedTask: GenerationTask = {
      ...task,
      config: {
        ...task.config,
        aspectRatio: "9:16",
        outputLanguage: "西班牙语",
      },
    };

    saveTasks([localizedTask]);

    expect(loadTasks()[0]?.config).toMatchObject({
      aspectRatio: "9:16",
      outputLanguage: "西班牙语",
    });
  });

  it("preserves AI tool modes in stored task history", () => {
    const aiToolTask: GenerationTask = {
      ...task,
      config: {
        ...task.config,
        module: "white_background",
        aspectRatio: "original",
        whiteBackgroundMode: "product_showcase",
      },
    };

    saveTasks([aiToolTask]);

    expect(loadTasks()[0]?.config).toMatchObject({
      module: "white_background",
      whiteBackgroundMode: "product_showcase",
    });
  });

  it("normalizes stored transient tasks into interrupted failures and persists them", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T02:00:00.000Z"));
    const processingTask: GenerationTask = {
      ...task,
      id: "task-processing",
      status: "processing",
      resultUrls: ["/stale-result.png"],
      creditCost: 1,
      completedAt: undefined,
    };
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([processingTask]),
    );

    expect(loadTasks()).toEqual([
      {
        ...processingTask,
        config: taskWithHydratedConfig.config,
        status: "failed",
        errorCode: "task_interrupted",
        errorMessage: "任务在上次会话中断，请重新生成。",
        completedAt: "2026-06-15T02:00:00.000Z",
        creditCost: 0,
        resultUrls: [],
      },
    ]);
    expect(
      JSON.parse(localStorage.getItem("commerce-studio-tasks-v1") ?? "[]"),
    ).toEqual(loadTasks());
  });

  it("keeps resumable backend processing tasks when resume support is enabled", () => {
    const processingTask: GenerationTask = {
      ...task,
      id: "task-resumable",
      status: "processing",
      backendTaskId: "kroma-task-resume",
      progress: "Trying Wuyinkeji HD...",
      resultUrls: [],
      creditCost: 0,
      completedAt: undefined,
    };
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([processingTask]),
    );

    expect(loadTasks({ keepResumableTasks: true })).toEqual([
      {
        ...processingTask,
        config: taskWithHydratedConfig.config,
      },
    ]);
  });

  it("marks persisted upload blob tasks as source unavailable while preserving completed results", () => {
    const uploadedBlobTask: GenerationTask = {
      ...task,
      productInput: {
        ...task.productInput,
        imageUrl: "blob:persisted-upload",
        source: "upload",
      },
      status: "completed",
      resultUrls: ["/mock/completed-result.png"],
      creditCost: 1,
    };
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([uploadedBlobTask]),
    );

    expect(loadTasks()).toEqual([
      {
        ...uploadedBlobTask,
        config: taskWithHydratedConfig.config,
        errorCode: "upload_source_unavailable",
        errorMessage: "原始上传图已失效，请重新上传后再生成。",
      },
    ]);
  });

  it("keeps persisted upload data URL tasks available after reload", () => {
    const uploadedDataTask: GenerationTask = {
      ...task,
      productInput: {
        ...task.productInput,
        imageUrl: "data:image/png;base64,cHJvZHVjdA==",
        source: "upload",
      },
      status: "completed",
      resultUrls: ["/mock/completed-result.png"],
      creditCost: 1,
    };
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([uploadedDataTask]),
    );

    expect(loadTasks()).toEqual([
      {
        ...uploadedDataTask,
        config: taskWithHydratedConfig.config,
      },
    ]);
  });

  it("compacts older uploaded source images when browser storage is full", () => {
    const originalSetItem = Storage.prototype.setItem;
    let callCount = 0;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      callCount += 1;

      if (callCount === 1) {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }

      return originalSetItem.call(this, key, value);
    });
    const newestTask: GenerationTask = {
      ...task,
      id: "task-newest",
      productInput: {
        ...task.productInput,
        imageUrl: "data:image/png;base64,bmV3ZXN0",
        source: "upload",
      },
    };
    const olderTask: GenerationTask = {
      ...task,
      id: "task-older",
      productInput: {
        ...task.productInput,
        imageUrl: "data:image/png;base64,b2xkZXI=",
        source: "upload",
      },
    };

    saveTasks([newestTask, olderTask]);

    const storedTasks = JSON.parse(
      localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
    ) as GenerationTask[];
    expect(storedTasks).toHaveLength(2);
    expect(storedTasks[0]?.productInput.imageUrl).toBe(
      "data:image/png;base64,bmV3ZXN0",
    );
    expect(storedTasks[1]?.productInput.imageUrl).toBe(
      "blob:kroma-history-upload-compacted",
    );
  });

  it("marks persisted processing upload blob tasks as failed source-unavailable tasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T03:00:00.000Z"));
    const processingBlobTask: GenerationTask = {
      ...task,
      productInput: {
        ...task.productInput,
        imageUrl: "blob:persisted-processing-upload",
        source: "upload",
      },
      status: "processing",
      resultUrls: ["/stale-result.png"],
      creditCost: 1,
      completedAt: undefined,
    };
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([processingBlobTask]),
    );

    expect(loadTasks()).toEqual([
      {
        ...processingBlobTask,
        config: taskWithHydratedConfig.config,
        status: "failed",
        errorCode: "upload_source_unavailable",
        errorMessage: "原始上传图已失效，请重新上传后再生成。",
        completedAt: "2026-06-15T03:00:00.000Z",
        creditCost: 0,
        resultUrls: [],
      },
    ]);
  });

  it("marks persisted queued upload blob tasks as failed source-unavailable tasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T03:30:00.000Z"));
    const queuedBlobTask: GenerationTask = {
      ...task,
      productInput: {
        ...task.productInput,
        imageUrl: "blob:persisted-queued-upload",
        source: "upload",
      },
      status: "queued",
      resultUrls: [],
      creditCost: 0,
      completedAt: undefined,
    };
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([queuedBlobTask]),
    );

    expect(loadTasks()).toEqual([
      {
        ...queuedBlobTask,
        config: taskWithHydratedConfig.config,
        status: "failed",
        errorCode: "upload_source_unavailable",
        errorMessage: "原始上传图已失效，请重新上传后再生成。",
        completedAt: "2026-06-15T03:30:00.000Z",
        creditCost: 0,
        resultUrls: [],
      },
    ]);
  });
});
