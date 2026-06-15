import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("App", () => {
  it("renders the current Commerce Studio workspace", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Commerce Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByText("跨境电商生图工作台")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "商品图" }),
    ).toBeInTheDocument();
  });

  it("opens templates and returns to the workspace", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "模板库" }));

    expect(
      screen.getByRole("heading", { name: "模板库" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "工作台" }));

    expect(
      screen.getByRole("heading", { name: "商品图" }),
    ).toBeInTheDocument();
  });

  it("opens the pricing page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "价格" }));

    expect(screen.getByRole("heading", { name: "价格" })).toBeInTheDocument();
  });

  it("opens the account page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "账户" }));

    expect(screen.getByRole("heading", { name: "账户" })).toBeInTheDocument();
  });
});
