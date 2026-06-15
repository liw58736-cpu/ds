import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { Workspace } from "./Workspace";

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

  it("allows keyboard focus to reach the upload input inside the dropzone", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    for (let tabCount = 0; tabCount < 7; tabCount += 1) {
      await user.tab();
    }

    const uploadInput = screen.getByLabelText("上传商品图");
    expect(uploadInput).toHaveFocus();
    expect(uploadInput.closest(".upload-dropzone")).toBeInTheDocument();
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
