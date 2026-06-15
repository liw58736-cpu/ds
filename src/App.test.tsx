import { render, screen } from "@testing-library/react";
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
});
