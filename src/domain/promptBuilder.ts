import type {
  DetailPageModuleId,
  GenerationConfig,
  MainImageModuleId,
  ModuleReferenceAsset,
  ShadowMode,
  WhiteBackgroundMode,
} from "./types";

export interface ModulePrompt {
  id: string;
  title: string;
  prompt: string;
}

export interface BuiltGenerationPrompt {
  finalPrompt: string;
  modules: ModulePrompt[];
}

const mainImagePrompts: Record<
  MainImageModuleId,
  { title: string; prompt: string }
> = {
  hero_kv: {
    title: "首屏 KV",
    prompt:
      "Build a first-screen hero image with one clear product focal point, premium overseas ecommerce composition, quiet negative space, and strong first-glance recognition.",
  },
  overall_show: {
    title: "整体展示",
    prompt:
      "Show the complete product form with refined studio lighting, premium atmosphere, and a balanced catalog-ready layout.",
  },
  detail_closeup: {
    title: "细节特写",
    prompt:
      "Create macro material and craft closeups that enlarge texture, finish, stitching, surface detail, and manufacturing quality.",
  },
  use_scene: {
    title: "使用场景",
    prompt:
      "Place the product in a believable lifestyle use scene with natural scale, realistic hands or environment, and commercial clarity.",
  },
  color_set: {
    title: "多色套装",
    prompt:
      "Arrange multiple SKU colors or bundle variations with clean alignment, tasteful spacing, and a premium set-comparison feel.",
  },
  function_compare: {
    title: "功能对比",
    prompt:
      "Create a structured comparison visual with product-led sections, clean parameter blocks, readable hierarchy, and no fake tiny text.",
  },
  packaging: {
    title: "包装展示",
    prompt:
      "Show gift box, accessories, package layers, and unboxing details with elegant retail presentation and trustworthy lighting.",
  },
  trust: {
    title: "权益保障",
    prompt:
      "Create a trust-building ecommerce visual for warranty, after-sales promise, secure purchase, and brand confidence without clutter.",
  },
};

const detailPrompts: Record<
  DetailPageModuleId,
  { title: string; prompt: string }
> = {
  main_display: {
    title: "主图展示",
    prompt:
      "Open with a detail-page first-screen KV that establishes instant recognition, product identity, and premium brand tone.",
  },
  brand_intro: {
    title: "品牌介绍",
    prompt:
      "Create an editorial cover with restrained brand positioning, clean typography zones, and magazine-like visual rhythm.",
  },
  style_selling: {
    title: "款式卖点",
    prompt:
      "Show the same clothing styling from multiple angles, emphasizing silhouette, line, fit, and key design selling points.",
  },
  fabric_craft: {
    title: "面料工艺",
    prompt:
      "Combine a worn main image with fabric and craft closeups. Strictly derive fabric and craft details from Image 1 and the product requirements: texture, stitching, lace, buttons, seams, weave, finish, and handfeel must match the source product. Do not invent a different material or decoration.",
  },
  cutting: {
    title: "版型剪裁",
    prompt:
      "Use natural movement poses to show the same garment cut and silhouette from Image 1, including drape, waistline, shoulder line, hem behavior, sleeve shape, collar, and tailoring structure. Do not change the pattern, fit, length, or product category.",
  },
  color_size: {
    title: "颜色尺码",
    prompt:
      "Show the worn subject with tasteful color swatches and a clean size-card area. Preserve the Image 1 product and display this exact size information from the user's specifications when provided; do not add unavailable sizes or fake unreadable text.",
  },
  multi_color: {
    title: "多色组合",
    prompt:
      "Present the same garment in multiple colors side by side with consistent pose, lighting, and easy visual comparison.",
  },
  promotion: {
    title: "价格优惠",
    prompt:
      "Design a restrained promotion card with premium spacing, discount emphasis, campaign mood, and no loud domestic poster style. Preserve the Image 1 product and display this exact promotion text from the user's specifications when provided.",
  },
  specs: {
    title: "规格参数",
    prompt:
      "Show a worn subject with clean callout lines and specification-card zones for measurements, structure, and material notes. Use only the user-provided product specifications; render important size, material, discount, and availability text exactly when provided.",
  },
  care: {
    title: "洗护说明",
    prompt:
      "Combine the garment on-body or neatly displayed with a simple care icon strip and elegant maintenance guidance area.",
  },
  service: {
    title: "售后保障",
    prompt:
      "Create a three-column service guarantee card for returns, quality assurance, and shipping support with quiet trust signals.",
  },
  faq: {
    title: "常见问题",
    prompt:
      "Create a clean FAQ card layout with question-answer rhythm, thin separators, and readable empty zones for copy.",
  },
  buyer_show: {
    title: "买家秀",
    prompt:
      "Create UGC-like lifestyle imagery with natural home, street, or cafe context while keeping the product commercially polished. Preserve Image 1 product identity, garment details, colors, fabric, and fit. If Image 2 reference assets are provided, must use Image 2 reference assets as the buyer-show model, pose, scene, styling, or user material source for this module.",
  },
  outfit_recommend: {
    title: "搭配推荐",
    prompt:
      "Show three coordinated outfits on the same model side by side, each with distinct styling and consistent brand tone.",
  },
  scene_outfit: {
    title: "场景穿搭",
    prompt:
      "Place the outfit in a specific lifestyle scene such as commute, date, vacation, or weekend, with contextual styling cues.",
  },
  blogger_outfit: {
    title: "博主穿搭",
    prompt:
      "Create an OOTD blogger-style fashion image with realistic social content atmosphere, flattering pose, and tasteful framing.",
  },
  flat_lay: {
    title: "平铺图",
    prompt:
      "Create a natural overhead flat lay with the main clothing item, accessories, fabric folds, and premium retail styling.",
  },
  hanger: {
    title: "挂架展示",
    prompt:
      "Show the garment on a hanger or boutique rack with realistic store display, fabric fall, and curated retail environment.",
  },
  chapter: {
    title: "章节过渡卡",
    prompt:
      "Create a quiet text-led chapter transition card with album-like breathing space, minimal product hint, and elegant pacing.",
  },
};

