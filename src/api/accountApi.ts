import {
  deductCredits,
  getAccountSnapshot,
  initializeSession,
  recordCreditSpend,
  replaceAccountSnapshot,
} from "../storage/accountStore";
import type {
  AccountSession,
  AccountSnapshot,
  CreditTransaction,
} from "../storage/accountStore";
import {
  buildAccountSessionRequest,
  buildConsumeCreditsRequest,
  buildCurrentAccountRequest,
} from "./apiContracts";
import { requestRemoteJson, shouldUseRemoteBackend } from "./remoteBackendClient";

export interface ConsumeCreditsInput {
  amount: number;
  label: string;
}

export type AccountCreditSyncStatus =
  | "trial"
  | "cloud"
  | "cloud_sync_failed";

export interface AccountWithCreditSync {
  account: AccountSnapshot;
  creditSyncStatus: AccountCreditSyncStatus;
}

export interface WebBackendHealth {
  ok: boolean;
  service: string;
  commit: string;
  checked_at: string;
  config: Record<string, boolean>;
  missing: string[];
}

export async function getCurrentAccount(): Promise<AccountSnapshot> {
  const syncedAccount = await getCurrentAccountWithCreditSync();
  return syncedAccount.account;
}

export async function getCurrentAccountWithCreditSync(): Promise<AccountWithCreditSync> {
  const kromaAccount = await getCurrentKromaAccountWithCreditSync();

  if (kromaAccount) {
    return kromaAccount;
  }

  if (shouldUseRemoteBackend()) {
    return {
      account: await requestRemoteJson<AccountSnapshot>(buildCurrentAccountRequest()),
      creditSyncStatus: "cloud",
    };
  }

  return {
    account: getAccountSnapshot(),
    creditSyncStatus: "trial",
  };
}

export function getCurrentAccountSnapshot(): AccountSnapshot {
  return getAccountSnapshot();
}

export async function loginOrRegister(
  session: AccountSession,
): Promise<AccountSnapshot> {
  if (shouldUseKromaAuth(session)) {
    return loginOrRegisterWithKroma(session);
  }

  if (session.authView === "register" && !shouldUseRemoteBackend()) {
    throw new Error("注册需要连接真实账号服务，请先配置后端账号接口。");
  }

  const request = buildAccountSessionRequest(session);

  if (shouldUseRemoteBackend()) {
    return requestRemoteJson<AccountSnapshot>(request);
  }

  return initializeSession(request.body);
}

export async function getCreditBalance(): Promise<number> {
  return getAccountSnapshot().balance;
}

export async function getCreditTransactions(): Promise<CreditTransaction[]> {
  return getAccountSnapshot().transactions;
}

export async function consumeCredits(
  input: ConsumeCreditsInput,
): Promise<AccountSnapshot> {
  const kromaAccount = await consumeKromaCredits(input);

  if (kromaAccount) {
    return kromaAccount;
  }

  if (shouldUseRemoteBackend()) {
    return requestRemoteJson<AccountSnapshot>(buildConsumeCreditsRequest(input));
  }

  return deductCredits(input.amount, input.label);
}

interface KromaAuthResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

interface KromaOtpResponse {
  sent: boolean;
}

interface KromaCreditsResponse {
  credits: number;
  is_paid?: boolean;
  plan?: string | null;
}

interface KromaDeductCreditsResponse {
  success: boolean;
  credits_remaining: number;
}

function shouldUseKromaAuth(session: AccountSession): boolean {
  return Boolean(
    getConfiguredWebAccountApiBaseUrl() &&
      (session.mode === "password" || session.mode === "code") &&
      session.credential,
  );
}

function getConfiguredWebAccountApiBaseUrl(): string | null {
  const value = import.meta.env.VITE_WEB_API_BASE_URL?.trim();

  if (!value) {
    return null;
  }

  return value.replace(/\/+$/, "");
}

