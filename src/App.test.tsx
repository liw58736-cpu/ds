import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach } from "vitest";
import App from "./App";
import { deductCredits, getAccountSnapshot } from "./storage/accountStore";

beforeEach(() => {
  localStorage.clear();
});

describe("App", () => {
  it("renders the kroma homepage", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "kroma" }),
    ).toBeInTheDocument();
    expect(screen.getByText("跨境电商 AI 生图工作台")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "一键上传 即刻成片",
      }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("单商品电商主图展示")).toBeInTheDocument();
    expect(
      screen.getByAltText("商品主图 KV出图前：普通商品素材"),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("白底图 / 抠图出图后：白底商品图"),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("服装详情页组图出图后：详情页组图"),
    ).toBeInTheDocument();
  });

  it("opens the workspace from the homepage", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "进入工作台" }));

    expect(
      screen.getByRole("heading", { name: "产品素材" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "商品主图" })).toHaveClass(
      "nav-active",
    );
  });

  it("opens detail page from the homepage secondary action", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "查看详情页生成" }));
    expect(
      screen.getByRole("heading", { name: "服装详情页生成" }),
    ).toBeInTheDocument();
  });

  it("opens white background from top navigation after homepage card removal", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "白底图" }));

    expect(
      screen.getByRole("heading", { name: "白底图生成" }),
    ).toBeInTheDocument();
  });

  it("opens pricing and returns to the workspace", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "价格" }));

    expect(
      screen.getByRole("heading", { name: "按你的电商创作节奏选择套餐" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "会员礼遇" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一次性购买" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("heading", { name: "订阅方案" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "产品素材" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "商品主图" }));

    expect(
      screen.getByRole("heading", { name: "产品素材" }),
    ).toBeInTheDocument();
  });

  it("opens the pricing page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "价格" }));

    expect(
      screen.getByRole("heading", { name: "按你的电商创作节奏选择套餐" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一次性购买" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByRole("button", { name: "支付" })).toHaveLength(3);
    await user.click(screen.getAllByRole("button", { name: "支付" })[2]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "已确认 专业包，10,500 积分已入账，当前余额 10,504 积分。",
    );

    await user.click(screen.getByRole("button", { name: "订阅方案" }));

    expect(screen.getByRole("button", { name: "订阅方案" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("heading", { name: "一次性购买" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "支付" })).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "轻度创作首选" })).toBeInTheDocument();
  });

  it("adds purchased credits from pricing and shows them on the account page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "价格" }));
    await user.click(screen.getAllByRole("button", { name: "支付" })[2]);

    expect(screen.getByRole("status")).toHaveTextContent(
      "已确认 专业包，10,500 积分已入账，当前余额 10,504 积分。",
    );

    await user.click(screen.getByRole("button", { name: "账户" }));

    expect(screen.getByText("10,504 credits")).toBeInTheDocument();
    expect(screen.getByText("购买 专业包")).toBeInTheDocument();
  });

  it("opens the account page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "账户" }));

    expect(screen.getByRole("heading", { name: "账户与用量" })).toBeInTheDocument();
    expect(screen.queryByText("Account Settings")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "登录或绑定账户" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "登录" }));
    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  });

  it("opens the login page and validates the demo login form", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "注册" })).not.toBeInTheDocument();
    expect(screen.queryByText("扫码登录预留")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "微信" })).not.toBeInTheDocument();

    const loginForm = screen.getByRole("form", { name: "登录表单" });
    await user.click(
      within(loginForm).getByRole("button", { name: "登录 kroma" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("请输入手机号或邮箱。");

    await user.type(
      within(loginForm).getByLabelText("手机号或邮箱"),
      "seller@example.com",
    );
    await user.click(
      within(loginForm).getByRole("button", { name: "获取验证码" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "验证码已发送至 seller@example.com",
    );

    await user.type(within(loginForm).getByLabelText("验证码"), "123456");
    await user.click(within(loginForm).getByLabelText("我已阅读并同意"));
    await user.click(
      within(loginForm).getByRole("button", { name: "登录 kroma" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "已为 seller@example.com 创建当前会话，积分与历史任务会在此账户下保存。",
    );

    await user.click(within(loginForm).getByRole("button", { name: "隐私政策" }));
    expect(screen.getByRole("heading", { name: "隐私政策" })).toBeInTheDocument();
  });

  it("keeps the login page focused on one simple login form", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "登录" }));
    const loginForm = screen.getByRole("form", { name: "登录表单" });

    expect(within(loginForm).getByLabelText("手机号或邮箱")).toBeInTheDocument();
    expect(within(loginForm).getByLabelText("验证码")).toBeInTheDocument();
    expect(within(loginForm).getByRole("button", { name: "获取验证码" })).toBeInTheDocument();
    expect(screen.queryByLabelText("店铺或团队名称")).not.toBeInTheDocument();
    expect(screen.queryByText("或使用快捷方式")).not.toBeInTheDocument();
    expect(screen.queryByText("企业账号登录")).not.toBeInTheDocument();
  });

  it("preserves workspace product and parameter edits after visiting secondary pages", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "商品主图" }));
    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.type(screen.getByLabelText("设计简报"), "Waterproof steel bottle");

    await user.click(screen.getByRole("button", { name: "账户" }));
    expect(screen.getByRole("heading", { name: "账户与用量" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "价格" }));
    expect(
      screen.getByRole("heading", { name: "按你的电商创作节奏选择套餐" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "商品主图" }));

    expect(screen.getByText("sample-product.jpg")).toBeInTheDocument();
    expect(screen.getByLabelText("设计简报")).toHaveValue(
      "Waterproof steel bottle",
    );
  });

  it("lets an in-progress generation complete after visiting pricing", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "商品主图" }));
    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    fireEvent.click(screen.getByRole("button", { name: "生成商品主图" }));
    expect(screen.getByRole("button", { name: "取消生成" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "价格" }));
    expect(
      screen.getByRole("heading", { name: "按你的电商创作节奏选择套餐" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("commerce-studio-tasks-v1") ?? "[]",
      ) as Array<{ status?: string }>;

      expect(storedTasks[0]?.status).toBe("completed");
    });
    fireEvent.click(screen.getByRole("button", { name: "商品主图" }));

    expect(screen.getByAltText("生成结果")).toBeInTheDocument();
    expect(screen.queryByText("已生成")).not.toBeInTheDocument();
  });

  it("deducts credits after successful generations and preserves credits on failures", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "商品主图" }));
    expect(getAccountSnapshot().balance).toBe(4);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "生成商品主图" }));
    expect(await screen.findByAltText("生成结果")).toBeInTheDocument();

    expect(getAccountSnapshot().balance).toBe(3);

    await user.type(screen.getByLabelText("设计简报"), "fail");
    await user.click(screen.getByRole("button", { name: "生成商品主图" }));
    expect(await screen.findAllByText("模拟生成失败，请重试。")).toHaveLength(1);

    expect(getAccountSnapshot().balance).toBe(3);
  });

  it("routes exhausted trial users to pricing instead of generating", async () => {
    const user = userEvent.setup();
    getAccountSnapshot();
    deductCredits(4, "试用额度耗尽");
    render(<App />);

    await user.click(screen.getByRole("button", { name: "商品主图" }));

    expect(getAccountSnapshot().balance).toBe(0);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "购买积分" }));

    expect(
      screen.getByRole("heading", { name: "按你的电商创作节奏选择套餐" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "产品素材" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "支付" })[2]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "已确认 专业包，10,500 积分已入账，当前余额 10,500 积分。",
    );

    await user.click(screen.getByRole("button", { name: "商品主图" }));

    expect(getAccountSnapshot().balance).toBe(10500);
    expect(
      screen.getByRole("button", { name: "生成商品主图" }),
    ).toBeInTheDocument();
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
      screen.getByRole("region", { name: "历史任务统计" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "最近任务" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "产品素材" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "实时预览" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "服装详情页生成" }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "历史任务" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  });

  it("opens legal pages from the footer", async () => {
    const user = userEvent.setup();
    render(<App />);

    const pages = [
      { button: "服务条款", title: "服务条款", text: "积分、套餐与支付" },
      { button: "隐私政策", title: "隐私政策", text: "图片与生成内容" },
      { button: "退款政策", title: "退款政策", text: "活动与赠送积分" },
      { button: "积分说明", title: "积分消耗说明", text: "扣减规则" },
      { button: "联系支持", title: "联系支持", text: "liw58736@gmail.com" },
      { button: "关于我们", title: "关于我们", text: "产品原则" },
      { button: "企业采购", title: "企业采购与发票", text: "发票说明" },
    ];

    for (const item of pages) {
      await user.click(screen.getByRole("button", { name: item.button }));

      expect(screen.getByRole("heading", { name: item.title })).toBeInTheDocument();
      expect(
        screen.getByText((content) => content.includes(item.text)),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: item.button })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });
});
