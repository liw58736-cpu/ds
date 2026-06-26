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

const completedMultiResultTask: GenerationTask = {
  ...processingTask,
  id: "task-completed",
  status: "completed",
  resultUrls: [
    "data:image/png;base64,result-one",
    "https://cdn.example.com/result-two.png",
  ],
  creditCost: 2,
  progress: undefined,
  completedAt: "2026-06-17T00:02:00.000Z",
  resultAssets: [
    { url: "data:image/png;base64,result-one", label: "首屏 KV" },
    { url: "https://cdn.example.com/result-two.png", label: "整体展示" },
  ],
};

const olderCompletedTask: GenerationTask = {
  ...completedMultiResultTask,
  id: "task-older",
  resultUrls: ["https://cdn.example.com/older.png"],
  resultAssets: [{ url: "https://cdn.example.com/older.png", label: "细节特写" }],
  createdAt: "2026-06-16T23:00:00.000Z",
  completedAt: "2026-06-16T23:01:00.000Z",
};

const unavailableUploadTask: GenerationTask = {
  ...failedTask,
  id: "task-upload-failed",
  errorCode: "upload_source_unavailable",
  errorMessage: "原始上传图已失效，请重新上传后再生成。",
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

  it("shows every generated image with a download link", () => {
    render(
      <ResultPreview
        product={product}
        latestTask={completedMultiResultTask}
      />,
    );

    expect(screen.getAllByAltText("生成结果")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "下载" })).toHaveLength(2);
  });

  it("shows recent tasks as labeled thumbnails and can enlarge a result", async () => {
    const user = userEvent.setup();

    render(
      <ResultPreview
        product={product}
        tasks={[completedMultiResultTask, olderCompletedTask]}
      />,
    );

    expect(screen.getByText("细节特写")).toBeInTheDocument();
    expect(screen.getByText("首屏 KV")).toBeInTheDocument();
    expect(screen.getByText("整体展示")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "下载本次任务全部图片" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "放大查看 首屏 KV" }));

    expect(screen.getByRole("dialog", { name: "首屏 KV" })).toBeInTheDocument();
  });

  it("hides retry for unavailable upload source tasks", () => {
    render(
      <ResultPreview
        product={product}
        latestTask={unavailableUploadTask}
      />,
    );

    expect(screen.queryByRole("button", { name: "重新生成" })).not.toBeInTheDocument();
  });
});
