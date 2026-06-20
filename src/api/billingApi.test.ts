import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentAccount } from "./accountApi";
import { purchasePlan } from "./billingApi";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("billingApi", () => {
  it("creates a paid mock checkout and credits the selected plan", async () => {
    const result = await purchasePlan({
      planId: "pro-top-up",
      planName: "专业包",
      credits: 10500,
      paymentChannel: "mock",
      note: "支付通道待接入支付宝 / 微信。",
    });

    expect(result).toMatchObject({
      status: "paid",
      creditedAmount: 10500,
    });
    expect(result.orderId).toMatch(/^mock-order-/);
    expect(result.account.balance).toBe(10505);

    const account = await getCurrentAccount();
    expect(account.transactions[0]).toMatchObject({
      amount: 10500,
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
      creditedAmount: 10500,
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
      credits: 10500,
      paymentChannel: "mock",
      note: "支付通道待接入支付宝 / 微信。",
    });

    expect(result).toEqual(remoteResult);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/billing/checkouts",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
