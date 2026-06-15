import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationTask } from "../domain/types";
import { AppShell } from "./AppShell";
import { Workspace } from "./Workspace";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createStoredTask(overrides: Partial<GenerationTask> = {}): GenerationTask {
  return {
    id: "task-history-1",
    productInput: {
      id: "history-product",
      imageUrl: "/history-product.png",
      fileName: "history-product.png",
      createdAt: "2026-06-15T00:00:00.000Z",
      source: "sample",
    },
    config: {
      module: "shopify_banner",
      platform: "shopify",
      aspectRatio: "16:9",
      style: "premium",
      outputFormat: "webp",
      sellingPoints: "Reusable history copy",
      specifications: "1200 x 628",
    },
    status: "completed",
    resultUrls: ["/result.png"],
    creditCost: 1,
    createdAt: "2026-06-15T01:00:00.000Z",
    completedAt: "2026-06-15T01:00:01.000Z",
    attempt: 1,
    ...overrides,
  };
}

describe("Workspace", () => {
  it("displays the current product image after selecting the sample product", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    expect(screen.getByAltText("当前商品图")).toBeInTheDocument();
    expect(screen.getByText("sample-product.jpg")).toBeInTheDocument();
  });

  it("preserves the current product image and updates the module display when changing modules", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "详情页长图" }));

    expect(screen.getByAltText("当前商品图")).toBeInTheDocument();
    expect(screen.getByLabelText("模块")).toHaveValue("详情页长图");
  });

  it("updates platform and output controls", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.selectOptions(screen.getByLabelText("平台"), "shopify");
    await user.selectOptions(screen.getByLabelText("输出格式"), "webp");

    expect(screen.getByLabelText("平台")).toHaveValue("shopify");
    expect(screen.getByLabelText("输出格式")).toHaveValue("webp");
  });

  it("allows focus to reach the upload input inside the dropzone", () => {
    render(<Workspace />);

    const uploadInput = screen.getByLabelText("上传商品图");
    uploadInput.focus();
    const dropzone = uploadInput.closest(".upload-dropzone") as HTMLElement | null;

    expect(uploadInput).toHaveFocus();
    expect(dropzone).toContainElement(
      document.activeElement as HTMLElement | null,
    );
  });

  it("displays uploaded product image and filename from a created object URL", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:product-photo");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    render(<Workspace />);

    const file = new File(["product"], "product-photo.png", {
      type: "image/png",
    });
    await user.upload(screen.getByLabelText("上传商品图"), file);

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(screen.getByAltText("当前商品图")).toHaveAttribute(
      "src",
      "blob:product-photo",
    );
    expect(screen.getByAltText("原始商品图")).toHaveAttribute(
      "src",
      "blob:product-photo",
    );
    expect(screen.getByText("product-photo.png")).toBeInTheDocument();
  });

  it("revokes uploaded object URLs when replaced and unmounted without revoking sample URLs", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first-product")
      .mockReturnValueOnce("blob:second-product");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const { unmount } = render(<Workspace />);
    const uploadInput = screen.getByLabelText("上传商品图");

    await user.upload(
      uploadInput,
      new File(["first"], "first-product.png", { type: "image/png" }),
    );
    await user.upload(
      uploadInput,
      new File(["second"], "second-product.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenNthCalledWith(1, "blob:first-product");
    expect(revokeObjectURL).toHaveBeenNthCalledWith(2, "blob:second-product");
  });

  it("allows uploading the same file again after using the sample product", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first-same-file")
      .mockReturnValueOnce("blob:second-same-file");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    render(<Workspace />);
    const uploadInput = screen.getByLabelText("上传商品图");
    const file = new File(["same"], "same-product.png", {
      type: "image/png",
    });

    await user.upload(uploadInput, file);
    expect(uploadInput).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.upload(uploadInput, file);

    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(screen.getByText("same-product.png")).toBeInTheDocument();
    expect(screen.getByAltText("当前商品图")).toHaveAttribute(
      "src",
      "blob:second-same-file",
    );
  });

  it("generates material from the sample product and stores the completed task", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "生成素材" }));

    expect(screen.getAllByText("处理中").length).toBeGreaterThan(0);
    expect(await screen.findByAltText("生成结果")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks[0]).toMatchObject({
        status: "completed",
        creditCost: 1,
      });
    });
  });

  it("shows provider failures without charging credits", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.type(screen.getByLabelText("卖点"), "fail");
    await user.click(screen.getByRole("button", { name: "生成素材" }));

    expect(await screen.findAllByText("模拟生成失败，请重试。")).toHaveLength(2);
    expect(screen.getByText("失败")).toBeInTheDocument();

    const storedTasks = JSON.parse(
      localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
    ) as GenerationTask[];
    expect(storedTasks[0]).toMatchObject({
      status: "failed",
      creditCost: 0,
      errorMessage: "模拟生成失败，请重试。",
    });
  });

  it("retries failed tasks and keeps the failed message when the same config fails again", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.type(screen.getByLabelText("卖点"), "fail");
    await user.click(screen.getByRole("button", { name: "生成素材" }));

    expect(await screen.findByRole("button", { name: "重试" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(screen.getAllByText("处理中").length).toBeGreaterThan(0);
    expect(await screen.findAllByText("模拟生成失败，请重试。")).toHaveLength(2);
    expect(screen.getByText("失败")).toBeInTheDocument();

    const storedTasks = JSON.parse(
      localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
    ) as GenerationTask[];
    expect(storedTasks[0]).toMatchObject({
      status: "failed",
      attempt: 2,
      creditCost: 0,
    });
  });

  it("reuses product and parameters from a history task", async () => {
    const user = userEvent.setup();
    const historyTask = createStoredTask();
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([historyTask]),
    );
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "复用参数" }));

    expect(screen.getByText("history-product.png")).toBeInTheDocument();
    expect(screen.getByAltText("当前商品图")).toHaveAttribute(
      "src",
      "/history-product.png",
    );
    expect(screen.getByLabelText("模块")).toHaveValue("Shopify Banner");
    expect(screen.getByLabelText("平台")).toHaveValue("shopify");
    expect(screen.getByLabelText("尺寸")).toHaveValue("16:9");
    expect(screen.getByLabelText("风格")).toHaveValue("premium");
    expect(screen.getByLabelText("输出格式")).toHaveValue("webp");
    expect(screen.getByLabelText("卖点")).toHaveValue("Reusable history copy");
    expect(screen.getByLabelText("规格")).toHaveValue("1200 x 628");
  });

  it("loads stored processing tasks as retryable interrupted failures without locking generation", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([
        createStoredTask({
          status: "processing",
          resultUrls: ["/stale-result.png"],
          creditCost: 1,
          completedAt: undefined,
        }),
      ]),
    );
    render(<Workspace />);

    expect(
      screen.getAllByText("任务在上次会话中断，请重新生成。").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "重试" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    expect(screen.getByRole("button", { name: "生成素材" })).toBeEnabled();
  });

  it("treats persisted uploaded blob tasks as result-only after reload", () => {
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([
        createStoredTask({
          productInput: {
            id: "uploaded-product",
            imageUrl: "blob:persisted-upload",
            fileName: "uploaded-product.png",
            createdAt: "2026-06-15T00:00:00.000Z",
            source: "upload",
          },
          resultUrls: ["/safe-result.png"],
        }),
      ]),
    );
    render(<Workspace />);

    expect(
      screen.getAllByText("原始上传图已失效，请重新上传后再生成。").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "复用参数" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载结果" })).toBeEnabled();
  });

  it("disables retry for persisted failed upload blob tasks after reload", () => {
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([
        createStoredTask({
          status: "failed",
          productInput: {
            id: "uploaded-product",
            imageUrl: "blob:persisted-upload",
            fileName: "uploaded-product.png",
            createdAt: "2026-06-15T00:00:00.000Z",
            source: "upload",
          },
          resultUrls: [],
          creditCost: 0,
          errorCode: "mock_generation_failed",
          errorMessage: "模拟生成失败，请重试。",
        }),
      ]),
    );
    render(<Workspace />);

    expect(
      screen.getAllByText("原始上传图已失效，请重新上传后再生成。").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "复用参数" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重试" })).toBeDisabled();
  });

  it("disables reuse and retry for persisted processing upload blob tasks after reload", () => {
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([
        createStoredTask({
          status: "processing",
          productInput: {
            id: "uploaded-processing-product",
            imageUrl: "blob:persisted-processing-upload",
            fileName: "uploaded-processing-product.png",
            createdAt: "2026-06-15T00:00:00.000Z",
            source: "upload",
          },
          resultUrls: ["/stale-processing-result.png"],
          creditCost: 1,
          completedAt: undefined,
        }),
      ]),
    );
    render(<Workspace />);

    expect(
      screen.getAllByText("原始上传图已失效，请重新上传后再生成。").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("任务在上次会话中断，请重新生成。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复用参数" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重试" })).toBeDisabled();
  });

  it("disables reuse and retry for persisted queued upload blob tasks after reload", () => {
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([
        createStoredTask({
          status: "queued",
          productInput: {
            id: "uploaded-queued-product",
            imageUrl: "blob:persisted-queued-upload",
            fileName: "uploaded-queued-product.png",
            createdAt: "2026-06-15T00:00:00.000Z",
            source: "upload",
          },
          resultUrls: [],
          creditCost: 0,
          completedAt: undefined,
        }),
      ]),
    );
    render(<Workspace />);

    expect(
      screen.getAllByText("原始上传图已失效，请重新上传后再生成。").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("任务在上次会话中断，请重新生成。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复用参数" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重试" })).toBeDisabled();
  });

  it("disables retry while another task is processing", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([
        createStoredTask({
          id: "failed-task",
          status: "failed",
          resultUrls: [],
          creditCost: 0,
          errorCode: "mock_generation_failed",
          errorMessage: "模拟生成失败，请重试。",
        }),
      ]),
    );
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "生成素材" }));

    expect(screen.getByRole("button", { name: "重试" })).toBeDisabled();
  });

  it("keeps historical task errors out of urgent alert regions", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.type(screen.getByLabelText("卖点"), "fail");
    await user.click(screen.getByRole("button", { name: "生成素材" }));

    expect(await screen.findAllByText("模拟生成失败，请重试。")).toHaveLength(2);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("downloads completed results through a temporary anchor", async () => {
    const user = userEvent.setup();
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "生成素材" }));
    expect(await screen.findByAltText("生成结果")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下载结果" }));

    expect(anchorClick).toHaveBeenCalledTimes(1);
  });

  it("does not enable download for unsafe persisted result URLs", async () => {
    const user = userEvent.setup();
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([
        createStoredTask({
          resultUrls: ["javascript:alert(1)"],
        }),
      ]),
    );
    render(<Workspace />);

    const downloadButton = screen.getByRole("button", { name: "下载结果" });
    expect(downloadButton).toBeDisabled();
    await user.click(downloadButton);

    expect(anchorClick).not.toHaveBeenCalled();
  });

  it("copies completed task parameters to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "生成素材" }));
    expect(await screen.findByAltText("生成结果")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "复制参数" }));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('"module":"main_image"'),
    );
  });

  it("clears unrelated preview result when reusing an older task", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([
        createStoredTask({
          id: "latest-task",
          productInput: {
            id: "latest-product",
            imageUrl: "/latest-product.png",
            fileName: "latest-product.png",
            createdAt: "2026-06-15T00:00:00.000Z",
            source: "sample",
          },
          resultUrls: ["/latest-result.png"],
        }),
        createStoredTask({
          id: "older-task",
          productInput: {
            id: "older-product",
            imageUrl: "/older-product.png",
            fileName: "older-product.png",
            createdAt: "2026-06-15T00:00:00.000Z",
            source: "sample",
          },
          config: {
            module: "detail_page",
            platform: "amazon",
            aspectRatio: "long_page",
            style: "minimal",
            outputFormat: "jpg",
            sellingPoints: "Older task copy",
            specifications: "Long page",
          },
          resultUrls: ["/older-result.png"],
        }),
      ]),
    );
    render(<Workspace />);

    expect(screen.getByAltText("生成结果")).toHaveAttribute(
      "src",
      "/latest-result.png",
    );
    await user.click(screen.getAllByRole("button", { name: "复用参数" })[1]);

    expect(screen.getByText("older-product.png")).toBeInTheDocument();
    expect(screen.queryByAltText("生成结果")).not.toBeInTheDocument();
    expect(screen.getByText("等待生成结果")).toBeInTheDocument();
  });
});

describe("AppShell", () => {
  it("leaves only the current workspace nav button enabled", () => {
    render(
      <AppShell>
        <div />
      </AppShell>,
    );

    expect(screen.getByRole("button", { name: "工作台" })).toBeEnabled();
    for (const label of ["模板库", "历史任务", "价格", "账户"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
  });
});
