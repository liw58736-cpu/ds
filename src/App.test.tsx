import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach } from "vitest";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
});

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
    expect(
      screen.queryByRole("heading", { name: "商品图" }),
    ).not.toBeInTheDocument();

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

  it("preserves workspace product and parameter edits after visiting secondary pages", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.type(screen.getByLabelText("卖点"), "Waterproof steel bottle");

    await user.click(screen.getByRole("button", { name: "模板库" }));
    expect(
      screen.getByRole("heading", { name: "模板库" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "价格" }));
    expect(screen.getByRole("heading", { name: "价格" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "工作台" }));

    expect(screen.getByText("sample-product.jpg")).toBeInTheDocument();
    expect(screen.getByLabelText("卖点")).toHaveValue(
      "Waterproof steel bottle",
    );
  });

  it("lets an in-progress generation complete after visiting templates", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    fireEvent.click(screen.getByRole("button", { name: "生成素材" }));
    expect(screen.getAllByText("处理中").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "模板库" }));
    expect(
      screen.getByRole("heading", { name: "模板库" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as Array<{ status?: string }>;

      expect(storedTasks[0]?.status).toBe("completed");
    });
    fireEvent.click(screen.getByRole("button", { name: "工作台" }));

    expect(screen.getByAltText("生成结果")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
  });

  it("shows coherent history content and active nav", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "历史任务" }));

    expect(
      screen.getByRole("button", { name: "历史任务" }),
    ).toHaveClass("nav-active");
    expect(
      screen.getByRole("heading", { name: "历史任务" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "最近任务" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "历史任务" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  });
});
