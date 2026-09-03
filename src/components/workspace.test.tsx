import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationTask } from "../domain/types";
import { listMaterialLibraryAssets } from "../api/materialLibraryApi";
import { getAccountSnapshot, replaceAccountSnapshot } from "../storage/accountStore";
import { AppShell } from "./AppShell";
import { Workspace } from "./Workspace";

vi.mock("../api/materialLibraryApi", () => ({
  listMaterialLibraryAssets: vi.fn(),
}));

const libraryAssets = [
  {
    id: "library-product-1",
    imageUrl: "https://cdn.example.com/library-product-1.png",
    fileName: "library-product-1.png",
    createdAt: "2026-09-03T00:00:00.000Z",
    source: "saved" as const,
    sourceLabel: "保存图片",
  },
  {
    id: "library-product-2",
    imageUrl: "https://cdn.example.com/library-product-2.png",
    fileName: "library-product-2.png",
    createdAt: "2026-09-03T00:01:00.000Z",
    source: "saved" as const,
    sourceLabel: "保存图片",
  },
];

beforeEach(() => {
  localStorage.clear();
  vi.mocked(listMaterialLibraryAssets).mockResolvedValue(libraryAssets);
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

async function chooseLibraryAsset(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string,
  assetName = "library-product-1.png",
) {
  await user.click(screen.getByRole("button", { name: triggerName }));
  const dialog = await screen.findByRole("dialog", { name: /从图片库/ });
  await user.click(within(dialog).getByRole("button", { name: new RegExp(assetName) }));
}

describe("Workspace", () => {
  it("displays the current product image after selecting the sample product", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    expect(screen.getByAltText("当前商品图")).toBeInTheDocument();
    expect(screen.getByText("sample-product.jpg")).toBeInTheDocument();
  });

  it("asks for a product image before selecting main image modules", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    const heroCard = screen.getByRole("button", { name: /首屏 KV/ });

    await user.click(heroCard);

    expect(screen.getByRole("alertdialog", { name: "请先选择商品图" })).toBeInTheDocument();
    expect(screen.getByText("已选 0")).toBeInTheDocument();
    expect(heroCard).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "我知道了" }));

    await user.click(within(heroCard).getByRole("button", { name: "添加素材" }));

    expect(screen.queryByRole("dialog", { name: "首屏 KV素材" })).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "请先选择商品图" })).toBeInTheDocument();
  });

  it("asks for a product image before selecting detail page modules", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="detail_page" />);

    const brandCard = screen.getByRole("button", {
      name: "品牌介绍 编辑式封面 + 品牌定位",
    });

    await user.click(brandCard);
    await user.click(screen.getByRole("button", { name: "我知道了" }));
    await user.click(screen.getByRole("button", { name: "品牌介绍 增加 1 张" }));

    expect(screen.getByRole("alertdialog", { name: "请先选择商品图" })).toBeInTheDocument();
    expect(screen.getByText("已选 0")).toBeInTheDocument();
    expect(brandCard).toHaveAttribute("aria-pressed", "false");
  });

  it("asks for a product image before switching AI tool modules", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="white_background" />);

    await user.click(screen.getByRole("button", { name: "AI背景" }));

    expect(screen.getByRole("alertdialog", { name: "请先选择商品图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "白底图" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "AI背景" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders detail page settings as a separate studio page", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="detail_page" />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    expect(screen.getByAltText("当前商品图")).toBeInTheDocument();
    expect(screen.getByLabelText("模块")).toHaveValue("详情页");
    expect(screen.getByText("服装详情内容模块")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "品牌介绍 编辑式封面 + 品牌定位",
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("updates selectable page controls", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    expect(screen.getByRole("option", { name: "日语" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "西班牙语" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("输出语言"), "日语");
    await user.click(screen.getByRole("button", { name: "4K" }));
    await user.click(screen.getByRole("button", { name: "标准版快速出图，适合批量 SKU" }));

    expect(screen.getByLabelText("输出语言")).toHaveValue("日语");
    expect(screen.getByRole("button", { name: "4K" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "标准版快速出图，适合批量 SKU" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("shows ecommerce aspect ratios for main images and detail pages", () => {
    const { unmount } = render(<Workspace />);

    for (const label of [
      "原图尺寸",
      "1:1 方图",
      "4:5 竖图",
      "3:4 竖图",
      "9:16 竖图",
      "16:9 横图",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    unmount();
    render(<Workspace activeModule="detail_page" />);

    expect(screen.getByRole("button", { name: "3:4 竖图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9:16 竖图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "详情长图" })).toBeInTheDocument();
  });

  it("updates estimated credits from selected modules, resolution, and edition", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    expect(screen.getByText(/预计消耗 3 积分/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /首屏 KV/ }));
    await user.click(screen.getByRole("button", { name: /整体展示/ }));

    expect(screen.getByText(/预计消耗 4 积分/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2K" }));

    expect(screen.getByText(/预计消耗 6 积分/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "标准版快速出图，适合批量 SKU" }));

    expect(screen.getByText(/预计消耗 4 积分/)).toBeInTheDocument();
  });

  it("lets detail modules stack multiple images and updates the estimate", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="detail_page" />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    await user.click(
      screen.getByRole("button", { name: "品牌介绍 编辑式封面 + 品牌定位" }),
    );
    await user.click(screen.getByRole("button", { name: "品牌介绍 增加 1 张" }));

    expect(screen.getByText("已选 2")).toBeInTheDocument();
    expect(screen.getByText(/预计消耗 4 积分/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "品牌介绍 减少 1 张" }));

    expect(screen.getByText("已选 1")).toBeInTheDocument();
    expect(screen.getByText(/预计消耗 3 积分/)).toBeInTheDocument();
  });

  it("lets users add reference images and notes to a module card", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    const packagingCard = screen.getByRole("button", {
      name: "包装展示 礼盒、配件与开箱细节",
    });

    await user.click(within(packagingCard).getByRole("button", { name: "添加素材" }));
    await chooseLibraryAsset(user, "从图片库添加模块参考图");
    await user.type(
      screen.getByLabelText("素材备注"),
      "Use this exact package box.",
    );
    await user.click(screen.getByRole("button", { name: "保存素材" }));

    expect(screen.getByText("已加 1 张素材")).toBeInTheDocument();
    expect(packagingCard).toHaveAttribute("aria-pressed", "true");
  });

  it("lets users save module material notes without uploading an image", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="detail_page" />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    const colorSizeCard = screen.getByRole("button", {
      name: "颜色尺码 穿着主体 + 色卡 / 尺码",
    });

    await user.click(within(colorSizeCard).getByRole("button", { name: "添加素材" }));
    await user.type(screen.getByLabelText("素材备注"), "只有XL码");
    await user.click(screen.getByRole("button", { name: "保存素材" }));

    expect(screen.getByText("已加 1 条备注")).toBeInTheDocument();
    expect(colorSizeCard).toHaveAttribute("aria-pressed", "true");
  });

  it("renders the module material dialog outside the parameter panel", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    const packagingCard = screen.getByRole("button", {
      name: "包装展示 礼盒、配件与开箱细节",
    });

    await user.click(within(packagingCard).getByRole("button", { name: "添加素材" }));

    const dialog = screen.getByRole("dialog", { name: "包装展示素材" });
    const parameterPanel = document.querySelector(".parameter-panel");

    expect(parameterPanel).not.toContainElement(dialog);
    expect(document.body).toContainElement(dialog);
  });

  it("shows AI tool controls without copy fields on the AI tools page", () => {
    render(<Workspace activeModule="white_background" />);

    expect(screen.getByRole("heading", { name: "AI工具" })).toBeInTheDocument();
    expect(screen.getByLabelText("模块")).toHaveValue("AI工具");
    expect(screen.queryByLabelText("输出语言")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("设计简报")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("促销信息")).not.toBeInTheDocument();
    for (const label of ["白底图", "幽灵模特", "AI背景", "精修", "换装", "换模特"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "产品展示" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "原图尺寸" })).toBeInTheDocument();
  });

  it("shows a target garment library picker only for outfit change", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="white_background" />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));

    expect(screen.queryByRole("button", { name: "从图片库选择换装服饰图" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "换装" }));
    await chooseLibraryAsset(user, "从图片库选择换装服饰图");

    expect(screen.getByText("library-product-1.png")).toBeInTheDocument();
  });

  it("shows a required target model library picker for model change", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="white_background" />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    expect(screen.queryByRole("button", { name: "从图片库选择目标模特照片" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "换模特" }));
    await chooseLibraryAsset(user, "从图片库选择目标模特照片", "library-product-2.png");

    expect(screen.getByAltText("目标模特照片")).toBeInTheDocument();
    expect(screen.getByText("library-product-2.png")).toBeInTheDocument();
  });

  it("supports the two-image replacement workflow and screenshot-matched controls", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="lifestyle" />);

    await chooseLibraryAsset(user, "从图片库选择灵感原图");
    await chooseLibraryAsset(user, "从图片库选择产品服装图", "library-product-2.png");
    expect(screen.getByRole("heading", { name: "灵感创作" })).toBeInTheDocument();
    expect(screen.getByAltText("灵感原图")).toBeInTheDocument();
    expect(await screen.findByAltText("替换产品服装图")).toBeInTheDocument();
    expect(screen.getByText("library-product-2.png")).toBeInTheDocument();
    expect(within(screen.getByLabelText("背景")).getByRole("button", { name: "保持" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByLabelText("产品 / 服装")).getByRole("button", { name: "替换" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(screen.getByLabelText("姿势")).getByRole("button", { name: "调整" }));
    expect(within(screen.getByLabelText("姿势")).getByRole("button", { name: "调整" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("姿势变化幅度")).toBeInTheDocument();
    await user.click(within(screen.getByLabelText("姿势变化幅度")).getByRole("button", { name: "高" }));
    expect(within(screen.getByLabelText("姿势变化幅度")).getByRole("button", { name: "高" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(screen.getByLabelText("背景")).getByRole("button", { name: "调整" }));
    expect(screen.getByLabelText("背景变化幅度")).toBeInTheDocument();
  });

  it("asks for the target garment image before generating outfit change", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="white_background" />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "换装" }));
    await user.click(screen.getByRole("button", { name: "生成换装" }));

    expect(screen.getByRole("alertdialog", { name: "请上传换装服饰" })).toBeInTheDocument();
    expect(screen.queryByText("正在生成")).not.toBeInTheDocument();
  });

  it("asks for the target model image before generating model change", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="white_background" />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "换模特" }));
    await user.click(screen.getByRole("button", { name: "生成换模特" }));

    expect(screen.getByRole("alertdialog", { name: "请上传目标模特" })).toBeInTheDocument();
    expect(screen.queryByText("正在生成")).not.toBeInTheDocument();
  });

  it("does not show model selection controls", () => {
    render(<Workspace activeModule="white_background" />);

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

  it("opens the image library from the product dropzone", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    expect(screen.queryByLabelText("上传商品图")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "从图片库选择商品图" }));
    expect(await screen.findByRole("dialog", { name: "从图片库选择商品图" })).toBeInTheDocument();
  });

  it("displays the product selected from the image library", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await chooseLibraryAsset(user, "从图片库选择商品图");

    expect(screen.getByAltText("当前商品图")).toHaveAttribute(
      "src",
      "https://cdn.example.com/library-product-1.png",
    );
    expect(screen.queryByAltText("原始商品图")).not.toBeInTheDocument();
    expect(screen.getByText("library-product-1.png")).toBeInTheDocument();
  });

  it("does not expose local file inputs outside the image library", () => {
    render(<Workspace />);

    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  it("allows replacing a product with another image-library selection", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await chooseLibraryAsset(user, "从图片库选择商品图");
    await chooseLibraryAsset(user, "从图片库选择商品图", "library-product-2.png");
    expect(screen.getByAltText("当前商品图")).toHaveAttribute(
      "src",
      "https://cdn.example.com/library-product-2.png",
    );
  });

  it("keeps uploaded product images isolated by navigation workspace", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Workspace activeModule="main_image" />);

    await chooseLibraryAsset(user, "从图片库选择商品图");
    expect(await screen.findByText("library-product-1.png")).toBeInTheDocument();

    rerender(<Workspace activeModule="detail_page" />);
    expect(screen.queryByText("library-product-1.png")).not.toBeInTheDocument();
    expect(screen.queryByAltText("当前商品图")).not.toBeInTheDocument();

    await chooseLibraryAsset(user, "从图片库选择商品图", "library-product-2.png");
    expect(await screen.findByText("library-product-2.png")).toBeInTheDocument();

    rerender(<Workspace activeModule="main_image" />);
    expect(screen.getByText("library-product-1.png")).toBeInTheDocument();
    expect(screen.queryByText("library-product-2.png")).not.toBeInTheDocument();
  });

  it("generates material from the sample product and stores the completed task", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: /细节特写/ }));
    await user.click(screen.getByRole("button", { name: "标准版快速出图，适合批量 SKU" }));
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
        creditCost: 4,
        config: {
          generationVersion: "standard",
          resolution: "4K",
          selectedMainModules: ["detail_closeup"],
        },
      });
    });
  });

  it("starts detail page generation from the sample product", async () => {
    const user = userEvent.setup();
    render(<Workspace activeModule="detail_page" />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "主图展示 首屏 KV：建立第一眼识别" }));
    await user.click(screen.getByRole("button", { name: "生成详情页" }));

    expect(await screen.findByAltText("生成结果")).toBeInTheDocument();

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks[0]).toMatchObject({
        status: "completed",
        config: {
          module: "detail_page",
          detailModuleCounts: { main_display: 1 },
        },
      });
    });
  });

  it("allows starting another generation while a previous task is still running", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    let submittedCount = 0;
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("/")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "Content-Type": "image/png" }),
          arrayBuffer: () => Promise.resolve(new Uint8Array([137, 80]).buffer),
        } as Response);
      }

      if (requestUrl.endsWith("/image/generate")) {
        submittedCount += 1;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              task_id: `kroma-parallel-${submittedCount}`,
              status: "processing",
              progress: "处理中",
            }),
        } as Response);
      }

      if (requestUrl.includes("/image/task/")) {
        return new Promise<Response>(() => undefined);
      }

      return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Workspace />);

    fireEvent.click(screen.getByRole("button", { name: "使用示例商品" }));

    await waitFor(() => {
      expect(screen.getByAltText("当前商品图")).toBeInTheDocument();
    });

    const generateButton = screen.getByRole("button", { name: "生成商品主图" });
    fireEvent.click(generateButton);

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks).toHaveLength(1);
      expect(storedTasks[0]?.status).toBe("processing");
    });
    expect(screen.getByRole("button", { name: "生成商品主图" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "生成商品主图" }));

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks).toHaveLength(2);
      expect(storedTasks.every((task) => task.status === "processing")).toBe(true);
    });

    screen
      .getAllByRole("button", { name: "取消生成" })
      .forEach((button) => fireEvent.click(button));
  });

  it("allows new submissions when three local tasks are already running", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const createdTasks: Array<{ resolve: (response: Response) => void }> = [];
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const requestUrl = String(input);
      if (requestUrl.endsWith("/image/generate")) {
        return new Promise<Response>((resolve) => {
          createdTasks.push({ resolve });
        });
      }
      return new Promise<Response>(() => undefined);
    }));
    const runningTasks = Array.from({ length: 3 }, (_, index) =>
      createStoredTask({
        id: `task-running-${index + 1}`,
        status: "processing",
        backendTaskId: `backend-running-${index + 1}`,
        progress: "处理中",
        resultUrls: [],
        creditCost: 0,
        completedAt: undefined,
      }),
    );
    localStorage.setItem(
      "commerce-studio-tasks-v1",
      JSON.stringify(runningTasks),
    );
    render(<Workspace />);

    fireEvent.click(screen.getByRole("button", { name: "使用示例商品" }));
    fireEvent.click(screen.getByText("首屏 KV"));

    expect(await screen.findByRole("button", { name: "生成商品主图" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "生成商品主图" }));

    await waitFor(() => {
      expect(createdTasks).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: "任务已满" })).not.toBeInTheDocument();
  });

  it("keeps in-flight tasks when a delayed history sync finishes", async () => {
    vi.stubEnv("VITE_WEB_API_BASE_URL", "https://web-api.example.com/api/v1");
    vi.stubEnv("VITE_API_BASE_URL", "");
    replaceAccountSnapshot({
      session: {
        identifier: "seller@example.com",
        authView: "login",
        mode: "password",
        storeName: "",
        inviteCode: "",
        createdAt: "2026-06-17T00:00:00.000Z",
        provider: "kroma",
        userId: "web-user-1",
        accessToken: "web-access-token",
        refreshToken: "web-refresh-token",
      },
      balance: 20,
      transactions: [],
    });
    const historyTask = createStoredTask({
      id: "history-task-1",
      createdAt: "2026-06-15T01:00:00.000Z",
    });
    let resolveHistory!: (response: Response) => void;
    const historyRequest = new Promise<Response>((resolve) => {
      resolveHistory = resolve;
    });
    let submittedCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const requestUrl = String(input);

        if (requestUrl.endsWith("/generations?limit=30")) {
          return historyRequest;
        }

        if (requestUrl.endsWith("/user/credits")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ credits: 20 }),
          } as Response);
        }

        if (requestUrl.endsWith("/image/generate")) {
          submittedCount += 1;
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                task_id: `backend-task-${submittedCount}`,
                status: "processing",
                progress: "正在生成图片",
              }),
          } as Response);
        }

        if (requestUrl.includes("/image/task/")) {
          return new Promise<Response>(() => undefined);
        }

        return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
      }),
    );
    const { container, rerender } = render(<Workspace activeModule="detail_page" />);

    fireEvent.click(screen.getByRole("button", { name: "使用示例商品" }));
    fireEvent.click(container.querySelector(".generate-button") as HTMLButtonElement);

    let firstTaskId = "";
    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks).toHaveLength(1);
      expect(storedTasks[0]?.status).toBe("processing");
      firstTaskId = storedTasks[0]?.id ?? "";
    });

    rerender(<Workspace activeModule="white_background" />);
    fireEvent.click(screen.getByRole("button", { name: "使用示例商品" }));
    fireEvent.click(container.querySelector(".generate-button") as HTMLButtonElement);

    let secondTaskId = "";
    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks).toHaveLength(2);
      expect(storedTasks.every((task) => task.status === "processing")).toBe(true);
      secondTaskId = storedTasks.find((task) => task.id !== firstTaskId)?.id ?? "";
    });

    resolveHistory({
      ok: true,
      json: () => Promise.resolve([historyTask]),
    } as Response);

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];
      const storedTaskIds = storedTasks.map((task) => task.id);

      expect(storedTaskIds).toEqual(
        expect.arrayContaining([firstTaskId, secondTaskId, "history-task-1"]),
      );
    });

    screen
      .getAllByRole("button", { name: "取消生成" })
      .forEach((button) => fireEvent.click(button));
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
    expect(getAccountSnapshot().balance).toBe(5);
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
          resultUrls: [],
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
      await screen.findByAltText("生成结果", {}, { timeout: 6000 }),
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

  it("shows returned images from stored processing tasks without polling expired backend tasks", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    vi.stubEnv("VITE_WEB_API_BASE_URL", "");
    vi.stubEnv("VITE_API_BASE_URL", "");
    const storedTask = createStoredTask({
      id: "task-resume-with-results-ui",
      status: "processing",
      backendTaskId: "expired-backend-task",
      progress: "Waiting for backend...",
      resultUrls: ["https://cdn.example.com/already-returned.png"],
      resultAssets: [
        {
          url: "https://cdn.example.com/already-returned.png",
          label: "涓诲浘灞曠ず",
        },
      ],
      creditCost: 5,
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
    const fetchMock = vi.fn(() =>
      Promise.reject(new Error("Expired backend task should not be polled")),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<Workspace />);

    expect(await screen.findByAltText("生成结果")).toHaveAttribute(
      "src",
      "https://cdn.example.com/already-returned.png",
    );
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining("/image/task/expired-backend-task"),
        expect.anything(),
      );
    });
    const storedTasks = JSON.parse(
      localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
    ) as GenerationTask[];
    expect(storedTasks[0]).toMatchObject({
      id: "task-resume-with-results-ui",
      status: "completed",
      resultUrls: ["https://cdn.example.com/already-returned.png"],
      resultAssets: [
        {
          url: "https://cdn.example.com/already-returned.png",
          label: "涓诲浘灞曠ず",
        },
      ],
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
          resultUrls: [],
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

  it("keeps generated AI tool results when credit sync fails after success", async () => {
    vi.stubEnv("VITE_WEB_API_BASE_URL", "https://web-api.example.com/api/v1");
    vi.stubEnv("VITE_API_BASE_URL", "");
    replaceAccountSnapshot({
      session: {
        identifier: "seller@example.com",
        authView: "login",
        mode: "password",
        storeName: "",
        inviteCode: "",
        createdAt: "2026-06-17T00:00:00.000Z",
        provider: "kroma",
        userId: "web-user-1",
        accessToken: "web-access-token",
        refreshToken: "web-refresh-token",
      },
      balance: 20,
      transactions: [],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const requestUrl = String(input);

        if (requestUrl.endsWith("/generations?limit=100")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          } as Response);
        }

        if (requestUrl.endsWith("/user/credits")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ credits: 20 }),
          } as Response);
        }

        if (requestUrl.endsWith("/image/generate")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                task_id: "ai-tool-credit-sync-task",
                status: "processing",
                progress: "正在生成图片",
              }),
          } as Response);
        }

        if (requestUrl.endsWith("/image/task/ai-tool-credit-sync-task")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                task_id: "ai-tool-credit-sync-task",
                status: "done",
                image_url: "https://cdn.example.com/ai-tool-result.png",
              }),
          } as Response);
        }

        if (requestUrl.includes("/user/credits/deduct")) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('{"detail":"Supabase request failed"}'),
          } as Response);
        }

        if (requestUrl.endsWith("/generations")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ saved: true }),
          } as Response);
        }

        return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
      }),
    );
    const user = userEvent.setup();
    render(<Workspace activeModule="white_background" />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "精修" }));
    await user.click(screen.getByRole("button", { name: "生成精修" }));

    expect(await screen.findByAltText("生成结果", {}, { timeout: 3500 })).toHaveAttribute(
      "src",
      "https://cdn.example.com/ai-tool-result.png",
    );

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as GenerationTask[];

      expect(storedTasks[0]).toMatchObject({
        status: "completed",
        resultUrls: ["https://cdn.example.com/ai-tool-result.png"],
      });
    });
  });

});

describe("AppShell", () => {
  it("enables nav buttons and marks the current page active", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { container } = render(
      <AppShell
        page="main_image"
        onPageChange={onPageChange}
        isAuthenticated
      >
        <div />
      </AppShell>,
    );

    expect(screen.getByRole("button", { name: "商品主图" })).toHaveClass(
      "nav-active",
    );
    const navButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".topnav-button"),
    );
    expect(navButtons).toHaveLength(10);
    navButtons.forEach((button) => expect(button).toBeEnabled());

    await user.click(screen.getByRole("button", { name: "价格" }));

    expect(onPageChange).toHaveBeenCalledWith("pricing");
  });
});
