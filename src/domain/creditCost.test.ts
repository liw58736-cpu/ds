import { describe, expect, it } from "vitest";
import {
  estimateGenerationCredits,
  getGenerationImageCount,
  getResolutionCreditCost,
} from "./creditCost";
import type { GenerationConfig } from "./types";

const baseConfig: GenerationConfig = {
  module: "main_image",
  platform: "amazon",
  aspectRatio: "1:1",
  style: "studio",
  outputFormat: "png",
  sellingPoints: "",
  specifications: "",
  resolution: "1K",
  selectedMainModules: [],
  detailModuleCounts: {},
  whiteBackgroundMode: "pure_white",
  shadowMode: "natural",
  generationVersion: "standard",
};

describe("creditCost", () => {
  it("charges one generated image for white-background jobs by resolution", () => {
    const config: GenerationConfig = {
      ...baseConfig,
      module: "white_background",
      resolution: "2K",
    };

    expect(getGenerationImageCount(config)).toBe(1);
    expect(getResolutionCreditCost(config.resolution)).toBe(2);
    expect(estimateGenerationCredits(config)).toBe(2);
  });

  it("charges main-image jobs by selected module count and brand edition extra", () => {
    const config: GenerationConfig = {
      ...baseConfig,
      resolution: "4K",
      generationVersion: "brand",
      selectedMainModules: ["hero_kv", "overall_show", "detail_closeup"],
    };

    expect(getGenerationImageCount(config)).toBe(3);
    expect(estimateGenerationCredits(config)).toBe(14);
  });

  it("charges detail-page jobs by the total quantity across modules", () => {
    const config: GenerationConfig = {
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      generationVersion: "brand",
      detailModuleCounts: {
        main_display: 2,
        fabric_craft: 1,
      },
    };

    expect(getGenerationImageCount(config)).toBe(3);
    expect(estimateGenerationCredits(config)).toBe(5);
  });
});
