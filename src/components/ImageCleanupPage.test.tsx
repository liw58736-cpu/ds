import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { drawTransparentCleanupMask, ImageCleanupPage } from "./ImageCleanupPage";

describe("ImageCleanupPage", () => {
  it("uses transparent painted areas in the provider mask", () => {
    const operations: string[] = [];
    const context = {
      clearRect: () => operations.push("clear"),
      fillRect: () => operations.push("opaque-base"),
      beginPath: () => operations.push("begin"),
      arc: () => operations.push("transparent-dot"),
      fill: () => operations.push("fill-dot"),
      moveTo: () => operations.push("move"),
      lineTo: () => operations.push("line"),
      stroke: () => operations.push("transparent-stroke"),
    } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(context, "globalCompositeOperation", {
      set: (value: string) => operations.push(`composite:${value}`),
    });

    drawTransparentCleanupMask(context, 1084, 2412, [
      { size: 36, points: [{ x: 20, y: 30 }] },
      { size: 24, points: [{ x: 10, y: 10 }, { x: 50, y: 50 }] },
    ]);

    expect(operations).toEqual(expect.arrayContaining([
      "opaque-base",
      "composite:destination-out",
      "transparent-dot",
      "transparent-stroke",
    ]));
    expect(operations[operations.length - 1]).toBe("composite:source-over");
  });

  it("opens a stored extracted image directly in the cleanup canvas", () => {
    const onInitialProductConsumed = vi.fn();
    render(
      <ImageCleanupPage
        isAuthenticated
        onRequireLogin={vi.fn()}
        onOpenPricing={vi.fn()}
        initialProduct={{
          id: "material-1",
          imageUrl: "https://web-project.supabase.co/storage/material.jpg",
          fileName: "小红书图片",
          createdAt: "2026-09-02T00:00:00.000Z",
          source: "upload",
        }}
        onInitialProductConsumed={onInitialProductConsumed}
      />,
    );

    expect(screen.getByAltText("待清理图片")).toHaveAttribute(
      "src",
      "https://web-project.supabase.co/storage/material.jpg",
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "从图片库选择待清理图片" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("已载入提取图片");
    expect(onInitialProductConsumed).toHaveBeenCalledOnce();
  });

  it("shows a login dialog before an unauthenticated cleanup request", async () => {
    const user = userEvent.setup();
    const onRequireLogin = vi.fn();
    render(
      <ImageCleanupPage
        isAuthenticated={false}
        onRequireLogin={onRequireLogin}
        onOpenPricing={vi.fn()}
        initialProduct={{
          id: "material-2",
          imageUrl: "https://web-project.supabase.co/storage/material.jpg",
          fileName: "小红书图片",
          createdAt: "2026-09-02T00:00:00.000Z",
          source: "upload",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "开始清理（1 积分）" }));
    expect(screen.getByRole("alertdialog", { name: "请先登录" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "去登录" }));
    expect(onRequireLogin).toHaveBeenCalledOnce();
  });
});
