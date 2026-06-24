export type AuthView = "login" | "register";
export type LoginMode = "code" | "password";
export type CreditTransactionType = "trial_grant" | "purchase" | "generation";

export interface AccountSession {
  identifier: string;
  authView: AuthView;
  mode: LoginMode;
  storeName: string;
  inviteCode: string;
  createdAt: string;
  credential?: string;
  provider?: "local" | "kroma";
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface CreditTransaction {
  id: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  label: string;
  note: string;
  planId?: string;
  planName?: string;
  createdAt: string;
}

export interface AccountSnapshot {
  session: AccountSession | null;
  balance: number;
  transactions: CreditTransaction[];
}

export interface AddCreditsInput {
  amount: number;
  planId: string;
  planName: string;
  note: string;
}

export interface RecordCreditSpendInput {
  amount: number;
  balanceAfter: number;
  label: string;
  note?: string;
}

const ACCOUNT_STORAGE_KEY = "commerce-studio-account-v1";
const SESSION_STORAGE_KEY = "commerce-studio-session-v1";
const TRIAL_CREDITS = 5;
export const ACCOUNT_CHANGED_EVENT = "kroma-account-changed";

function createTransactionId(type: CreditTransactionType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createTrialAccount(): AccountSnapshot {
  const createdAt = new Date().toISOString();

  return {
    session: null,
    balance: TRIAL_CREDITS,
    transactions: [
      {
        id: createTransactionId("trial_grant"),
        type: "trial_grant",
        amount: TRIAL_CREDITS,
        balanceAfter: TRIAL_CREDITS,
        label: "新用户试用额度",
        note: "新用户可体验前 4 个模块。",
        createdAt,
      },
    ],
  };
}

function parseSession(value: unknown): AccountSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const session = value as Partial<AccountSession>;

  if (
    typeof session.identifier !== "string" ||
    (session.authView !== "login" && session.authView !== "register") ||
    (session.mode !== "code" && session.mode !== "password") ||
    typeof session.createdAt !== "string"
  ) {
    return null;
  }

  return sanitizeSession({
    identifier: session.identifier,
    authView: session.authView,
    mode: session.mode,
    storeName: typeof session.storeName === "string" ? session.storeName : "",
    inviteCode: typeof session.inviteCode === "string" ? session.inviteCode : "",
    createdAt: session.createdAt,
    provider:
      session.provider === "kroma" || session.provider === "local"
        ? session.provider
        : undefined,
    userId: optionalString(session.userId),
    accessToken: optionalString(session.accessToken),
    refreshToken: optionalString(session.refreshToken),
  });
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function sanitizeSession(session: AccountSession): AccountSession {
  const { credential: _credential, ...safeSession } = session;

  return safeSession;
}

function parseStoredAccount(value: string | null): AccountSnapshot | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AccountSnapshot>;

    if (
      typeof parsed.balance !== "number" ||
      !Array.isArray(parsed.transactions)
    ) {
      return null;
    }

    return {
      session: parseSession(parsed.session),
      balance: parsed.balance,
      transactions: parsed.transactions.filter(
        (transaction): transaction is CreditTransaction =>
          Boolean(transaction) &&
          typeof transaction === "object" &&
          typeof (transaction as CreditTransaction).id === "string" &&
          typeof (transaction as CreditTransaction).amount === "number" &&
          typeof (transaction as CreditTransaction).balanceAfter === "number" &&
          typeof (transaction as CreditTransaction).label === "string" &&
          typeof (transaction as CreditTransaction).note === "string" &&
          typeof (transaction as CreditTransaction).createdAt === "string",
      ),
    };
  } catch {
    return null;
  }
}

function saveAccountSnapshot(snapshot: AccountSnapshot): void {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(snapshot));
  if (snapshot.session) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot.session));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

function emitAccountChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ACCOUNT_CHANGED_EVENT));
  }
}

export function getAccountSnapshot(): AccountSnapshot {
  const storedAccount = parseStoredAccount(
    localStorage.getItem(ACCOUNT_STORAGE_KEY),
  );

  if (storedAccount) {
    return storedAccount;
  }

  const snapshot = createTrialAccount();
  saveAccountSnapshot(snapshot);
  return snapshot;
}

export function initializeSession(session: AccountSession): AccountSnapshot {
  const current = getAccountSnapshot();
  const snapshot = {
    ...current,
    session: sanitizeSession(session),
  };

  saveAccountSnapshot(snapshot);
  emitAccountChanged();
  return snapshot;
}

export function replaceAccountSnapshot(snapshot: AccountSnapshot): AccountSnapshot {
  const safeSnapshot: AccountSnapshot = {
    ...snapshot,
    session: snapshot.session ? sanitizeSession(snapshot.session) : null,
  };

  saveAccountSnapshot(safeSnapshot);
  emitAccountChanged();
  return safeSnapshot;
}

export function getAccountAccessToken(): string | null {
  return getAccountSnapshot().session?.accessToken ?? null;
}

export function clearAccountSession(): AccountSnapshot {
  const current = getAccountSnapshot();
  const snapshot = {
    ...current,
    session: null,
  };

  saveAccountSnapshot(snapshot);
  emitAccountChanged();
  return snapshot;
}

export function addCredits(input: AddCreditsInput): AccountSnapshot {
  const current = getAccountSnapshot();
  const amount = Math.max(0, Math.floor(input.amount));
  const balance = current.balance + amount;
  const transaction: CreditTransaction = {
    id: createTransactionId("purchase"),
    type: "purchase",
    amount,
    balanceAfter: balance,
    label: `购买 ${input.planName}`,
    note: input.note,
    planId: input.planId,
    planName: input.planName,
    createdAt: new Date().toISOString(),
  };
  const snapshot = {
    ...current,
    balance,
    transactions: [transaction, ...current.transactions],
  };

  saveAccountSnapshot(snapshot);
  return snapshot;
}

export function deductCredits(amount: number, label: string): AccountSnapshot {
  const current = getAccountSnapshot();
  const normalizedAmount = Math.max(0, Math.floor(amount));

  if (normalizedAmount === 0 || current.balance < normalizedAmount) {
    return current;
  }

  const balance = current.balance - normalizedAmount;
  const transaction: CreditTransaction = {
    id: createTransactionId("generation"),
    type: "generation",
    amount: -normalizedAmount,
    balanceAfter: balance,
    label,
    note: "生成成功后扣点，失败任务不扣点。",
    createdAt: new Date().toISOString(),
  };
  const snapshot = {
    ...current,
    balance,
    transactions: [transaction, ...current.transactions],
  };

  saveAccountSnapshot(snapshot);
  return snapshot;
}

export function recordCreditSpend(
  input: RecordCreditSpendInput,
): AccountSnapshot {
  const current = getAccountSnapshot();
  const amount = Math.max(0, Math.floor(input.amount));
  const balanceAfter = Math.max(0, Math.floor(input.balanceAfter));

  if (amount === 0) {
    return current;
  }

  const transaction: CreditTransaction = {
    id: createTransactionId("generation"),
    type: "generation",
    amount: -amount,
    balanceAfter,
    label: input.label,
    note: input.note ?? "生成成功后由云端扣点，失败任务不扣点。",
    createdAt: new Date().toISOString(),
  };
  const snapshot = {
    ...current,
    balance: balanceAfter,
    transactions: [transaction, ...current.transactions],
  };

  saveAccountSnapshot(snapshot);
  return snapshot;
}
