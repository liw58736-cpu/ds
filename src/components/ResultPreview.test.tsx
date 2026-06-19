import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GenerationTask, ProductInput } from "../domain/types";
import { ResultPreview } from "./ResultPreview";

const product: ProductInput = {
  id: "product-1",
  imageUrl: "data:image/png;base64,product",
  fileName: "product.png",
  createdAt: "2026-06-17T00:00:00.000Z",
  source: "sample",
};

const processingTask: GenerationTask = {
  id: "task-1",
  productInput: product,
  config: {
    module: "main_image",
    platform: "shopify",
    aspectRatio: "1:1",
    style: "premium",
    outputFormat: "png",
    sellingPoints: "Premium launch",
    specifications: "Launch campaign",
    resolution: "1K",
  },
  status: "processing",
  resultUrls: [],
  creditCost: 0,
  createdAt: "2026-06-17T00:00:00.000Z",
  attempt: 1,
  progress: "Trying HD channel...",
};

const failedTask: GenerationTask = {
  ...processingTask,
  id: "task-failed",
  status: "failed",
  progress: undefined,
  errorCode: "provider_timeout",
  errorMessage: "Provider timed out",
  completedAt: "2026-06-17T00:01:00.000Z",
};

describe("ResultPreview", () => {
  it("shows backend progress while a generation task is running", () => {
    render(<ResultPreview product={product} latestTask={processingTask} />);

    expect(screen.getByText("Trying HD channel...")).toBeInTheDocument();
  });

  it("shows a running progress timeline and lets users cancel the preview task", async () => {
    const user = userEvent.setup();
    const onCancelTask = vi.fn();

    render(
      <ResultPreview
        product={product}
        latestTask={processingTask}
        onCancelTask={onCancelTask}
      />,
    );

    expect(screen.queryByText("进度跟踪")).not.toBeInTheDocument();
    expect(screen.getByText("Trying HD channel...")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "取消生成" }));

    expect(onCancelTask).toHaveBeenCalledWith(processingTask);
  });

  it("lets users retry a failed preview task without opening history", async () => {
    const user = userEvent.setup();
    const onRetryTask = vi.fn();

    render(
      <ResultPreview
        product={product}
        latestTask={failedTask}
        onRetryTask={onRetryTask}
      />,
    );

    await user.click(screen.getByRole("button", { name: "重新生成" }));

    expect(onRetryTask).toHaveBeenCalledWith(failedTask);
  });
});
