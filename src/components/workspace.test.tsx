import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Workspace } from "./Workspace";

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
});
