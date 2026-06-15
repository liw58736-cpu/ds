import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the Commerce Studio smoke content", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Commerce Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByText("电商主图与详情页生成工作台")).toBeInTheDocument();
  });
});
