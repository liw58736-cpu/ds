import type { AccountSession } from "../storage/accountStore";
import { buildGenerationPrompt } from "../domain/promptBuilder";
import type { BuiltGenerationPrompt } from "../domain/promptBuilder";
import { selectGenerationRoute } from "../domain/generationRoutes";
import type { GenerationRoute } from "../domain/generationRoutes";
import { estimateGenerationCredits } from "../domain/creditCost";
import type {
  GenerationConfig,
  GenerationResolution,
  ProductInput,
} from "../domain/types";
import type { GenerateInput } from "../providers/generationProvider";
import type { PurchasePlanInput } from "./billingApi";
import type { ConsumeCreditsInput } from "./accountApi";

export type ApiMethod = "GET" | "POST";

export type GenerationRouteMode = "template" | "standard" | "edit_tool" | "hd";

export interface ApiRequest<Body> {
  endpoint: string;
  method: ApiMethod;
  body: Body;
}

export interface ApiReadRequest {
  endpoint: string;
  method: "GET";
}

export interface GenerationAccountContext {
  accountId: string;
  creditBalance: number;
}

export interface GenerationTaskRequestBody {
  product: ProductInput;
  config: GenerationConfig & { resolution: GenerationResolution };
  routeMode: GenerationRouteMode;
  route: GenerationRoute;
  prompt: BuiltGenerationPrompt;
  billing: {
    estimatedCreditCost: number;
    chargePolicy: "success_only";
    creditBalanceBefore?: number;
  };
  client: {
    source: "commerce-studio-web";
    contractVersion: "2026-06-17";
  };
}

export type GenerationTaskCreateRequest =
  ApiRequest<GenerationTaskRequestBody>;

export interface PurchasePlanRequestBody extends PurchasePlanInput {
  currency: "CNY";
}

export type PurchasePlanRequest = ApiRequest<PurchasePlanRequestBody>;

export type AccountSessionRequest = ApiRequest<AccountSession>;

export interface ConsumeCreditsRequestBody extends ConsumeCreditsInput {
  chargePolicy: "success_only";
}

export type ConsumeCreditsRequest = ApiRequest<ConsumeCreditsRequestBody>;

export function buildGenerationTaskRequest(
  input: GenerateInput & { account?: GenerationAccountContext },
): GenerationTaskCreateRequest {
  const config = normalizeGenerationConfig(input.config);
  const route = selectGenerationRoute(config);

  return {
    endpoint: "/api/generation/tasks",
    method: "POST",
    body: {
      product: input.product,
      config,
      routeMode: getRouteMode(config, route),
      route,
      prompt: buildGenerationPrompt(config),
      billing: {
        estimatedCreditCost: estimateGenerationCredits(config),
        chargePolicy: "success_only",
        ...(input.account
          ? { creditBalanceBefore: input.account.creditBalance }
          : {}),
      },
      client: {
        source: "commerce-studio-web",
        contractVersion: "2026-06-17",
      },
    },
  };
}

export function buildPurchasePlanRequest(
  input: PurchasePlanInput,
): PurchasePlanRequest {
  return {
    endpoint: "/api/billing/checkouts",
    method: "POST",
    body: {
      ...input,
      currency: "CNY",
    },
  };
}

export function buildAccountSessionRequest(
  input: AccountSession,
): AccountSessionRequest {
  return {
    endpoint: "/api/account/session",
    method: "POST",
    body: input,
  };
}

export function buildTaskListRequest(accountId = "guest"): ApiReadRequest {
  return {
    endpoint: `/api/generation/tasks?accountId=${encodeURIComponent(accountId)}`,
    method: "GET",
  };
}

export function buildCurrentAccountRequest(accountId = "guest"): ApiReadRequest {
  return {
    endpoint: `/api/account/current?accountId=${encodeURIComponent(accountId)}`,
    method: "GET",
  };
}

export function buildConsumeCreditsRequest(
  input: ConsumeCreditsInput,
): ConsumeCreditsRequest {
  return {
    endpoint: "/api/account/credits/consume",
    method: "POST",
    body: {
      ...input,
      chargePolicy: "success_only",
    },
  };
}

function normalizeGenerationConfig(
  config: GenerationConfig,
): GenerationConfig & { resolution: GenerationResolution } {
  return {
    ...config,
    resolution: config.resolution ?? "1K",
  };
}

function getRouteMode(
  config: GenerationConfig & { resolution: GenerationResolution },
  route: GenerationRoute,
): GenerationRouteMode {
  if (route.quality !== "standard") {
    return "hd";
  }

  if (config.module === "detail_page") {
    return "template";
  }

  return "standard";
}
