import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importPublicMaterial, storeImportedMaterial } from "../api/materialImportApi";
import { MaterialImportPanel } from "./MaterialImportPanel";

vi.mock("../api/materialImportApi", () => ({
  importPublicMaterial: vi.fn(),
  storeImportedMaterial: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("MaterialImportPanel", () => {
  it("shows an obvious login dialog instead of only a small status line", async () => {
    const user = userEvent.setup();
    const onRequireLogin = vi.fn();
    render(
      <MaterialImportPanel
        onUseAsProduct={vi.fn()}
        onUseAsReference={vi.fn()}
        isAuthenticated={false}
        onRequireLogin={onRequireLogin}
      />,
    );

    await user.type(
      screen.getByLabelText("公开素材链接"),
      "https://www.xiaohongshu.com/explore/note-1",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "提取笔记图片" }));

    expect(screen.getByRole("alertdialog", { name: "请先登录" })).toHaveTextContent(
      "登录后才能提取并保存小红书图片",
    );
    await user.click(screen.getByRole("button", { name: "去登录" }));
    expect(onRequireLogin).toHaveBeenCalledOnce();
    expect(importPublicMaterial).not.toHaveBeenCalled();
  });

  it("extracts pasted Xiaohongshu share text and hands a stable image to cleanup", async () => {
    const user = userEvent.setup();
    const onUseForCleanup = vi.fn();
    vi.mocked(importPublicMaterial).mockResolvedValue({
      sourceUrl: "https://www.xiaohongshu.com/explore/note-1",
      title: "商品搭配 - 小红书",
      images: [
        "https://sns-webpic-qc.xhscdn.com/first.jpg",
        "https://sns-webpic-qc.xhscdn.com/second.jpg",
      ],
      limited: false,
      sourcePlatform: "xiaohongshu",
    });
    vi.mocked(storeImportedMaterial).mockResolvedValue(
      "https://web-project.supabase.co/storage/v1/object/public/web-imported-materials/user/material.jpg",
    );

    render(
      <MaterialImportPanel
        onUseAsProduct={vi.fn()}
        onUseAsReference={vi.fn()}
        onUseForCleanup={onUseForCleanup}
      />,
    );

    await user.type(
      screen.getByLabelText("公开素材链接"),
      "复制小红书分享文案 https://www.xiaohongshu.com/explore/note-1 打开查看",
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "我确认拥有或已获授权下载、编辑和使用这些素材",
      }),
    );
    await user.click(screen.getByRole("button", { name: "提取笔记图片" }));

    expect(await screen.findAllByAltText(/提取素材/)).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("小红书笔记已提取 2 张图片");
    await user.click(screen.getAllByRole("button", { name: "去水印/文字" })[0]);

    await waitFor(() => {
      expect(storeImportedMaterial).toHaveBeenCalledWith(
        "https://sns-webpic-qc.xhscdn.com/first.jpg",
        true,
      );
      expect(onUseForCleanup).toHaveBeenCalledWith(
        "https://web-project.supabase.co/storage/v1/object/public/web-imported-materials/user/material.jpg",
        "商品搭配 - 小红书",
      );
    });
  });
});
