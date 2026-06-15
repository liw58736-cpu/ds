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
  },
  status: "completed",
  resultUrls: ["/mock/main-image.png"],
  creditCost: 1,
  createdAt: "2026-06-15T01:00:00.000Z",
  completedAt: "2026-06-15T01:00:02.000Z",
  attempt: 1,
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

    expect(loadTasks()).toEqual([task]);
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

    expect(loadTasks()).toEqual([task]);
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
        errorCode: "upload_source_unavailable",
        errorMessage: "原始上传图已失效，请重新上传后再生成。",
      },
    ]);
  });
});