const shadowCopy: Record<ShadowMode, string> = {
  natural: "natural soft studio shadow",
  none: "no shadow, crisp ecommerce cutout",
  contact_shadow: "subtle contact shadow",
};

const aiToolPromptCopy: Record<WhiteBackgroundMode, string> = {
  white_background:
    "Create a clean marketplace white-background product image. Preserve the original product geometry, material, proportions, camera angle, color, seams, buttons, edges, and silhouette. Remove distracting background, keep a pure white or near-white platform-ready background, add only a natural contact shadow, and do not change the product design.",
  ghost_model:
    "Create a ghost mannequin image for the garment. Remove the visible model body while preserving the garment shape, collar, sleeve volume, pocket, button placement, fabric folds, seams, and fit structure. The output should look like the shirt is worn by an invisible mannequin, not a flat lay.",
  ai_background:
    "Keep the product or worn garment identity unchanged, then place it into a premium AI-generated commercial background. Use a realistic ecommerce scene with tasteful depth, soft daylight, lifestyle context, and restrained props that match the product category. The background must be visibly different from a plain white cutout.",
  retouch:
    "Retouch the uploaded product image while keeping the same product, pose, framing, and identity. Improve fabric cleanliness, wrinkles, lighting balance, edge clarity, color consistency, and commercial polish. Do not redesign the product, do not change the model pose, and do not add a new scene.",
  outfit_change:
    "Create a visible outfit styling variation around the uploaded garment. Preserve the main garment's color, collar, pocket, buttons, fabric texture, and silhouette, but change the surrounding outfit styling such as pants, layering, shoes, accessories, and presentation context. The result should clearly look like a new styled look, not the same plain cutout.",
  product_showcase:
    "Create a premium product showcase composition for ecommerce. Preserve the product identity, then stage it with refined studio lighting, a pedestal, hanger, folded detail, tasteful props, depth, and a polished retail display setup. The result must look like a designed product showcase, not a plain white-background cutout.",
  pure_white:
    "Create a strict pure white background product image with preserved product geometry, clean edges, and only minimal natural contact shadow.",
  transparent:
    "Create a transparent-background cutout look with crisp edges, preserved product geometry, and no surrounding scene.",
  light_gray:
    "Create a light gray inspection-background product image with preserved product geometry and neutral catalog lighting.",
};

