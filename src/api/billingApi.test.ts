import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentAccount } from "./accountApi";
import { getMissingPaddleCheckoutConfig, purchasePlan } from "./billingApi";
import { getAccountSnapshot } from "../storage/accountStore";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("billingApi", () => {
  it("reports missing Paddle checkout configuration for a selected plan", () => {
    expect(getMissingPaddleCheckoutConfig("pro-top-up")).toEqual([
      "VITE_PADDLE_CLIENT_TOKEN",
      "VITE_PADDLE_PRICE_PRO_TOP_UP",
    ]);

    vi.stubEnv("VITE_PADDLE_CLIENT_TOKEN", "test-client-token");

    expect(getMissingPaddleCheckoutConfig("pro-top-up")).toEqual([
      "VITE_PADDLE_PRICE_PRO_TOP_UP",
    ]);
  });

  it("creates a paid mock checkout and credits the selected plan", async () => {
    const result = await purchasePlan({
      planId: "pro-top-up",
      planName: "专业包",
      credits: 950,
      paymentChannel: "mock",
      note: "开发环境 mock 支付。",
    });

    expect(result).toMatchObject({
      status: "paid",
      creditedAmount: 950,
    });
    expect(result.orderId).toMatch(/^mock-order-/);
    expect(result.account.balance).toBe(955);

    const account = await getCurrentAccount();
    expect(account.transactions[0]).toMatchObject({
      amount: 950,
      planId: "pro-top-up",
      planName: "专业包",
      type: "purchase",
    });
  });

  it("uses the remote checkout endpoint when VITE_API_BASE_URL is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const remoteResult = {
      orderId: "remote-order-1",
      status: "paid",
      creditedAmount: 950,
      account: {
        session: null,
        balance: 10504,
        transactions: [],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(remoteResult),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await purchasePlan({
      planId: "pro-top-up",
      planName: "专业包",
      credits: 950,
      paymentChannel: "mock",
      note: "开发环境 mock 支付。",
    });

    expect(result).toEqual(remoteResult);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/billing/checkouts",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not create mock credits in production when payment is not configured", async () => {
    vi.stubEnv("PROD", true);

    await expect(
      purchasePlan({
        planId: "pro-top-up",
        planName: "专业包",
        credits: 950,
        paymentChannel: "mock",
        note: "订单已确认，积分已入账。",
      }),
    ).rejects.toThrow("支付通道未配置");

    expect(getAccountSnapshot().balance).toBe(5);
  });

  it("opens Paddle checkout when Paddle is configured", async () => {
    vi.stubEnv("VITE_PADDLE_CLIENT_TOKEN", "test-client-token");
    vi.stubEnv("VITE_PADDLE_PRICE_BASIC_TOP_UP", "pri_basic");

    const appendChild = vi.spyOn(document.head, "appendChild");
    const checkoutOpen = vi.fn();
    vi.stubGlobal("Paddle", {
      Initialize: vi.fn(),
      Checkout: { open: checkoutOpen },
    });

    const result = await purchasePlan({
      planId: "basic-top-up",
      planName: "基础包",
      credits: 120,
      paymentChannel: "paddle",
      note: "Paddle checkout",
      userId: "user-1",
      email: "seller@example.com",
    });

    expect(result).toMatchObject({
      orderId: "paddle-checkout-basic-top-up",
      status: "pending",
      creditedAmount: 0,
    });
    expect(checkoutOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ priceId: "pri_basic", quantity: 1 }],
        customer: { email: "seller@example.com" },
        customData: expect.objectContaining({
          user_id: "user-1",
          plan_id: "basic-top-up",
          credits: 120,
        }),
      }),
    );
    expect(getAccountSnapshot().balance).toBe(5);
    expect(appendChild).not.toHaveBeenCalled();
  });
});
