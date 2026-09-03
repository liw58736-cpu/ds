import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importPublicMaterial, saveImportedMaterial, uploadLocalMaterial } from "../api/materialImportApi";
import { listMaterialLibraryAssets } from "../api/materialLibraryApi";
import { MaterialLibraryPage } from "./MaterialLibraryPage";

vi.mock("../api/materialImportApi", () => ({ importPublicMaterial: vi.fn(), saveImportedMaterial: vi.fn(), uploadLocalMaterial: vi.fn() }));
vi.mock("../api/materialLibraryApi", () => ({ listMaterialLibraryAssets: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe("MaterialLibraryPage", () => {
  it("has no authorization checkbox and saves only selected extracted photos", async () => {
    const user = userEvent.setup();
    vi.mocked(listMaterialLibraryAssets).mockResolvedValue([]);
    vi.mocked(importPublicMaterial).mockResolvedValue({
      sourceUrl: "https://www.xiaohongshu.com/explore/note",
      title: "穿搭参考 - 小红书",
      images: ["https://cdn.example.com/1.jpg", "https://cdn.example.com/2.jpg"],
      limited: false,
      sourcePlatform: "xiaohongshu",
    });
    vi.mocked(saveImportedMaterial).mockResolvedValue({ id: "saved-1", imageUrl: "stored", fileName: "穿搭参考 1", createdAt: "2026-09-03T00:00:00.000Z", contentType: "image/jpeg", size: 100 });
    render(<MaterialLibraryPage isAuthenticated onRequireLogin={vi.fn()} />);

    expect(screen.queryByRole("checkbox", { name: /授权/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("小红书素材链接"), "https://www.xiaohongshu.com/explore/note");
    await user.click(screen.getByRole("button", { name: "提取图片" }));
    await user.click(await screen.findByRole("checkbox", { name: "选择照片 2" }));
    await user.click(screen.getByRole("button", { name: "保存选中照片（1）" }));

    expect(saveImportedMaterial).toHaveBeenCalledTimes(1);
    expect(saveImportedMaterial).toHaveBeenCalledWith("https://cdn.example.com/2.jpg", true, "穿搭参考-1");
  });

  it("shows background sync failure inline without an unsolicited popup", async () => {
    vi.mocked(listMaterialLibraryAssets).mockRejectedValue(new Error("Failed to fetch"));
    render(<MaterialLibraryPage isAuthenticated onRequireLogin={vi.fn()} />);

    expect(await screen.findByText("图片库暂时无法同步。点击“重新读取”重试。")).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("is the only surface that accepts multiple local image uploads", async () => {
    const user = userEvent.setup();
    vi.mocked(listMaterialLibraryAssets).mockResolvedValue([]);
    vi.mocked(uploadLocalMaterial).mockImplementation(async (file) => ({
      id: `saved-${file.name}`,
      imageUrl: `https://cdn.example.com/${file.name}`,
      fileName: file.name,
      createdAt: "2026-09-03T00:00:00.000Z",
      contentType: file.type,
      size: file.size,
    }));
    render(<MaterialLibraryPage isAuthenticated onRequireLogin={vi.fn()} />);

    const input = screen.getByLabelText("从本地批量上传图片");
    expect(input).toHaveAttribute("multiple");
    await user.upload(input, [
      new File(["one"], "one.png", { type: "image/png" }),
      new File(["two"], "two.webp", { type: "image/webp" }),
    ]);

    await waitFor(() => expect(uploadLocalMaterial).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("已上传 2 张图片。")).toBeVisible();
  });
});
