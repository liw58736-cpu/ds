import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NoticeDialog } from "./NoticeDialog";

describe("NoticeDialog", () => {
  it("shows important information above the page and runs its primary action", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onPrimary = vi.fn();
    render(
      <NoticeDialog
        open
        title="请先登录"
        message="登录后才能提取图片。"
        primaryLabel="去登录"
        onPrimary={onPrimary}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("alertdialog", { name: "请先登录" })).toBeInTheDocument();
    expect(screen.getByText("登录后才能提取图片。")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "去登录" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onPrimary).toHaveBeenCalledOnce();
  });

  it("can be dismissed with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <NoticeDialog
        open
        title="提示"
        message="请检查输入。"
        onClose={onClose}
      />,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
