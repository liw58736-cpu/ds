import { describe, expect, it } from "vitest";
import type { GenerationConfig } from "./types";
import { selectGenerationRoute } from "./generationRoutes";

const baseConfig = {
  module: "main_image",
  platform: "amazon",
  aspectRatio: "1:1",
  style: "premium",
  outputFormat: "png",
  sellingPoints: "Premium giftable bottle",
  specifications: "Summer launch, 20% off",
  selectedMainModules: [],
  detailModuleCounts: {},
  whiteBackgroundMode: "pure_white",
  shadowMode: "natural",
} as GenerationConfig;

describe("selectGenerationRoute", () => {
  it("defaults template and standard generation jobs to the 1K standard provider chain", () => {
    const route = selectGenerationRoute(baseConfig);

    expect(route.quality).toBe("standard");
    expect(route.fallbackStrategy).toBe("sequential");
    expect(route.providers).toEqual([
      { provider: "rightcode", tier: "standard" },
      { provider: "wuyinkeji", tier: "standard" },
      { provider: "packyapi", tier: "standard" },
      { provider: "gptsapi", tier: "standard" },
    ]);
  });

  it("routes explicit 1K template jobs through the standard provider chain", () => {
    const route = selectGenerationRoute({
      ...baseConfig,
      resolution: "1K",
    });

    expect(route.quality).toBe("standard");
    expect(route.fallbackStrategy).toBe("sequential");
    expect(route.providers).toEqual([
      { provider: "rightcode", tier: "standard" },
      { provider: "wuyinkeji", tier: "standard" },
      { provider: "packyapi", tier: "standard" },
      { provider: "gptsapi", tier: "standard" },
    ]);
  });

  it("routes AI tool mode through the available standard provider chain", () => {
    const route = selectGenerationRoute({
      ...baseConfig,
      module: "white_background",
      resolution: "1K",
    });

    expect(route.quality).toBe("standard");
    expect(route.fallbackStrategy).toBe("sequential");
    expect(route.providers).toEqual([
      { provider: "rightcode", tier: "standard" },
      { provider: "wuyinkeji", tier: "standard" },
      { provider: "packyapi", tier: "standard" },
      { provider: "gptsapi", tier: "standard" },
    ]);
  });

  it("routes 2K and 4K jobs through the sequential HD provider chain", () => {
    for (const resolution of ["2K", "4K"] as const) {
      const route = selectGenerationRoute({
        ...baseConfig,
        resolution,
      });

      expect(route.quality).toBe(resolution === "2K" ? "2k" : "4k");
      expect(route.fallbackStrategy).toBe("sequential");
      expect(route.providers).toEqual([
        { provider: "wuyinkeji", tier: "hd" },
        { provider: "rightcode", tier: "hd" },
        { provider: "gptsapi", tier: "standard" },
        { provider: "packyapi", tier: "hd" },
      ]);
    }
  });
});
