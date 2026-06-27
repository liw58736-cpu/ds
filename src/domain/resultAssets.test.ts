import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationTask } from "./types";
import { downloadTaskAsset } from "./resultAssets";

const task: GenerationTask = {
  id: "task-download",
  productInput: {
    id: "product-1",
    imageUrl: "data:image/png;base64,product",
    fileName: "product.png",
    createdAt: "2026-06-17T00:00:00.000Z",
    source: "upload",
  },
  config: {
    module: "main_image",
    platform: "shopify",
    aspectRatio: "1:1",
    style: "premium",
    outputFormat: "png",
    sellingPoints: "",
    specifications: "",
    resolution: "1K",
  },
  status: "completed",
  resultUrls: ["https://cdn.example.com/result.png"],
  resultAssets: [{ url: "https://cdn.example.com/result.png", label: "首屏 KV" }],
  creditCost: 1,
  createdAt: "2026-06-17T00:00:00.000Z",
  completedAt: "2026-06-17T00:01:00.000Z",
  attempt: 1,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("result asset downloads", () => {
  it("downloads a single result through a blob URL instead of navigating to the image URL", async () => {
    const click = vi.fn();
    const remove = vi.fn();
    const revokeObjectURL = vi.fn();
    const append = vi.spyOn(document.body, "append");
    const blob = new Blob(["image"], { type: "image/png" });
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(blob));
    const createElement = vi
      .spyOn(document, "createElement")
      .mockReturnValue({
        click,
        remove,
        href: "",
        download: "",
        rel: "",
      } as unknown as HTMLAnchorElement);
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:kroma-result");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeObjectURL);

    await downloadTaskAsset(task, task.resultAssets![0], 0);

    expect(fetch).toHaveBeenCalledWith("https://cdn.example.com/result.png");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(createElement).toHaveBeenCalledWith("a");
    expect(append).toHaveBeenCalledOnce();
    expect(createElement.mock.results[0].value.href).toBe("blob:kroma-result");
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:kroma-result");
  });
});
