import type { GenerationTask } from "../domain/types";
import { loadTasks, saveTasks } from "./taskStore";

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
});
