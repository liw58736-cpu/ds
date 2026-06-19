import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationTask } from "../domain/types";
import { getAccountSnapshot } from "../storage/accountStore";
import { AppShell } from "./AppShell";
import { Workspace } from "./Workspace";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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

  it("renders detail page settings as a separate studio page", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="detail_page" />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    expect(screen.getByAltText("当前商品图")).toBeInTheDocument();
    expect(screen.getByLabelText("模块")).toHaveValue("详情页长图");
    expect(screen.getByText("服装详情内容模块")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /品牌介绍/ })).toBeEnabled();
  });

  it("updates selectable page controls", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.selectOptions(screen.getByLabelText("输出语言"), "English");
    await user.click(screen.getByRole("button", { name: "4K" }));
    await user.click(screen.getByRole("button", { name: "标准版快速出图，适合批量 SKU" }));

    expect(screen.getByLabelText("输出语言")).toHaveValue("English");
    expect(screen.getByRole("button", { name: "4K" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "标准版快速出图，适合批量 SKU" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("does not show model selection controls", () => {
    render(<Workspace activeModule="white_background" />);

    expect(screen.getByLabelText("输出语言")).toBeInTheDocument();
    expect(screen.queryByLabelText("模型")).not.toBeInTheDocument();
    expect(screen.queryByText("Commerce Image V2")).not.toBeInTheDocument();
    expect(screen.queryByText("Fast Product V1")).not.toBeInTheDocument();
  });

  it("does not render the account overview cards inside generation pages", () => {
    render(<Workspace activeModule="white_background" />);

    expect(screen.queryByLabelText("工作台概览")).not.toBeInTheDocument();
    expect(screen.queryByText("积分余额")).not.toBeInTheDocument();
    expect(screen.queryByText("本月消耗")).not.toBeInTheDocument();
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
    expect(screen.queryByAltText("原始商品图")).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /细节特写/ }));
    await user.click(screen.getByRole("button", { name: "4K" }));
    await user.click(screen.getByRole("button", { name: "生成商品主图" }));

    expect(await screen.findByAltText("生成结果")).toBeInTheDocument();
    expect(screen.queryByText("已生成")).not.toBeInTheDocument();

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks[0]).toMatchObject({
        status: "completed",
        creditCost: 1,
        config: {
          resolution: "4K",
          selectedMainModules: ["detail_closeup"],
        },
      });
    });
  });

  it("does not render inline recent tasks in the workspace settings column", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "生成商品主图" }));

    expect(await screen.findByAltText("生成结果")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "最近任务" })).not.toBeInTheDocument();

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks).toHaveLength(1);
      expect(storedTasks[0]?.status).toBe("completed");
    });
  });

  it("shows provider failures without charging credits", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.type(screen.getByLabelText("设计简报"), "fail");
    await user.click(screen.getByRole("button", { name: "生成商品主图" }));

    expect(await screen.findAllByText("模拟生成失败，请重试。")).toHaveLength(1);
    expect(screen.queryByText("生成失败")).not.toBeInTheDocument();

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks[0]).toMatchObject({
        status: "failed",
        creditCost: 0,
        errorMessage: "模拟生成失败，请重试。",
      });
    });
  });

  it("cancels an in-flight generation without applying the stale completion", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    fireEvent.click(screen.getByRole("button", { name: "生成商品主图" }));
    fireEvent.click(screen.getByRole("button", { name: "取消生成" }));

    expect(screen.getByText("已取消本次生成。")).toBeInTheDocument();

    await new Promise((resolve) => {
      window.setTimeout(resolve, 40);
    });

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks[0]).toMatchObject({
        status: "failed",
        creditCost: 0,
        errorCode: "task_canceled",
      });
    });
    expect(getAccountSnapshot().balance).toBe(4);
    expect(screen.queryByAltText("生成结果")).not.toBeInTheDocument();
  });

  it("requests backend cancellation when a processing task has a backend task id", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const storedTask = createStoredTask({
      id: "task-cancel-ui",
      status: "processing",
      backendTaskId: "kroma-task-cancel-ui",
      progress: "Trying Wuyinkeji HD...",
      resultUrls: [],
      creditCost: 0,
      completedAt: undefined,
      productInput: {
        id: "remote-product",
        imageUrl: "https://cdn.example.com/product.png",
        fileName: "product.png",
        createdAt: "2026-06-15T00:00:00.000Z",
        source: "upload",
      },
    });
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([storedTask]),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          task_id: "kroma-task-cancel-ui",
          status: "processing",
          progress: "Trying Wuyinkeji HD...",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Workspace />);

    fireEvent.click(await screen.findByRole("button", { name: "取消生成" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:8000/api/v1/image/task/kroma-task-cancel-ui/cancel",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(screen.getByText("已取消本次生成。")).toBeInTheDocument();
  });

  it("loads stored processing tasks as interrupted preview failures without locking generation", async () => {
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
      screen.getByText("任务在上次会话中断，请重新生成。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复用参数" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    expect(screen.getByRole("button", { name: "生成商品主图" })).toBeEnabled();
  });

  it("resumes a stored backend processing task after reload", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const storedTask = createStoredTask({
      id: "task-resume-ui",
      status: "processing",
      backendTaskId: "kroma-task-resume-ui",
      progress: "Trying Wuyinkeji HD...",
      resultUrls: [],
      creditCost: 0,
      completedAt: undefined,
      productInput: {
        id: "remote-product",
        imageUrl: "https://cdn.example.com/product.png",
        fileName: "product.png",
        createdAt: "2026-06-15T00:00:00.000Z",
        source: "upload",
      },
    });
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify([storedTask]),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            task_id: "kroma-task-resume-ui",
            status: "processing",
            progress: "Trying Wuyinkeji HD...",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            task_id: "kroma-task-resume-ui",
            status: "done",
            image_url: "https://cdn.example.com/resumed-result.png",
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<Workspace />);

    expect(screen.getByText("Trying Wuyinkeji HD...")).toBeInTheDocument();
    expect(
      await screen.findByAltText("生成结果", {}, { timeout: 3500 }),
    ).toHaveAttribute(
      "src",
      "https://cdn.example.com/resumed-result.png",
    );

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks[0]).toMatchObject({
        id: "task-resume-ui",
        status: "completed",
        backendTaskId: "kroma-task-resume-ui",
        resultUrls: ["https://cdn.example.com/resumed-result.png"],
      });
    });
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

    expect(screen.getByAltText("生成结果")).toHaveAttribute(
      "src",
      "/safe-result.png",
    );
    expect(screen.queryByRole("button", { name: "复用参数" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
  });

  it("shows persisted failed upload blob tasks as non-actionable preview errors", () => {
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
      screen.getByText("原始上传图已失效，请重新上传后再生成。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复用参数" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
  });

  it("shows persisted processing upload blob tasks as upload-source preview errors", () => {
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
      screen.getByText("原始上传图已失效，请重新上传后再生成。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("任务在上次会话中断，请重新生成。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复用参数" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
  });

  it("shows persisted queued upload blob tasks as upload-source preview errors", () => {
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
      screen.getByText("原始上传图已失效，请重新上传后再生成。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("任务在上次会话中断，请重新生成。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复用参数" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
  });

  it("keeps historical task errors out of urgent alert regions", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.type(screen.getByLabelText("设计简报"), "fail");
    await user.click(screen.getByRole("button", { name: "生成商品主图" }));

    expect(await screen.findAllByText("模拟生成失败，请重试。")).toHaveLength(1);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

});

describe("AppShell", () => {
  it("enables nav buttons and marks the current page active", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <AppShell page="main_image" onPageChange={onPageChange}>
        <div />
      </AppShell>,
    );

    expect(screen.getByRole("button", { name: "商品主图" })).toHaveClass(
      "nav-active",
    );
    for (const label of ["白底图", "详情页", "历史任务", "价格", "账户", "登录"]) {
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
    }
    expect(screen.queryByRole("button", { name: "模板库" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "价格" }));

    expect(onPageChange).toHaveBeenCalledWith("pricing");
  });
});
