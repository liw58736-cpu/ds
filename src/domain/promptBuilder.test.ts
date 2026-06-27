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
      "preserved product geometry",
    );
    expect(prompt.modules[0].prompt).toContain("strict pure white background");
    expect(prompt.modules[0].prompt).toContain("subtle contact shadow");
  });

  it("creates distinct AI tool prompts for scene and showcase modes", () => {
    const backgroundPrompt = buildGenerationPrompt({
      ...baseConfig,
      module: "white_background",
      whiteBackgroundMode: "ai_background",
    });
    const showcasePrompt = buildGenerationPrompt({
      ...baseConfig,
      module: "white_background",
      whiteBackgroundMode: "product_showcase",
    });

    expect(backgroundPrompt.modules[0].prompt).toContain(
      "visibly different from a plain white cutout",
    );
    expect(showcasePrompt.modules[0].prompt).toContain(
      "pedestal, hanger, folded detail",
    );
    expect(showcasePrompt.modules[0].prompt).not.toContain("no extra props");
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

  it("adds module-specific uploaded asset notes to the matching module prompt", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "main_image",
      selectedMainModules: ["packaging", "color_set"],
      moduleReferenceAssets: {
        packaging: [
          {
            id: "ref-packaging-1",
            fileName: "box.png",
            imageUrl: "data:image/png;base64,box",
            note: "Use this exact gift box and ribbon structure.",
          },
        ],
        color_set: [
          {
            id: "ref-color-1",
            fileName: "red.png",
            imageUrl: "data:image/png;base64,red",
            note: "This is the red colorway.",
          },
          {
            id: "ref-color-2",
            fileName: "blue.png",
            imageUrl: "data:image/png;base64,blue",
            note: "This is the blue colorway.",
          },
        ],
      },
    });

    expect(prompt.modules[0]).toMatchObject({ id: "packaging" });
    expect(prompt.modules[0].prompt).toContain("Image 2 reference assets");
    expect(prompt.modules[0].prompt).toContain(
      "Use this exact gift box and ribbon structure.",
    );
    expect(prompt.modules[0].prompt).not.toContain("This is the red colorway.");
    expect(prompt.modules[1]).toMatchObject({ id: "color_set" });
    expect(prompt.modules[1].prompt).toContain("This is the red colorway.");
    expect(prompt.modules[1].prompt).toContain("This is the blue colorway.");
  });

  it("keeps detail-page modules tied to the source product, uploaded module assets, and exact user text", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      sellingPoints:
        "Black French vintage dress, visible lace cuffs, pearl buttons, fitted waist, soft satin fabric",
      specifications: "限时4折；仅有 X / L 码",
      detailModuleCounts: {
        fabric_craft: 1,
        cutting: 1,
        buyer_show: 1,
        promotion: 1,
        color_size: 1,
      },
      moduleReferenceAssets: {
        buyer_show: [
          {
            id: "buyer-show-ref-1",
            fileName: "buyer-show.png",
            imageUrl: "data:image/png;base64,buyer",
            note: "Use my uploaded buyer-show model/photo as the lifestyle source.",
          },
        ],
      },
    });

    expect(prompt.finalPrompt).toContain("Preserve Image 1 product identity");
    expect(prompt.finalPrompt).toContain("render user-provided text exactly");
    expect(prompt.finalPrompt).toContain("限时4折；仅有 X / L 码");
    expect(prompt.modules.find((module) => module.id === "fabric_craft")?.prompt).toContain(
      "derive fabric and craft details from Image 1",
    );
    expect(prompt.modules.find((module) => module.id === "cutting")?.prompt).toContain(
      "same garment cut and silhouette from Image 1",
    );
    const buyerShowPrompt = prompt.modules.find(
      (module) => module.id === "buyer_show",
    )?.prompt;

    expect(buyerShowPrompt).toContain("must use Image 2 reference assets");
    expect(buyerShowPrompt).toContain(
      "Use my uploaded buyer-show model/photo as the lifestyle source.",
    );
    expect(prompt.modules.find((module) => module.id === "promotion")?.prompt).toContain(
      "display this exact promotion text",
    );
    expect(prompt.modules.find((module) => module.id === "color_size")?.prompt).toContain(
      "display this exact size information",
    );
  });
});
