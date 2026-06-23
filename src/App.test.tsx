import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import App from "./App";
import {
  deductCredits,
  getAccountSnapshot,
  initializeSession,
} from "./storage/accountStore";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function signInForTest(identifier = "seller@example.com") {
  initializeSession({
    identifier,
    authView: "login",
    mode: "password",
    storeName: "",
    inviteCode: "",
    createdAt: "2026-06-20T00:00:00.000Z",
  });
}

function signInWithKromaForTest(identifier = "seller@example.com") {
  initializeSession({
    identifier,
    authView: "login",
    mode: "password",
    storeName: "",
    inviteCode: "",
    createdAt: "2026-06-20T00:00:00.000Z",
    provider: "kroma",
    userId: "user-1",
    accessToken: "access-token",
    refreshToken: "refresh-token",
  });
}

describe("App", () => {
  it("renders the kroma homepage", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "kroma" }),
    ).toBeInTheDocument();
    expect(screen.getByText("跨境电商 AI 生图工作台")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "AI 商品图，一键生成可上架素材",
      }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("kroma 商品图生成首页主视觉")).toBeInTheDocument();
    expect(
      screen.getByAltText("商品主图和首屏 KV出图前"),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("白底图和平台抠图出图后"),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("服装详情页组图出图后"),
    ).toBeInTheDocument();
  });

  it("opens the workspace from the homepage", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "开始生成商品图" }));

    expect(
      screen.getByRole("heading", { name: "产品素材" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "商品主图" })).toHaveClass(
      "nav-active",
    );
  });

  it("hides private pages and routes guest generation to login", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole("button", { name: "账户" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "历史任务" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "商品主图" }));
    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: "生成商品主图" }));

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.queryByAltText("生成结果")).not.toBeInTheDocument();
  });

  it("opens detail page from the homepage secondary action", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "生成详情页组图" }));
    expect(
      screen.getByRole("heading", { name: "服装详情页生成" }),
    ).toBeInTheDocument();
  });

  it("opens AI tools from top navigation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "AI工具" }));

    expect(
      screen.getByRole("heading", { name: "AI工具" }),
    ).toBeInTheDocument();
  });

  it("places AI tools after the detail page in the top navigation", () => {
    const { container } = render(<App />);
    const navLabels = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".topnav-button"),
      (button) => button.textContent,
    );

    expect(navLabels).toEqual([
      "首页",
      "商品主图",
      "详情页",
      "AI工具",
      "价格",
      "登录",
    ]);
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
    expect(screen.queryByText(/视频积分/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nano Banana 2/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "支付" })).toHaveLength(3);
    await user.click(screen.getAllByRole("button", { name: "支付" })[2]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "已确认 专业包，950 积分已入账，当前余额 955 积分。",
    );

    await user.click(screen.getByRole("button", { name: "订阅方案" }));

    expect(screen.getByRole("button", { name: "订阅方案" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("heading", { name: "一次性购买" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "支付" })).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "轻度创作首选" })).toBeInTheDocument();
    expect(screen.queryByText(/视频积分/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nano Banana 2/)).not.toBeInTheDocument();
  });

  it("adds purchased credits from pricing and shows them on the account page", async () => {
    const user = userEvent.setup();
    signInForTest();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "价格" }));
    await user.click(screen.getAllByRole("button", { name: "支付" })[2]);

    expect(screen.getByRole("status")).toHaveTextContent(
      "已确认 专业包，950 积分已入账，当前余额 955 积分。",
    );

    await user.click(screen.getByRole("button", { name: "账户" }));

    expect(screen.getByText("955 credits")).toBeInTheDocument();
    expect(screen.queryByText("最近积分记录")).not.toBeInTheDocument();
    expect(screen.queryByText("购买 专业包")).not.toBeInTheDocument();
  });

  it("shows a payment configuration error instead of mock-crediting in production", async () => {
    vi.stubEnv("PROD", true);
    const user = userEvent.setup();
    signInForTest();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "价格" }));
    await user.click(screen.getAllByRole("button", { name: "支付" })[2]);

    expect(screen.getByRole("status")).toHaveTextContent(
      "支付通道未配置，请稍后再试或联系支持。",
    );
    expect(getAccountSnapshot().balance).toBe(5);
  });

  it("opens Paddle checkout from pricing without crediting before webhook", async () => {
    vi.stubEnv("VITE_WEB_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    vi.stubEnv("VITE_PADDLE_CLIENT_TOKEN", "test-client-token");
    vi.stubEnv("VITE_PADDLE_PRICE_PRO_TOP_UP", "pri_pro");
    const checkoutOpen = vi.fn();
    vi.stubGlobal("Paddle", {
      Initialize: vi.fn(),
      Checkout: { open: checkoutOpen },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            service: "kroma-web-backend",
            commit: "commit-1",
            checked_at: "2026-06-24T00:00:00.000Z",
            config: {
              supabaseUrl: true,
              supabaseAnonKey: true,
              supabaseServiceRoleKey: true,
              resendApiKey: true,
              authEmailFrom: true,
              authRedirectUrl: true,
              allowedAuthRedirects: true,
              internalBillingKey: true,
              paddleWebhookSecret: true,
              paddlePriceCredits: true,
              imageApiBaseUrl: true,
              imageApiKey: true,
            },
            database: {
              webUsers: true,
              webCreditTransactions: true,
              webGenerations: true,
              webAuthCodes: true,
              webBillingEvents: true,
            },
            missing: [],
          }),
      }),
    );
    const user = userEvent.setup();
    signInWithKromaForTest("seller@example.com");
    render(<App />);

    await user.click(screen.getByRole("button", { name: "价格" }));
    await user.click(screen.getAllByRole("button", { name: "支付" })[2]);

    expect(screen.getByRole("status")).toHaveTextContent(
      "已打开 专业包 支付窗口，付款成功后积分会自动入账。",
    );
    expect(checkoutOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ priceId: "pri_pro", quantity: 1 }],
        customData: expect.objectContaining({
          plan_id: "pro-top-up",
          credits: 950,
        }),
      }),
    );
    expect(getAccountSnapshot().balance).toBe(5);
  });

  it("blocks Paddle checkout when backend payment fulfillment is not ready", async () => {
    vi.stubEnv("VITE_WEB_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    vi.stubEnv("VITE_PADDLE_CLIENT_TOKEN", "test-client-token");
    vi.stubEnv("VITE_PADDLE_PRICE_PRO_TOP_UP", "pri_pro");
    const checkoutOpen = vi.fn();
    vi.stubGlobal("Paddle", {
      Initialize: vi.fn(),
      Checkout: { open: checkoutOpen },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: false,
            service: "kroma-web-backend",
            commit: "commit-1",
            checked_at: "2026-06-24T00:00:00.000Z",
            config: {
              supabaseUrl: true,
              supabaseAnonKey: true,
              supabaseServiceRoleKey: true,
              resendApiKey: true,
              authEmailFrom: true,
              authRedirectUrl: true,
              allowedAuthRedirects: true,
              internalBillingKey: false,
              paddleWebhookSecret: false,
              paddlePriceCredits: false,
              imageApiBaseUrl: true,
              imageApiKey: true,
            },
            database: {
              webUsers: true,
              webCreditTransactions: true,
              webGenerations: true,
              webAuthCodes: true,
              webBillingEvents: true,
            },
            missing: [
              "internalBillingKey",
              "paddleWebhookSecret",
              "paddlePriceCredits",
            ],
          }),
      }),
    );
    const user = userEvent.setup();
    signInWithKromaForTest("seller@example.com");
    render(<App />);

    await user.click(screen.getByRole("button", { name: "价格" }));
    await user.click(screen.getAllByRole("button", { name: "支付" })[2]);

    expect(screen.getByRole("status")).toHaveTextContent(
      "支付入账暂未配置完成，请稍后再试或联系支持。",
    );
    expect(checkoutOpen).not.toHaveBeenCalled();
  });

  it("opens account page after Paddle success redirect and clears the URL flag", async () => {
    window.history.pushState({}, "", "/?payment=paddle-success");
    const user = userEvent.setup();
    signInWithKromaForTest("seller@example.com");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "账户与用量" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "支付已完成，积分到账可能需要几秒钟，请刷新账户余额确认。",
    );
    expect(window.location.search).toBe("");

    await user.click(screen.getByRole("button", { name: "账户" }));
    expect(screen.queryByText(/App 和网页共用/)).not.toBeInTheDocument();
  });

  it("requires login when Paddle success redirect has no saved session", () => {
    window.history.pushState({}, "", "/?payment=paddle-success");
    render(<App />);

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "账户与用量" }),
    ).not.toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("requires a Kroma account before opening Paddle checkout", async () => {
    vi.stubEnv("VITE_PADDLE_CLIENT_TOKEN", "test-client-token");
    vi.stubEnv("VITE_PADDLE_PRICE_PRO_TOP_UP", "pri_pro");
    const checkoutOpen = vi.fn();
    vi.stubGlobal("Paddle", {
      Initialize: vi.fn(),
      Checkout: { open: checkoutOpen },
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "价格" }));
    await user.click(screen.getAllByRole("button", { name: "支付" })[2]);

    expect(screen.getByRole("status")).toHaveTextContent(
      "请先登录 kroma 账户，再购买积分。",
    );
    expect(checkoutOpen).not.toHaveBeenCalled();
  });

  it("opens the account page", async () => {
    const user = userEvent.setup();
    signInForTest();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "账户" }));

    expect(screen.getByRole("heading", { name: "账户与用量" })).toBeInTheDocument();
    expect(screen.queryByText("Account Settings")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "登录或绑定账户" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "登录" }));
    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  });

  it("shows backend system status on the account page", async () => {
    vi.stubEnv("VITE_WEB_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            credits: 12,
            plan: "free",
            is_paid: false,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: false,
            service: "kroma-web-backend",
            commit: "commit-1",
            checked_at: "2026-06-23T00:00:00.000Z",
            config: {
              supabaseUrl: true,
              supabaseAnonKey: true,
              supabaseServiceRoleKey: true,
              resendApiKey: true,
              internalBillingKey: true,
              paddleWebhookSecret: false,
              paddlePriceCredits: false,
              imageApiBaseUrl: false,
              imageApiKey: false,
            },
            database: {
              webUsers: true,
              webAuthCodes: true,
              webBillingEvents: false,
            },
            missing: ["paddleWebhookSecret"],
          }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    signInWithKromaForTest();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "账户" }));

    const systemStatus = screen.getByLabelText("系统状态");
    await waitFor(() => {
      expect(within(systemStatus).getByText("账号服务")).toBeInTheDocument();
      expect(within(systemStatus).getByText("支付入账")).toBeInTheDocument();
      expect(within(systemStatus).getByText("真实生图")).toBeInTheDocument();
    });
    expect(within(systemStatus).getAllByText("正常")).toHaveLength(1);
    expect(within(systemStatus).getAllByText("待配置")).toHaveLength(2);
  });

  it("labels cloud credits separately from trial credits on sync failure", async () => {
    vi.stubEnv("VITE_WEB_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    signInWithKromaForTest();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "账户" }));

    expect(screen.getByText("云端积分余额")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("已登录，云端余额暂时同步失败，请刷新后重试。")).toBeInTheDocument();
    });
    expect(screen.queryByText("试用积分余额")).not.toBeInTheDocument();
  });

  it("opens the login page and validates the demo login form", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "注册" })).toBeInTheDocument();
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
    expect(within(loginForm).getByLabelText("密码")).toBeInTheDocument();
    expect(within(loginForm).queryByLabelText("验证码")).not.toBeInTheDocument();

    await user.type(within(loginForm).getByLabelText("密码"), "secret-password");
    await user.click(within(loginForm).getByLabelText("我已阅读并同意"));
    await user.click(
      within(loginForm).getByRole("button", { name: "登录 kroma" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "已为 seller@example.com 创建当前会话",
    );

    await user.click(within(loginForm).getByRole("button", { name: "使用验证码登录" }));
    await user.click(
      within(loginForm).getByRole("button", { name: "获取验证码" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "验证码已发送至 seller@example.com",
    );

    await user.type(within(loginForm).getByLabelText("验证码"), "123456");
    await user.click(
      within(loginForm).getByRole("button", { name: "登录 kroma" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "已为 seller@example.com 创建当前会话，积分与历史任务会在此账户下保存。",
    );

    await user.click(within(loginForm).getByRole("button", { name: "隐私政策" }));
    expect(screen.getByRole("heading", { name: "隐私政策" })).toBeInTheDocument();
  });

  it("registers through Kroma and waits for real email verification", async () => {
    vi.stubEnv("VITE_WEB_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "",
            refresh_token: "",
            user_id: "",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "signup-access",
            refresh_token: "signup-refresh",
            user_id: "user-1",
          }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "登录" }));
    await user.click(screen.getByRole("button", { name: "注册" }));
    const registerForm = screen.getByRole("form", { name: "注册表单" });

    expect(screen.getByRole("heading", { name: "注册" })).toBeInTheDocument();
    await user.click(within(registerForm).getByRole("button", { name: "注册 kroma" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请输入手机号或邮箱。");

    await user.type(
      within(registerForm).getByLabelText("手机号或邮箱"),
      "new-seller@example.com",
    );
    await user.type(within(registerForm).getByLabelText("密码"), "new-password");
    await user.type(
      within(registerForm).getByLabelText("确认密码"),
      "different-password",
    );
    await user.click(within(registerForm).getByLabelText("我已阅读并同意"));
    await user.click(within(registerForm).getByRole("button", { name: "注册 kroma" }));
    expect(screen.getByRole("alert")).toHaveTextContent("两次输入的密码不一致");

    await user.clear(within(registerForm).getByLabelText("确认密码"));
    await user.type(
      within(registerForm).getByLabelText("确认密码"),
      "new-password",
    );
    await user.click(within(registerForm).getByRole("button", { name: "注册 kroma" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "验证码已发送至邮箱",
    );
    expect(within(registerForm).getByLabelText("邮箱验证码")).toBeInTheDocument();
    expect(getAccountSnapshot().session).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/auth/signup",
      expect.objectContaining({ method: "POST" }),
    );

    await user.type(within(registerForm).getByLabelText("邮箱验证码"), "12345678");
    await user.click(
      within(registerForm).getByRole("button", { name: "验证并完成注册" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "请输入 kroma 注册邮件里的 6 位数字验证码。",
    );
    await user.clear(within(registerForm).getByLabelText("邮箱验证码"));

    await user.type(within(registerForm).getByLabelText("邮箱验证码"), "123456");
    await user.click(
      within(registerForm).getByRole("button", { name: "验证并完成注册" }),
    );

    const loginForm = screen.getByRole("form", { name: "登录表单" });
    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(within(loginForm).getByLabelText("手机号或邮箱")).toHaveValue(
      "new-seller@example.com",
    );
    expect(within(loginForm).getByLabelText("密码")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent(
      "注册验证成功，邮箱已填好，请输入刚才设置的密码登录。",
    );
    expect(getAccountSnapshot().session).toBeNull();
  });

  it("moves registered Kroma emails back to password login", async () => {
    vi.stubEnv("VITE_WEB_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            detail: {
              code: "email_already_registered",
              message: "该邮箱已注册，请直接登录。",
            },
          }),
        ),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "登录" }));
    await user.click(screen.getByRole("button", { name: "注册" }));
    const registerForm = screen.getByRole("form", { name: "注册表单" });

    await user.type(
      within(registerForm).getByLabelText("手机号或邮箱"),
      "seller@example.com",
    );
    await user.type(within(registerForm).getByLabelText("密码"), "new-password");
    await user.type(
      within(registerForm).getByLabelText("确认密码"),
      "new-password",
    );
    await user.click(within(registerForm).getByLabelText("我已阅读并同意"));
    await user.click(within(registerForm).getByRole("button", { name: "注册 kroma" }));

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "该邮箱已注册，请直接输入密码登录。",
    );
    expect(screen.queryByLabelText("邮箱验证码")).not.toBeInTheDocument();
  });

  it("shows immediate feedback while a Kroma registration is being submitted", async () => {
    vi.stubEnv("VITE_WEB_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    let resolveSignup: (response: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveSignup = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { container } = render(<App />);

    const topNavButtons = container.querySelectorAll<HTMLButtonElement>(".topnav-button");
    await user.click(topNavButtons[topNavButtons.length - 1]);
    const authSwitchButtons =
      container.querySelectorAll<HTMLButtonElement>(".login-auth-switch button");
    await user.click(authSwitchButtons[1]);

    const registerForm = container.querySelector<HTMLFormElement>(".login-form");
    expect(registerForm).not.toBeNull();
    const emailInput = registerForm!.querySelector<HTMLInputElement>('input[type="text"]');
    const passwordInput = registerForm!.querySelector<HTMLInputElement>(
      'input[type="password"]',
    );
    const agreementInput = registerForm!.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    const submitButton =
      registerForm!.querySelector<HTMLButtonElement>(".login-submit");
    expect(emailInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
    expect(agreementInput).not.toBeNull();
    expect(submitButton).not.toBeNull();
    const initialButtonText = submitButton!.textContent;
    const confirmPasswordInput = Array.from(
      registerForm!.querySelectorAll<HTMLInputElement>('input[type="password"]'),
    )[1];
    expect(confirmPasswordInput).not.toBeNull();

    await user.type(emailInput!, "new-seller@example.com");
    await user.type(passwordInput!, "new-password");
    await user.type(confirmPasswordInput!, "new-password");
    await user.click(agreementInput!);
    await user.click(submitButton!);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
    expect(submitButton!.textContent).not.toBe(initialButtonText);

    resolveSignup(
      new Response(
        JSON.stringify({
          access_token: "",
          refresh_token: "",
          user_id: "user-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  });

  it("keeps the login page focused on one simple login form", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "登录" }));
    const loginForm = screen.getByRole("form", { name: "登录表单" });

    expect(within(loginForm).getByLabelText("手机号或邮箱")).toBeInTheDocument();
    expect(within(loginForm).getByLabelText("密码")).toBeInTheDocument();
    expect(within(loginForm).getByRole("button", { name: "使用验证码登录" })).toBeInTheDocument();
    expect(within(loginForm).queryByLabelText("验证码")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("店铺或团队名称")).not.toBeInTheDocument();
    expect(screen.queryByText("或使用快捷方式")).not.toBeInTheDocument();
    expect(screen.queryByText("企业账号登录")).not.toBeInTheDocument();
  });

  it("preserves workspace product and parameter edits after visiting secondary pages", async () => {
    const user = userEvent.setup();
    signInForTest();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "商品主图" }));
    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.type(screen.getByLabelText("设计简报"), "Waterproof steel bottle");

    await user.click(screen.getByRole("button", { name: "账户" }));
    expect(screen.getByRole("heading", { name: "账户与用量" })).toBeInTheDocument();
    expect(screen.queryByText("最近积分记录")).not.toBeInTheDocument();
    expect(screen.queryByText("新用户试用额度")).not.toBeInTheDocument();

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
    signInForTest();
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
    signInForTest();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "商品主图" }));
    expect(getAccountSnapshot().balance).toBe(5);

    await user.click(screen.getByRole("button", { name: "使用示例商品" }));
    await user.click(screen.getByRole("button", { name: /标准版/ }));
    await user.click(screen.getByRole("button", { name: "生成商品主图" }));
    expect(await screen.findByAltText("生成结果")).toBeInTheDocument();

    expect(getAccountSnapshot().balance).toBe(4);

    await user.type(screen.getByLabelText("设计简报"), "fail");
    await user.click(screen.getByRole("button", { name: "生成商品主图" }));
    expect(await screen.findAllByText("模拟生成失败，请重试。")).toHaveLength(1);

    expect(getAccountSnapshot().balance).toBe(4);
  });

  it("routes exhausted trial users to pricing instead of generating", async () => {
    const user = userEvent.setup();
    signInForTest();
    getAccountSnapshot();
    deductCredits(5, "试用额度耗尽");
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
      "已确认 专业包，950 积分已入账，当前余额 950 积分。",
    );

    await user.click(screen.getByRole("button", { name: "商品主图" }));

    expect(getAccountSnapshot().balance).toBe(950);
    expect(
      screen.getByRole("button", { name: "生成商品主图" }),
    ).toBeInTheDocument();
  });

  it("shows coherent history content and active nav", async () => {
    const user = userEvent.setup();
    signInForTest();
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
    ];

    expect(screen.queryByRole("button", { name: "企业采购" })).not.toBeInTheDocument();

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
