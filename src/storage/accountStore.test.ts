import { beforeEach, describe, expect, it } from "vitest";
import {
  addCredits,
  clearAccountSession,
  deductCredits,
  getAccountSnapshot,
  initializeSession,
} from "./accountStore";

beforeEach(() => {
  localStorage.clear();
});

describe("accountStore", () => {
  it("creates a guest account with five trial credits", () => {
    expect(getAccountSnapshot()).toMatchObject({
      balance: 5,
      session: null,
    });
    expect(getAccountSnapshot().transactions[0]).toMatchObject({
      amount: 5,
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
      balance: 5,
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

  it("clears the current login session without removing credits", () => {
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

    const snapshot = clearAccountSession();

    expect(snapshot).toMatchObject({
      balance: 5,
      session: null,
    });
    expect(getAccountSnapshot().session).toBeNull();
  });

  it("adds purchased credits and records the selected plan", () => {
    const snapshot = addCredits({
      amount: 950,
      planId: "pro-top-up",
      planName: "专业包",
      note: "开发环境 mock 支付",
    });

    expect(snapshot.balance).toBe(955);
    expect(snapshot.transactions[0]).toMatchObject({
      amount: 950,
      planName: "专业包",
      type: "purchase",
    });
  });

  it("deducts credits only when the balance is sufficient", () => {
    expect(deductCredits(1, "生成商品主图").balance).toBe(4);
    expect(deductCredits(10, "超额生成").balance).toBe(4);
    expect(getAccountSnapshot().transactions[0]).toMatchObject({
      amount: -1,
      type: "generation",
    });
  });
});
