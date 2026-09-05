import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  getCachedMaterialLibraryAssets,
  listMaterialLibraryAssets,
} from "../api/materialLibraryApi";
import { MaterialPickerDialog } from "./MaterialPickerDialog";

vi.mock("../api/materialLibraryApi", () => ({
  getCachedMaterialLibraryAssets: vi.fn(),
  listMaterialLibraryAssets: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("shows cached images immediately and refreshes only 40 items in the background", async () => {
  const cached = {
    id: "cached",
    imageUrl: "https://cdn.example.com/cached.webp",
    fileName: "最近图片",
    createdAt: "2026-09-05T00:00:00.000Z",
    source: "saved" as const,
    sourceLabel: "保存图片",
  };
  const refreshed = {
    ...cached,
    id: "refreshed",
    imageUrl: "https://cdn.example.com/refreshed.webp",
    fileName: "最新图片",
  };
  let finishRefresh!: (assets: typeof refreshed[]) => void;
  vi.mocked(getCachedMaterialLibraryAssets).mockReturnValue([cached]);
  vi.mocked(listMaterialLibraryAssets).mockReturnValue(
    new Promise((resolve) => {
      finishRefresh = resolve;
    }),
  );

  render(
    <MaterialPickerDialog
      open
      title="选择商品图"
      onPick={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  const cachedImage = screen.getByAltText("最近图片");
  expect(cachedImage).toBeVisible();
  expect(cachedImage).toHaveAttribute("loading", "lazy");
  expect(cachedImage).toHaveAttribute("decoding", "async");
  expect(cachedImage).toHaveAttribute("fetchpriority", "low");
  expect(screen.getByText("已显示最近图片，正在后台同步最新内容…")).toBeVisible();
  expect(listMaterialLibraryAssets).toHaveBeenCalledWith(0, 40);

  finishRefresh([refreshed]);
  await waitFor(() => expect(screen.getByAltText("最新图片")).toBeVisible());
  expect(screen.queryByAltText("最近图片")).not.toBeInTheDocument();
});
