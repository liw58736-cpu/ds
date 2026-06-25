import { describe, expect, it } from "vitest";
import type { GenerationConfig } from "./types";
import { buildGenerationPrompt } from "./promptBuilder";

const baseConfig = {
  module: "main_image",
  platform: "amazon",
  aspectRatio: "1:1",
  style: "premium",
  outputFormat: "png",
  resolution: "2K",
  sellingPoints: "matte ceramic texture, giftable packaging",
  specifications: "Father's Day campaign, 20% off bundle",
  selectedMainModules: [],
  detailModuleCounts: {},
  whiteBackgroundMode: "pure_white",
  shadowMode: "natural",
} as GenerationConfig;

describe("buildGenerationPrompt", () => {
  it("creates distinct prompts for selected main-image modules", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "main_image",
      selectedMainModules: [
        "hero_kv",
        "detail_closeup",
        "function_compare",
      ],
    });

    expect(prompt.modules.map((module) => module.id)).toEqual([
      "hero_kv",
      "detail_closeup",
      "function_compare",
    ]);
    expect(prompt.modules[0].prompt).toContain("first-screen hero");
    expect(prompt.modules[1].prompt).toContain("macro material");
    expect(prompt.modules[2].prompt).toContain("structured comparison");
    expect(prompt.finalPrompt).toContain("premium overseas ecommerce");
    expect(prompt.finalPrompt).toContain("Father's Day campaign");
    expect(prompt.finalPrompt).toContain(
      "avoid loud domestic promotional poster aesthetics",
    );
  });

  it("builds white-background prompts from background and shadow settings", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "white_background",
      whiteBackgroundMode: "pure_white",
      shadowMode: "contact_shadow",
    });

    expect(prompt.modules).toHaveLength(1);
    expect(prompt.modules[0].prompt).toContain(
      "preserve the original product geometry",
    );
    expect(prompt.modules[0].prompt).toContain("clean pure white background");
    expect(prompt.modules[0].prompt).toContain("subtle contact shadow");
  });

  it("includes the selected output language in the final prompt", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      outputLanguage: "日语",
    });

    expect(prompt.finalPrompt).toContain("output language: 日语");
  });

  it("creates one detail-page prompt per selected module count", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      sellingPoints:
        "French vintage silk dress with lace splicing for urban commuters",
      detailModuleCounts: {
        fabric_craft: 2,
        buyer_show: 1,
        care: 1,
      },
    });

    expect(prompt.modules.map((module) => module.id)).toEqual([
      "fabric_craft",
      "fabric_craft",
      "buyer_show",
      "care",
    ]);
    expect(prompt.modules[0].prompt).toContain("fabric and craft closeups");
    expect(prompt.modules[1].prompt).toContain("fabric and craft closeups");
    expect(prompt.modules[2].prompt).toContain("UGC-like lifestyle");
    expect(prompt.modules[3].prompt).toContain("care icon strip");
    expect(prompt.finalPrompt).toContain("French vintage silk dress");
  });
});
