import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { GenerationTask } from "../domain/types";
import { saveTasks } from "../storage/taskStore";
import { HistoryPage } from "./HistoryPage";

const task: GenerationTask = {
  id: "task-history-main",
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
    selectedMainModules: ["hero_kv", "overall_show"],
  },
  status: "completed",
  resultUrls: [
    "data:image/png;base64,result-one",
    "data:image/png;base64,result-two",
  ],
  creditCost: 2,
  createdAt: "2026-06-17T00:00:00.000Z",
  completedAt: "2026-06-17T00:01:00.000Z",
  attempt: 1,
};

beforeEach(() => {
  localStorage.clear();
});

describe("HistoryPage", () => {
  it("shows the specific function used by each task", async () => {
    saveTasks([task]);

    render(<HistoryPage />);

    expect(await screen.findByText("功能")).toBeInTheDocument();
    expect(
      await screen.findByText("商品主图 / 首屏 KV、整体展示"),
    ).toBeInTheDocument();
  });
});
