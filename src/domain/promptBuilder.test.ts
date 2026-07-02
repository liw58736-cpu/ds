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

  it("adds Image 1 SKU preservation guard to every main-image module", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "main_image",
      selectedMainModules: [
        "hero_kv",
        "overall_show",
        "detail_closeup",
        "use_scene",
        "color_set",
        "function_compare",
        "packaging",
        "trust",
      ],
    });

    expect(prompt.modules).toHaveLength(8);
    for (const module of prompt.modules) {
      expect(module.prompt).toContain("The Image 1 product is the sold SKU");
      expect(module.prompt).toContain(
        "Do not swap in a different product, model garment, stock item, or invented SKU",
      );
      expect(module.prompt).toContain(
        "When placing it on a model, in hands, in packaging, or in a scene, use the exact Image 1 product",
      );
    }
  });

  it("adds Image 1 SKU preservation guard to every detail-page module", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      detailModuleCounts: {
        main_display: 1,
        brand_intro: 1,
        style_selling: 1,
        fabric_craft: 1,
        cutting: 1,
        color_size: 1,
        multi_color: 1,
        promotion: 1,
        specs: 1,
        care: 1,
        service: 1,
        faq: 1,
        buyer_show: 1,
        outfit_recommend: 1,
        scene_outfit: 1,
        blogger_outfit: 1,
        flat_lay: 1,
        hanger: 1,
        chapter: 1,
      },
    });

    expect(prompt.modules).toHaveLength(19);
    for (const module of prompt.modules) {
      expect(module.prompt).toContain("The Image 1 product is the sold SKU");
      expect(module.prompt).toContain(
        "preserve its exact category, silhouette or shape, material or fabric",
      );
      expect(module.prompt).toContain(
        "Do not swap in a different product, model garment, stock item, or invented SKU",
      );
    }
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
      "use this uploaded reference asset as the buyer-show visual source",
    );
    expect(prompt.modules.find((module) => module.id === "promotion")?.prompt).toContain(
      "display this exact promotion text",
    );
    expect(prompt.modules.find((module) => module.id === "color_size")?.prompt).toContain(
      "display this exact size information",
    );
  });

  it("treats module reference notes as exact visible copy for the matching module", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      detailModuleCounts: {
        color_size: 1,
      },
      moduleReferenceAssets: {
        color_size: [
          {
            id: "size-ref-1",
            fileName: "size-card.png",
            imageUrl: "data:image/png;base64,size",
            note: "只有X\\L码",
          },
        ],
      },
    });
    const colorSizePrompt = prompt.modules.find(
      (module) => module.id === "color_size",
    )?.prompt;

    expect(prompt.finalPrompt).toContain("只有 XL 码");
    expect(prompt.finalPrompt).not.toContain("只有X\\L码");
    expect(prompt.finalPrompt).toContain("module reference note text exactly");
    expect(colorSizePrompt).toContain("只有 XL 码");
    expect(colorSizePrompt).not.toContain("只有X\\L码");
    expect(colorSizePrompt).toContain("render module reference note text exactly");
    expect(colorSizePrompt).toContain("must use Image 2 reference assets");
  });

  it("treats buyer-show reference notes as instructions instead of visible copy", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      detailModuleCounts: {
        buyer_show: 1,
      },
      moduleReferenceAssets: {
        buyer_show: [
          {
            id: "buyer-show-ref-1",
            fileName: "buyer-show.png",
            imageUrl: "data:image/png;base64,buyer",
            note: "\u4f7f\u7528\u8fd9\u5f20\u7167\u7247\u4e3a\u4e70\u5bb6\u79c0",
          },
        ],
      },
    });
    const buyerShowPrompt = prompt.modules.find(
      (module) => module.id === "buyer_show",
    )?.prompt;

    expect(buyerShowPrompt).toContain("must use Image 2 reference assets");
    expect(buyerShowPrompt).toContain("Do not render the module reference note itself");
    expect(buyerShowPrompt).not.toContain("\u4f7f\u7528\u8fd9\u5f20\u7167\u7247\u4e3a\u4e70\u5bb6\u79c0");
    expect(prompt.finalPrompt).toContain(
      "Module reference notes can be instructions or constraints",
    );
    expect(prompt.finalPrompt).not.toContain(
      "render module reference note text exactly and legibly: \u4f7f\u7528\u8fd9\u5f20\u7167\u7247\u4e3a\u4e70\u5bb6\u79c0",
    );
  });

  it("turns user color limits into hard constraints for multi-color modules", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "main_image",
      selectedMainModules: ["color_set"],
      moduleReferenceAssets: {
        color_set: [
          {
            id: "color-note-1",
            fileName: "color-note.png",
            imageUrl: "data:image/png;base64,color",
            note: "\u53ea\u6709\u5f53\u524d\u7d2b\u8272\u548c\u9ed1\u8272\u4e24\u79cd\u6b3e\u5f0f",
          },
        ],
      },
    });
    const colorPrompt = prompt.modules.find((module) => module.id === "color_set")
      ?.prompt;

    expect(colorPrompt).toContain("exactly the user-specified colorways");
    expect(colorPrompt).toContain("Do not add extra colors");
    expect(colorPrompt).toContain("Available colorways: \u7d2b\u8272\u3001\u9ed1\u8272");
    expect(colorPrompt).toContain("Treat color-only notes as non-visible constraints");
  });

  it("uses color-only module notes as constraints without rendering the note sentence", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      detailModuleCounts: {
        multi_color: 1,
      },
      moduleReferenceAssets: {
        multi_color: [
          {
            id: "color-note-1",
            fileName: "material note",
            imageUrl: "",
            note: "\u5f53\u524d\u53ea\u6709\u7d2b\u8272\u548c\u9ed1\u8272",
          },
        ],
      },
    });
    const multiColorPrompt = prompt.modules.find(
      (module) => module.id === "multi_color",
    )?.prompt;

    expect(multiColorPrompt).toContain("Use exactly the user-specified colorways");
    expect(multiColorPrompt).toContain("Available colorways");
    expect(multiColorPrompt).toContain("\u7d2b\u8272\u3001\u9ed1\u8272");
    expect(multiColorPrompt).not.toContain(
      "Module material note 1: \u5f53\u524d\u53ea\u6709\u7d2b\u8272\u548c\u9ed1\u8272",
    );
    expect(multiColorPrompt).toContain(
      "Do not render the color constraint note itself as a title, badge, caption, or visible sentence",
    );
    expect(multiColorPrompt).not.toContain(
      "Product-facing module reference copy or constraints",
    );
    expect(prompt.finalPrompt).not.toContain(
      "render module reference note text exactly and legibly: \u5f53\u524d\u53ea\u6709\u7d2b\u8272\u548c\u9ed1\u8272",
    );
  });

  it("keeps color-only notes out of size copy areas", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      detailModuleCounts: {
        color_size: 1,
      },
      moduleReferenceAssets: {
        color_size: [
          {
            id: "color-size-color-note",
            fileName: "素材备注",
            imageUrl: "",
            note: "现在只有黑色和当前的紫色",
          },
        ],
      },
    });
    const colorSizePrompt = prompt.modules.find(
      (module) => module.id === "color_size",
    )?.prompt;

    expect(colorSizePrompt).toContain("Available colorways");
    expect(colorSizePrompt).toContain("紫色、黑色");
    expect(colorSizePrompt).toContain(
      "Do not place color-only notes in the size information area",
    );
    expect(colorSizePrompt).not.toContain("Module material note 1: 现在只有黑色和当前的紫色");
  });

  it("keeps multi-color and size modules from changing the garment SKU", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      sellingPoints: "lavender satin button-front blouse with long sleeves",
      detailModuleCounts: {
        color_size: 1,
        multi_color: 1,
      },
      moduleReferenceAssets: {
        color_size: [
          {
            id: "size-note-1",
            fileName: "material note",
            imageUrl: "",
            note: "Only X/L sizes are available.",
          },
        ],
        multi_color: [
          {
            id: "color-note-1",
            fileName: "material note",
            imageUrl: "",
            note: "Only the current lavender and black colorways are available.",
          },
        ],
      },
    });
    const multiColorPrompt = prompt.modules.find(
      (module) => module.id === "multi_color",
    )?.prompt;
    const colorSizePrompt = prompt.modules.find(
      (module) => module.id === "color_size",
    )?.prompt;

    expect(prompt.finalPrompt).toContain("A blouse or shirt must remain a blouse or shirt");
    expect(multiColorPrompt).toContain("Only recolor the exact Image 1 garment");
    expect(multiColorPrompt).toContain("same collar, sleeve length, cuffs, placket, hem, silhouette, fabric");
    expect(multiColorPrompt).toContain("Never turn the source product into a dress");
    expect(colorSizePrompt).toContain("Use the same Image 1 garment as the main visual");
    expect(colorSizePrompt).toContain("show only the exact user-provided sizes");
  });

  it("keeps specs pages anchored to the exact Image 1 garment", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      sellingPoints: "lavender satin button-front blouse with long sleeves",
      detailModuleCounts: {
        specs: 1,
      },
      moduleReferenceAssets: {
        specs: [
          {
            id: "spec-note-1",
            fileName: "material note",
            imageUrl: "",
            note: "Only X/L sizes are available.",
          },
        ],
      },
    });
    const specsPrompt = prompt.modules.find((module) => module.id === "specs")
      ?.prompt;

    expect(specsPrompt).toContain("Use Image 1 product as the central product visual");
    expect(specsPrompt).toContain(
      "same collar, sleeve length, cuffs, placket, hem, fabric sheen",
    );
    expect(specsPrompt).toContain(
      "Do not change a long-sleeve blouse or shirt into a sleeveless",
    );
    expect(specsPrompt).toContain("Render only this size or availability copy");
  });

  it("requires buyer-show references to wear the exact source product", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      detailModuleCounts: {
        buyer_show: 1,
      },
      moduleReferenceAssets: {
        buyer_show: [
          {
            id: "buyer-show-ref-1",
            fileName: "buyer-show.png",
            imageUrl: "data:image/png;base64,buyer",
            note: "Use this photo as the buyer-show reference.",
          },
        ],
      },
    });
    const buyerShowPrompt = prompt.modules.find(
      (module) => module.id === "buyer_show",
    )?.prompt;

    expect(buyerShowPrompt).toContain("dress the Image 2 buyer/model in the exact Image 1 product");
    expect(buyerShowPrompt).toContain("Image 2 must not replace the product SKU");
    expect(buyerShowPrompt).toContain("do not write instruction words from the note into the image");
  });

  it("keeps color-size module notes as exact availability copy and constraints", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      detailModuleCounts: {
        color_size: 1,
      },
      moduleReferenceAssets: {
        color_size: [
          {
            id: "size-ref-1",
            fileName: "size-card.png",
            imageUrl: "data:image/png;base64,size",
            note: "\u53ea\u6709 X/L \u4e24\u79cd\u5c3a\u7801",
          },
        ],
      },
    });
    const colorSizePrompt = prompt.modules.find(
      (module) => module.id === "color_size",
    )?.prompt;

    expect(colorSizePrompt).toContain("Render only this size or availability copy");
    expect(colorSizePrompt).toContain("Do not invent unavailable sizes");
    expect(colorSizePrompt).toContain("\u53ea\u6709 X/L \u4e24\u79cd\u5c3a\u7801");
  });

  it("keeps note-only module material as hard visible copy and constraints", () => {
    const prompt = buildGenerationPrompt({
      ...baseConfig,
      module: "detail_page",
      aspectRatio: "long_page",
      detailModuleCounts: {
        color_size: 1,
        promotion: 1,
      },
      moduleReferenceAssets: {
        color_size: [
          {
            id: "size-note-only",
            fileName: "素材备注",
            imageUrl: "",
            note: "只有XL码",
          },
        ],
        promotion: [
          {
            id: "promo-note-only",
            fileName: "素材备注",
            imageUrl: "",
            note: "限时4折",
          },
        ],
      },
    });
    const colorSizePrompt = prompt.modules.find(
      (module) => module.id === "color_size",
    )?.prompt;
    const promotionPrompt = prompt.modules.find(
      (module) => module.id === "promotion",
    )?.prompt;

    expect(prompt.finalPrompt).toContain("只有 XL 码");
    expect(prompt.finalPrompt).toContain("限时4折");
    expect(colorSizePrompt).toContain("Render only this size or availability copy");
    expect(colorSizePrompt).toContain("只有 XL 码");
    expect(promotionPrompt).toContain("render module reference note text exactly");
    expect(promotionPrompt).toContain("限时4折");
  });
});
