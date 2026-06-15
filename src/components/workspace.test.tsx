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
    const historyTask: GenerationTask = {
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
    };
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
