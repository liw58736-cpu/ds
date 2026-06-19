import { beforeEach, describe, expect, it } from "vitest";
import {
  addCredits,
  deductCredits,
  getAccountSnapshot,
  initializeSession,
} from "./accountStore";

beforeEach(() => {
  localStorage.clear();
});

describe("accountStore", () => {
  it("creates a guest account with four trial credits", () => {
    expect(getAccountSnapshot()).toMatchObject({
      balance: 4,
      session: null,
    });
    expect(getAccountSnapshot().transactions[0]).toMatchObject({
      amount: 4,
      type: "trial_grant",
    });
  });

  it("stores login session details and keeps the trial balance", () => {
    initializeSession({
      identifier: "seller@example.com",
      authView: "login",
      mode: "code",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-06-17T00:00:00.000Z",
    });

    expect(getAccountSnapshot()).toMatchObject({
      balance: 4,
      session: {
        identifier: "seller@example.com",
        authView: "login",
      },
    });
  });

  it("stores remote auth tokens without exposing them in account copy", () => {
    initializeSession({
      identifier: "seller@example.com",
      authView: "login",
      mode: "password",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-06-17T00:00:00.000Z",
      provider: "kroma",
      userId: "user-1",
      accessToken: "access-token-1",
      refreshToken: "refresh-token-1",
    });

    expect(getAccountSnapshot().session).toMatchObject({
      identifier: "seller@example.com",
      provider: "kroma",
      userId: "user-1",
    });
    expect(getAccountSnapshot().session?.accessToken).toBe("access-token-1");
  });

  it("adds purchased credits and records the selected plan", () => {
    const snapshot = addCredits({
      amount: 10500,
      planId: "pro-top-up",
      planName: "专业包",
      note: "支付通道待接入支付宝 / 微信",
    });

    expect(snapshot.balance).toBe(10504);
    expect(snapshot.transactions[0]).toMatchObject({
      amount: 10500,
      planName: "专业包",
      type: "purchase",
    });
  });

  it("deducts credits only when the balance is sufficient", () => {
    expect(deductCredits(1, "生成商品主图").balance).toBe(3);
    expect(deductCredits(10, "超额生成").balance).toBe(3);
    expect(getAccountSnapshot().transactions[0]).toMatchObject({
      amount: -1,
      type: "generation",
    });
  });
});
