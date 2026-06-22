import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeCredits,
  getCreditBalance,
  getCreditTransactions,
  getCurrentAccountSnapshot,
  getCurrentAccount,
  loginOrRegister,
  requestLoginCode,
} from "./accountApi";
import type { AccountSession, AccountSnapshot } from "../storage/accountStore";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("accountApi", () => {
  it("returns the current account snapshot through an async API boundary", async () => {
    const account = await getCurrentAccount();

    expect(account.balance).toBe(5);
    expect(account.session).toBeNull();
    expect(await getCreditBalance()).toBe(5);
    expect(await getCreditTransactions()).toHaveLength(1);
  });

  it("exposes the local mock account snapshot for first paint hydration", () => {
    expect(getCurrentAccountSnapshot()).toMatchObject({
      balance: 5,
      session: null,
    });
  });

  it("stores login session details and keeps the current balance", async () => {
    const account = await loginOrRegister({
      identifier: "seller@example.com",
      authView: "login",
      mode: "code",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-06-17T00:00:00.000Z",
    });

    expect(account.balance).toBe(5);
    expect(account.session).toMatchObject({
      identifier: "seller@example.com",
      authView: "login",
    });
  });

  it("logs in through the Kroma auth backend and hydrates remote credits", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "access-token-1",
            refresh_token: "refresh-token-1",
            user_id: "user-1",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            credits: 12,
            plan: "free",
            is_paid: false,
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const account = await loginOrRegister({
      identifier: "seller@example.com",
      authView: "login",
      mode: "password",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-06-17T00:00:00.000Z",
      credential: "secret-password",
    });

    expect(account.balance).toBe(12);
    expect(account.session).toMatchObject({
      identifier: "seller@example.com",
      provider: "kroma",
      userId: "user-1",
      accessToken: "access-token-1",
      refreshToken: "refresh-token-1",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8000/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "seller@example.com",
          password: "secret-password",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8000/api/v1/user/credits",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-1",
        }),
      }),
    );
  });

  it("requests a real Kroma email verification code", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sent: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestLoginCode("seller@example.com")).resolves.toEqual({
      sent: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/auth/otp",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "seller@example.com",
        }),
      }),
    );
  });

  it("verifies a Kroma email code and hydrates remote credits", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "code-access-token",
            refresh_token: "code-refresh-token",
            user_id: "user-code",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            credits: 18,
            plan: "free",
            is_paid: false,
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const account = await loginOrRegister({
      identifier: "seller@example.com",
      authView: "login",
      mode: "code",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-06-17T00:00:00.000Z",
      credential: "123456",
    });

    expect(account.balance).toBe(18);
    expect(account.session).toMatchObject({
      identifier: "seller@example.com",
      provider: "kroma",
      userId: "user-code",
      accessToken: "code-access-token",
      refreshToken: "code-refresh-token",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8000/api/v1/auth/verify-code",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "seller@example.com",
          token: "123456",
        }),
      }),
    );
  });

  it("requires a real backend for new account registration", async () => {
    await expect(
      loginOrRegister({
        identifier: "new-seller@example.com",
        authView: "register",
        mode: "password",
        storeName: "",
        inviteCode: "",
        createdAt: "2026-06-17T00:00:00.000Z",
        credential: "new-password",
      }),
    ).rejects.toThrow("注册需要连接真实账号服务");

    expect(getCurrentAccountSnapshot().session).toBeNull();
  });

  it("treats Kroma signup without tokens as pending email verification", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "",
          refresh_token: "",
          user_id: "user-1",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loginOrRegister({
        identifier: "new-seller@example.com",
        authView: "register",
        mode: "password",
        storeName: "",
        inviteCode: "",
        createdAt: "2026-06-17T00:00:00.000Z",
        credential: "new-password",
      }),
    ).rejects.toThrow("请查看邮箱完成账户验证");

    expect(getCurrentAccountSnapshot().session).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/auth/signup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "new-seller@example.com",
          password: "new-password",
        }),
      }),
    );
  });

  it("reports unavailable Kroma auth service with a clear message", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loginOrRegister({
        identifier: "new-seller@example.com",
        authView: "register",
        mode: "password",
        storeName: "",
        inviteCode: "",
        createdAt: "2026-06-17T00:00:00.000Z",
        credential: "new-password",
      }),
    ).rejects.toThrow("无法连接账号服务");

    expect(getCurrentAccountSnapshot().session).toBeNull();
  });

  it("uses the remote account session endpoint when VITE_API_BASE_URL is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const remoteSession: AccountSession = {
      identifier: "seller@example.com",
      authView: "login",
      mode: "code",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-06-17T00:00:00.000Z",
    };
    const remoteAccount: AccountSnapshot = {
      balance: 99,
      session: remoteSession,
      transactions: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(remoteAccount),
    });
    vi.stubGlobal("fetch", fetchMock);

    const account = await loginOrRegister(remoteSession);

    expect(account).toEqual(remoteAccount);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/account/session",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("uses remote account reads and credit consumption when VITE_API_BASE_URL is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const remoteAccount = {
      balance: 8,
      session: null,
      transactions: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(remoteAccount),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentAccount()).resolves.toEqual(remoteAccount);
    await expect(
      consumeCredits({ amount: 1, label: "生成商品素材" }),
    ).resolves.toEqual(remoteAccount);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.com/api/account/current?accountId=guest",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.example.com/api/account/credits/consume",
    );
  });

  it("deducts Kroma credits on the authenticated backend and stores the returned balance", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    const session: AccountSession = {
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
    };
    localStorage.setItem(
      "commerce-studio-account-v1",
      JSON.stringify({
        balance: 12,
        session,
        transactions: [],
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          credits_remaining: 10,
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const account = await consumeCredits({
      amount: 2,
      label: "生成商品素材",
    });

    expect(account.balance).toBe(10);
    expect(account.transactions[0]).toMatchObject({
      amount: -2,
      balanceAfter: 10,
      label: "生成商品素材",
      type: "generation",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/user/credits/deduct?amount=2&task_status=completed&charge_policy=success_only",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-1",
        }),
      }),
    );
  });

  it("consumes credits only through the success-only account API", async () => {
    const account = await consumeCredits({
      amount: 1,
      label: "生成商品素材",
    });

    expect(account.balance).toBe(4);
    expect(account.transactions[0]).toMatchObject({
      amount: -1,
      type: "generation",
      label: "生成商品素材",
    });
  });
});