export async function requestLoginCode(identifier: string): Promise<KromaOtpResponse> {
  const baseUrl = getConfiguredWebAccountApiBaseUrl();
  const normalizedIdentifier = identifier.trim();
  const redirectTo =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : undefined;

  if (!baseUrl) {
    return { sent: true };
  }

  return requestKromaJson<KromaOtpResponse>(`${baseUrl}/auth/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: normalizedIdentifier,
      ...(redirectTo ? { redirect_to: redirectTo } : {}),
    }),
  });
}

export async function getWebBackendHealth(): Promise<WebBackendHealth | null> {
  const baseUrl = getConfiguredWebAccountApiBaseUrl();

  if (!baseUrl) {
    return null;
  }

  try {
    return await requestKromaJson<WebBackendHealth>(`${baseUrl}/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch {
    return null;
  }
}

export async function verifySignupCode(
  identifier: string,
  code: string,
): Promise<KromaAuthResponse> {
  const baseUrl = getConfiguredWebAccountApiBaseUrl();

  if (!baseUrl) {
    throw new Error("注册验证需要连接真实账号服务，请先配置后端账号接口。");
  }

  return requestKromaJson<KromaAuthResponse>(`${baseUrl}/auth/verify-signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: identifier.trim(),
      token: code.trim(),
    }),
  });
}

async function loginOrRegisterWithKroma(
  session: AccountSession,
): Promise<AccountSnapshot> {
  const baseUrl = getConfiguredWebAccountApiBaseUrl();

  if (!baseUrl || !session.credential) {
    return initializeSession(session);
  }

  const endpoint =
    session.authView === "register" && session.mode === "code"
      ? "/auth/verify-signup"
      : session.authView === "register"
        ? "/auth/signup"
      : session.mode === "code"
        ? "/auth/verify-code"
        : "/auth/login";
  const authBody =
    session.mode === "code"
      ? {
          email: session.identifier,
          token: session.credential,
        }
      : {
          email: session.identifier,
          password: session.credential,
          ...(session.authView === "register" &&
          typeof window !== "undefined" &&
          window.location?.origin
            ? { redirect_to: window.location.origin }
            : {}),
        };
const auth = await requestKromaJson<KromaAuthResponse>(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(authBody),
  });

  if (
    session.authView === "register" &&
    (!auth.access_token || !auth.refresh_token || !auth.user_id)
  ) {
    throw new Error("请查看邮箱完成账户验证，验证后再返回登录。");
  }

  const authenticatedSession: AccountSession = {
    ...session,
    provider: "kroma",
    userId: auth.user_id,
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
  };
  const current = initializeSession(authenticatedSession);
  const credits = await fetchKromaCredits(baseUrl, auth.access_token);

  if (!credits) {
    return current;
  }

  const snapshot: AccountSnapshot = {
    ...current,
    balance: credits.credits,
  };

  return initializeSessionSnapshot(snapshot);
}

async function getCurrentKromaAccountWithCreditSync(): Promise<AccountWithCreditSync | null> {
  const baseUrl = getConfiguredWebAccountApiBaseUrl();
  const current = getAccountSnapshot();
  const accessToken = current.session?.accessToken;

  if (!baseUrl || !accessToken) {
    return null;
  }

  const credits = await fetchKromaCredits(baseUrl, accessToken);

  if (!credits) {
    return {
      account: current,
      creditSyncStatus: "cloud_sync_failed",
    };
  }

  return {
    account: initializeSessionSnapshot({
      ...current,
      balance: credits.credits,
    }),
    creditSyncStatus: "cloud",
  };
}

async function fetchKromaCredits(
  baseUrl: string,
  accessToken: string,
): Promise<KromaCreditsResponse | null> {
  try {
    return await requestKromaJson<KromaCreditsResponse>(`${baseUrl}/user/credits`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Kroma-Client": "web",
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    return null;
  }
}

async function consumeKromaCredits(
  input: ConsumeCreditsInput,
): Promise<AccountSnapshot | null> {
  const baseUrl = getConfiguredWebAccountApiBaseUrl();
  const accessToken = getAccountSnapshot().session?.accessToken;
  const amount = Math.max(0, Math.floor(input.amount));

  if (!baseUrl || !accessToken || amount === 0) {
    return null;
  }

  const response = await requestKromaJson<KromaDeductCreditsResponse>(
    `${baseUrl}/user/credits/deduct?amount=${encodeURIComponent(String(amount))}&task_status=completed&charge_policy=success_only`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kroma-Client": "web",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return recordCreditSpend({
    amount,
    balanceAfter: response.credits_remaining,
    label: input.label,
  });
}

async function requestKromaJson<Payload>(
  url: string,
  init: RequestInit,
): Promise<Payload> {
  let response: globalThis.Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error("无法连接账号服务，请确认后端已启动或接口地址正确。");
  }

  if (!response.ok) {
    const text = await response.text();
    let detail = text;

    try {
      const payload = JSON.parse(text) as {
        detail?: string | { code?: string; message?: string };
        message?: string;
      };
      if (
        typeof payload.detail === "object" &&
        payload.detail?.code === "email_already_registered"
      ) {
        throw new Error(payload.detail.message ?? "该邮箱已注册，请直接登录。");
      }
      detail =
        typeof payload.detail === "string"
          ? payload.detail
          : payload.message ?? text;
    } catch (error) {
      if (error instanceof Error && error.message.includes("已注册")) {
        throw error;
      }
    }

    throw new Error(`Kroma API request failed: ${response.status} ${detail}`);
  }

  return response.json() as Promise<Payload>;
}

function initializeSessionSnapshot(snapshot: AccountSnapshot): AccountSnapshot {
  return replaceAccountSnapshot(snapshot);
}