export function buildGenerationPrompt(
  config: GenerationConfig,
): BuiltGenerationPrompt {
  const modules = getModulePrompts(config);
  const exactTextInstruction = getExactTextInstruction(config);
  const sharedContext = [
    "premium overseas ecommerce image generation",
    `page type: ${config.module}`,
    `aspect ratio: ${config.aspectRatio}`,
    `output format: ${config.outputFormat}`,
    `output language: ${config.outputLanguage ?? "中文"}`,
    config.sellingPoints ? `product requirements: ${config.sellingPoints}` : "",
    config.specifications ? `promotion information: ${config.specifications}` : "",
    "Preserve Image 1 product identity: same product category, garment shape, material, color, seams, lace, buttons, logos, packaging, camera-facing details, and recognisable design. Do not replace it with a different product.",
    exactTextInstruction,
    "avoid loud domestic promotional poster aesthetics, fake tiny unreadable text, distorted logos, changed product identity, invented discounts, invented sizes, and invented materials",
  ].filter(Boolean);

  return {
    modules,
    finalPrompt: `${sharedContext.join("\n")}\n\nModule prompts:\n${modules
      .map((module, index) => `${index + 1}. ${module.title}: ${module.prompt}`)
      .join("\n")}`,
  };
}

function getModulePrompts(config: GenerationConfig): ModulePrompt[] {
  if (config.module === "white_background") {
    const backgroundMode = config.whiteBackgroundMode ?? "white_background";
    const shadowMode = config.shadowMode ?? "natural";
    const toolTitles: Record<WhiteBackgroundMode, string> = {
      white_background: "白底图",
      ghost_model: "幽灵模特",
      ai_background: "AI背景",
      retouch: "精修",
      outfit_change: "换装",
      product_showcase: "产品展示",
      pure_white: "白底图",
      transparent: "透明底",
      light_gray: "浅灰检测",
    };

    return [
      {
        id: backgroundMode,
        title: toolTitles[backgroundMode],
        prompt: withModuleReferencePrompt(
          `${aiToolPromptCopy[backgroundMode]} Apply ${shadowCopy[shadowMode]} where appropriate. Avoid fake tiny unreadable text, distorted logos, extra limbs, changed garment details, and mismatched product colors.`,
          backgroundMode,
          config,
        ),
      },
    ];
  }

  if (config.module === "detail_page") {
    const counts = config.detailModuleCounts ?? {};
    const selectedModules = Object.entries(counts)
      .filter((entry): entry is [DetailPageModuleId, number] => entry[1] > 0)
      .flatMap(([id, count]) =>
        Array.from({ length: Math.max(0, Math.floor(count)) }, () => id),
      );

    const moduleIds: DetailPageModuleId[] =
      selectedModules.length > 0 ? selectedModules : ["main_display"];

    return moduleIds.map((id) => ({
        id,
        title: detailPrompts[id].title,
        prompt: withModuleReferencePrompt(detailPrompts[id].prompt, id, config),
      }));
  }

  const selectedMainModules: MainImageModuleId[] =
    config.selectedMainModules && config.selectedMainModules.length > 0
      ? config.selectedMainModules
      : ["hero_kv"];

  return selectedMainModules.map((id) => ({
    id,
    title: mainImagePrompts[id].title,
    prompt: withModuleReferencePrompt(mainImagePrompts[id].prompt, id, config),
  }));
}

function withModuleReferencePrompt(
  prompt: string,
  moduleId: string,
  config: GenerationConfig,
): string {
  const assets = getModuleReferenceAssets(config, moduleId);

  if (assets.length === 0) {
    return prompt;
  }

  const notes = assets
    .map((asset, index) => {
      const note = asset.note?.trim();
      const label = `Image 2 reference asset ${index + 1}`;

      return note ? `${label}: ${note}` : `${label}: ${asset.fileName}`;
    })
    .join(" ");

  return `${prompt} Image 2 reference assets are user-uploaded materials for this module only; must use Image 2 reference assets as visual sources for this module while preserving Image 1 product identity. ${notes}`;
}

function getExactTextInstruction(config: GenerationConfig): string {
  const specifications = config.specifications.trim();

  if (!specifications) {
    return "";
  }

  return `When the image contains text, render user-provided text exactly and legibly from this source: ${specifications}. Do not rewrite numbers, discounts, size labels, availability, or promotional wording.`;
}

function getModuleReferenceAssets(
  config: GenerationConfig,
  moduleId: string,
): ModuleReferenceAsset[] {
  return (config.moduleReferenceAssets?.[moduleId] ?? []).filter(
    (asset) => asset.imageUrl.trim().length > 0,
  );
}
