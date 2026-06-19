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
import { getConfiguredKromaApiBaseUrl } from "./kromaGenerationAdapter";
import { requestRemoteJson, shouldUseRemoteBackend } from "./remoteBackendClient";

export interface ConsumeCreditsInput {
  amount: number;
  label: string;
}

export async function getCurrentAccount(): Promise<AccountSnapshot> {
  const kromaAccount = await getCurrentKromaAccount();

  if (kromaAccount) {
    return kromaAccount;
  }

  if (shouldUseRemoteBackend()) {
    return requestRemoteJson<AccountSnapshot>(buildCurrentAccountRequest());
  }

  return getAccountSnapshot();
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
    getConfiguredKromaApiBaseUrl() &&
      session.mode === "password" &&
      session.credential,
  );
}

async function loginOrRegisterWithKroma(
  session: AccountSession,
): Promise<AccountSnapshot> {
  const baseUrl = getConfiguredKromaApiBaseUrl();

  if (!baseUrl || !session.credential) {
    return initializeSession(session);
  }

  const endpoint = session.authView === "register" ? "/auth/signup" : "/auth/login";
  const auth = await requestKromaJson<KromaAuthResponse>(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: session.identifier,
      password: session.credential,
    }),
  });
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

async function getCurrentKromaAccount(): Promise<AccountSnapshot | null> {
  const baseUrl = getConfiguredKromaApiBaseUrl();
  const current = getAccountSnapshot();
  const accessToken = current.session?.accessToken;

  if (!baseUrl || !accessToken) {
    return null;
  }

  const credits = await fetchKromaCredits(baseUrl, accessToken);

  if (!credits) {
    return current;
  }

  return initializeSessionSnapshot({
    ...current,
    balance: credits.credits,
  });
}

async function fetchKromaCredits(
  baseUrl: string,
  accessToken: string,
): Promise<KromaCreditsResponse | null> {
  return requestKromaJson<KromaCreditsResponse>(`${baseUrl}/user/credits`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function consumeKromaCredits(
  input: ConsumeCreditsInput,
): Promise<AccountSnapshot | null> {
  const baseUrl = getConfiguredKromaApiBaseUrl();
  const accessToken = getAccountSnapshot().session?.accessToken;
  const amount = Math.max(0, Math.floor(input.amount));

  if (!baseUrl || !accessToken || amount === 0) {
    return null;
  }

  const response = await requestKromaJson<KromaDeductCreditsResponse>(
    `${baseUrl}/user/credits/deduct?amount=${encodeURIComponent(String(amount))}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

async function requestKromaJson<Response>(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const text = await response.text();

    throw new Error(`Kroma API request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<Response>;
}

function initializeSessionSnapshot(snapshot: AccountSnapshot): AccountSnapshot {
  return replaceAccountSnapshot(snapshot);
}
