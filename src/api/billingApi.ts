import { addCredits } from "../storage/accountStore";
import type { AccountSnapshot } from "../storage/accountStore";
import { getAccountSnapshot } from "../storage/accountStore";
import { buildPurchasePlanRequest } from "./apiContracts";
import { requestRemoteJson, shouldUseRemoteBackend } from "./remoteBackendClient";

export type PaymentChannel = "mock" | "paddle";

export interface PurchasePlanInput {
  planId: string;
  planName: string;
  credits: number;
  paymentChannel: PaymentChannel;
  note: string;
  userId?: string;
  email?: string;
}

export interface PurchasePlanResult {
  orderId: string;
  status: "paid" | "pending";
  creditedAmount: number;
  account: AccountSnapshot;
}

type PaddleCheckoutOpenInput = {
  items: Array<{ priceId: string; quantity: number }>;
  customData: Record<string, string | number>;
  customer?: { email: string };
  settings?: {
    successUrl?: string;
  };
};

type PaddleApi = {
  Environment?: {
    set: (environment: string) => void;
  };
  Initialize: (options: { token: string }) => void;
  Checkout: {
    open: (options: PaddleCheckoutOpenInput) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleApi;
  }
}

const paddleScriptUrl = "https://cdn.paddle.com/paddle/v2/paddle.js";
let paddleScriptPromise: Promise<PaddleApi> | null = null;
let initializedPaddleToken = "";

export function isPaddleCheckoutConfigured(): boolean {
  return Boolean(import.meta.env.VITE_PADDLE_CLIENT_TOKEN?.trim());
}

export function getMissingPaddleCheckoutConfig(planId: string): string[] {
  const missing: string[] = [];

  if (!import.meta.env.VITE_PADDLE_CLIENT_TOKEN?.trim()) {
    missing.push("VITE_PADDLE_CLIENT_TOKEN");
  }

  if (!getPaddlePriceId(planId)) {
    missing.push(getPaddlePriceEnvName(planId));
  }

  return missing;
}

export async function purchasePlan(
  input: PurchasePlanInput,
): Promise<PurchasePlanResult> {
  const request = buildPurchasePlanRequest(input);

  if (input.paymentChannel === "paddle") {
    await openPaddleCheckout(input);

    return {
      orderId: `paddle-checkout-${input.planId}`,
      status: "pending",
      creditedAmount: 0,
      account: getAccountSnapshot(),
    };
  }

  if (shouldUseRemoteBackend()) {
    return requestRemoteJson<PurchasePlanResult>(request);
  }

  if (import.meta.env.PROD) {
    throw new Error("支付通道未配置，请稍后再试或联系支持。");
  }

  const creditedAmount = Math.max(0, Math.floor(request.body.credits));
  const account = addCredits({
    amount: creditedAmount,
    planId: request.body.planId,
    planName: request.body.planName,
    note: request.body.note,
  });

  return {
    orderId: `mock-order-${request.body.paymentChannel}-${Date.now()}`,
    status: "paid",
    creditedAmount,
    account,
  };
}

async function openPaddleCheckout(input: PurchasePlanInput): Promise<void> {
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN?.trim();
  const priceId = getPaddlePriceId(input.planId);

  if (!token) {
    throw new Error("Paddle client token is not configured.");
  }

  if (!priceId) {
    throw new Error(`Paddle price ID is not configured for ${input.planId}.`);
  }

  const paddle = await loadPaddle(token);
  const checkoutInput: PaddleCheckoutOpenInput = {
    items: [{ priceId, quantity: 1 }],
    customData: {
      user_id: input.userId ?? "guest",
      plan_id: input.planId,
      plan_name: input.planName,
      credits: Math.max(0, Math.floor(input.credits)),
    },
    settings: {
      successUrl: `${window.location.origin}/?payment=paddle-success`,
    },
  };

  if (input.email) {
    checkoutInput.customer = { email: input.email };
  }

  paddle.Checkout.open(checkoutInput);
}

function getPaddlePriceId(planId: string): string | undefined {
  const paddlePriceEnvByPlanId: Record<string, string | undefined> = {
    "basic-top-up": import.meta.env.VITE_PADDLE_PRICE_BASIC_TOP_UP,
    "standard-top-up": import.meta.env.VITE_PADDLE_PRICE_STANDARD_TOP_UP,
    "pro-top-up": import.meta.env.VITE_PADDLE_PRICE_PRO_TOP_UP,
    "monthly-subscription": import.meta.env.VITE_PADDLE_PRICE_MONTHLY_SUBSCRIPTION,
    "quarterly-subscription": import.meta.env.VITE_PADDLE_PRICE_QUARTERLY_SUBSCRIPTION,
    "yearly-subscription": import.meta.env.VITE_PADDLE_PRICE_YEARLY_SUBSCRIPTION,
  };

  return paddlePriceEnvByPlanId[planId]?.trim();
}

function getPaddlePriceEnvName(planId: string): string {
  const paddlePriceEnvNameByPlanId: Record<string, string> = {
    "basic-top-up": "VITE_PADDLE_PRICE_BASIC_TOP_UP",
    "standard-top-up": "VITE_PADDLE_PRICE_STANDARD_TOP_UP",
    "pro-top-up": "VITE_PADDLE_PRICE_PRO_TOP_UP",
    "monthly-subscription": "VITE_PADDLE_PRICE_MONTHLY_SUBSCRIPTION",
    "quarterly-subscription": "VITE_PADDLE_PRICE_QUARTERLY_SUBSCRIPTION",
    "yearly-subscription": "VITE_PADDLE_PRICE_YEARLY_SUBSCRIPTION",
  };

  return paddlePriceEnvNameByPlanId[planId] ?? `Paddle price ID for ${planId}`;
}

async function loadPaddle(token: string): Promise<PaddleApi> {
  if (window.Paddle) {
    initializePaddle(window.Paddle, token);
    return window.Paddle;
  }

  if (!paddleScriptPromise) {
    paddleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = paddleScriptUrl;
      script.async = true;
      script.onload = () => {
        if (window.Paddle) {
          resolve(window.Paddle);
          return;
        }

        reject(new Error("Paddle.js loaded without exposing Paddle."));
      };
      script.onerror = () => reject(new Error("Failed to load Paddle.js."));
      document.head.appendChild(script);
    });
  }

  const paddle = await paddleScriptPromise;
  initializePaddle(paddle, token);
  return paddle;
}

function initializePaddle(paddle: PaddleApi, token: string): void {
  if (initializedPaddleToken === token) {
    return;
  }

  const environment = import.meta.env.VITE_PADDLE_ENVIRONMENT?.trim();

  if (environment === "sandbox") {
    paddle.Environment?.set("sandbox");
  }

  paddle.Initialize({ token });
  initializedPaddleToken = token;
}
