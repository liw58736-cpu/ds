import {
  completeTask,
  createTask,
  failTask,
  markProcessing,
  retryTask,
} from "./taskState";
import type { GenerationConfig, ProductInput } from "./types";

const product: ProductInput = {
  id: "product-1",
  imageUrl: "/sample/product.png",
  fileName: "product.png",
  createdAt: "2026-06-15T00:00:00.000Z",
  source: "upload",
};

const config: GenerationConfig = {
  module: "main_image",
  platform: "amazon",
  aspectRatio: "1:1",
  style: "studio",
  outputFormat: "png",
  sellingPoints: ["BPA-free", "Dishwasher safe"],
  specifications: ["500ml", "Stainless steel"],
};

describe("task lifecycle", () => {
  it("creates a queued task with success-only credit cost 0 and product reference", () => {
    const task = createTask({
      product,
      config,
      now: "2026-06-15T01:00:00.000Z",
    });

    expect(task.id).toMatch(/^task-/);
    expect(task.status).toBe("queued");
    expect(task.creditCost).toBe(0);
    expect(task.resultUrls).toEqual([]);
    expect(task.productInput).toBe(product);
    expect(task.config).toBe(config);
    expect(task.createdAt).toBe("2026-06-15T01:00:00.000Z");
    expect(task.attempt).toBe(1);
  });

  it("moves a queued task into processing without changing billing", () => {
    const task = createTask({
      product,
      config,
      now: "2026-06-15T01:00:00.000Z",
    });

    const processing = markProcessing(task);

    expect(processing.status).toBe("processing");
    expect(processing.creditCost).toBe(0);
    expect(processing.resultUrls).toEqual([]);
    expect(processing.productInput).toBe(product);
  });

  it("completes a task and records result URL and credit cost", () => {
    const task = failTask(
      createTask({
        product,
        config,
        now: "2026-06-15T01:00:00.000Z",
      }),
      {
        errorCode: "provider_timeout",
        errorMessage: "Provider timed out",
        completedAt: "2026-06-15T01:00:01.000Z",
      },
    );

    const completed = completeTask(task, {
      resultUrls: ["/mock/main-image.png"],
      completedAt: "2026-06-15T01:00:02.000Z",
      creditCost: 1,
    });

    expect(completed.status).toBe("completed");
    expect(completed.resultUrls).toEqual(["/mock/main-image.png"]);
    expect(completed.creditCost).toBe(1);
    expect(completed.completedAt).toBe("2026-06-15T01:00:02.000Z");
    expect(completed.errorCode).toBeUndefined();
    expect(completed.errorMessage).toBeUndefined();
  });

  it("keeps failed tasks uncharged and retryable", () => {
    const completed = completeTask(
      createTask({
        product,
        config,
        now: "2026-06-15T01:00:00.000Z",
      }),
      {
        resultUrls: ["/mock/main-image.png"],
        completedAt: "2026-06-15T01:00:02.000Z",
        creditCost: 1,
      },
    );

    const failed = failTask(completed, {
      errorCode: "provider_timeout",
      errorMessage: "Provider timed out",
      completedAt: "2026-06-15T01:00:03.000Z",
    });
    const retried = retryTask(failed, "2026-06-15T01:00:04.000Z");

    expect(failed.status).toBe("failed");
    expect(failed.resultUrls).toEqual([]);
    expect(failed.creditCost).toBe(0);
    expect(failed.errorCode).toBe("provider_timeout");
    expect(failed.errorMessage).toBe("Provider timed out");

    expect(retried.status).toBe("queued");
    expect(retried.errorCode).toBeUndefined();
    expect(retried.errorMessage).toBeUndefined();
    expect(retried.resultUrls).toEqual([]);
    expect(retried.creditCost).toBe(0);
    expect(retried.completedAt).toBeUndefined();
    expect(retried.createdAt).toBe("2026-06-15T01:00:04.000Z");
    expect(retried.attempt).toBe(2);
  });
});
