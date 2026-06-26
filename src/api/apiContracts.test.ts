import { describe, expect, it } from "vitest";
import {
  buildAccountSessionRequest,
  buildConsumeCreditsRequest,
  buildCurrentAccountRequest,
  buildGenerationTaskRequest,
  buildPurchasePlanRequest,
  buildTaskListRequest,
} from "./apiContracts";
import type { GenerateInput } from "../providers/generationProvider";

const input: GenerateInput = {
  product: {
    id: "product-1",
    imageUrl: "/sample/product.png",
    fileName: "product.png",
    createdAt: "2026-06-17T00:00:00.000Z",
    source: "sample",
  },
  config: {
    module: "main_image",
    platform: "shopify",
    aspectRatio: "1:1",
    style: "premium",
    outputFormat: "png",
    sellingPoints: "Premium launch key visual",
    specifications: "Limited campaign",
    selectedMainModules: ["hero_kv"],
  },
};

describe("apiContracts", () => {
  it("builds a backend-ready standard generation task request with default 1K route", () => {
    const request = buildGenerationTaskRequest({
      ...input,
      account: {
        accountId: "guest",
        creditBalance: 4,
      },
    });

    expect(request).toMatchObject({
      endpoint: "/api/generation/tasks",
      method: "POST",
      body: {
        product: input.product,
        config: {
          ...input.config,
          resolution: "1K",
        },
        routeMode: "standard",
        route: {
          quality: "standard",
          fallbackStrategy: "sequential",
          providers: [
            { provider: "rightcode", tier: "standard" },
            { provider: "wuyinkeji", tier: "standard" },
            { provider: "packyapi", tier: "standard" },
            { provider: "gptsapi", tier: "standard" },
          ],
        },
        billing: {
          estimatedCreditCost: 1,
          chargePolicy: "success_only",
          creditBalanceBefore: 4,
        },
      },
    });
    expect(request.body.prompt.finalPrompt).toContain(
      "premium overseas ecommerce image generation",
    );
  });

  it("routes AI tool 1K jobs through the standard provider chain", () => {
    const request = buildGenerationTaskRequest({
      ...input,
      config: {
        ...input.config,
        module: "white_background",
        resolution: "1K",
      },
    });

    expect(request.body.routeMode).toBe("standard");
    expect(request.body.route.providers).toEqual([
      { provider: "rightcode", tier: "standard" },
      { provider: "wuyinkeji", tier: "standard" },
      { provider: "packyapi", tier: "standard" },
      { provider: "gptsapi", tier: "standard" },
    ]);
  });

  it("marks 2K and 4K jobs as HD requests", () => {
    for (const resolution of ["2K", "4K"] as const) {
      const request = buildGenerationTaskRequest({
        ...input,
        config: {
          ...input.config,
          resolution,
        },
      });

      expect(request.body.routeMode).toBe("hd");
      expect(request.body.route.providers).toEqual([
        { provider: "wuyinkeji", tier: "hd" },
        { provider: "rightcode", tier: "hd" },
        { provider: "gptsapi", tier: "standard" },
        { provider: "packyapi", tier: "hd" },
      ]);
    }
  });

  it("builds purchase, account, and task list request contracts", () => {
    expect(
      buildPurchasePlanRequest({
        planId: "pro-top-up",
        planName: "专业包",
        credits: 950,
        paymentChannel: "mock",
        note: "开发环境 mock 支付",
      }),
    ).toMatchObject({
      endpoint: "/api/billing/checkouts",
      method: "POST",
      body: {
        planId: "pro-top-up",
        credits: 950,
        currency: "CNY",
      },
    });

    expect(
      buildAccountSessionRequest({
        identifier: "seller@example.com",
        authView: "login",
        mode: "code",
        storeName: "",
        inviteCode: "",
        createdAt: "2026-06-17T00:00:00.000Z",
      }),
    ).toMatchObject({
      endpoint: "/api/account/session",
      method: "POST",
      body: {
        identifier: "seller@example.com",
        authView: "login",
      },
    });

    expect(buildTaskListRequest("guest")).toEqual({
      endpoint: "/api/generation/tasks?accountId=guest",
      method: "GET",
    });
    expect(buildCurrentAccountRequest("guest")).toEqual({
      endpoint: "/api/account/current?accountId=guest",
      method: "GET",
    });
    expect(
      buildConsumeCreditsRequest({
        amount: 1,
        label: "生成商品素材",
      }),
    ).toEqual({
      endpoint: "/api/account/credits/consume",
      method: "POST",
      body: {
        amount: 1,
        label: "生成商品素材",
        chargePolicy: "success_only",
      },
    });
  });
});
