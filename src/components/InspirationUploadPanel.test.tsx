import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InspirationUploadPanel } from "./InspirationUploadPanel";

vi.mock("../api/materialLibraryApi", () => ({ listMaterialLibraryAssets: vi.fn().mockResolvedValue([
  { id: "base", imageUrl: "https://cdn.example.com/base.jpg", fileName: "base.jpg", createdAt: "2026-09-03T00:00:00.000Z", source: "saved", sourceLabel: "保存图片" },
  { id: "shirt", imageUrl: "https://cdn.example.com/shirt.jpg", fileName: "shirt.jpg", createdAt: "2026-09-03T00:01:00.000Z", source: "saved", sourceLabel: "保存图片" },
]) }));

describe("InspirationUploadPanel", () => {
  it("uses exactly two explicit image roles", async () => {
    const user = userEvent.setup();
    const onInspirationChange = vi.fn();
    const onReplacementChange = vi.fn();
    render(<InspirationUploadPanel inspiration={null} onInspirationChange={onInspirationChange} onReplacementChange={onReplacementChange} />);

    await user.click(screen.getByRole("button", { name: "从图片库选择灵感原图" }));
    let dialog = await screen.findByRole("dialog", { name: "从图片库选择灵感原图" });
    await user.click(within(dialog).getByRole("button", { name: /base.jpg/ }));
    await user.click(screen.getByRole("button", { name: "从图片库选择产品服装图" }));
    dialog = await screen.findByRole("dialog", { name: "从图片库选择产品 \/ 服装图" });
    await user.click(within(dialog).getByRole("button", { name: /shirt.jpg/ }));

    expect(onInspirationChange).toHaveBeenCalledOnce();
    expect(onReplacementChange).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /上传/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Image 3/)).not.toBeInTheDocument();
  });
});
