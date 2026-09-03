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
      "Arrange multiple SKU colors or bundle variations with clean alignment, tasteful spacing, and a premium set-comparison feel. Only recolor the exact Image 1 garment: keep the same collar, sleeve length, cuffs, placket, hem, silhouette, fabric, closure, buttons, seams, and product category. Never turn the source product into a dress, lingerie, lace costume, packaging-only mockup, or unrelated SKU.",
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
      "Show the worn subject with tasteful color swatches and a clean size-card area. Use the same Image 1 garment as the main visual, display this exact size information from the user's specifications when provided, and show only the exact user-provided sizes or availability; do not add unavailable sizes or fake unreadable text. Keep the product category, collar, sleeves, cuffs, placket, hem, fabric, and colorways consistent with Image 1.",
  },
  multi_color: {
    title: "多色组合",
    prompt:
      "Present the same garment in multiple colors side by side with consistent pose, lighting, and easy visual comparison. Only recolor the exact Image 1 garment: same collar, sleeve length, cuffs, placket, hem, silhouette, fabric, closure, buttons, seams, and product category. Never turn the source product into a dress, lingerie, lace costume, packaging-only mockup, or unrelated SKU.",
  },
  promotion: {
    title: "价格优惠",
    prompt:
      "Design a restrained promotion card with premium spacing, discount emphasis, campaign mood, and no loud domestic poster style. Preserve the Image 1 product and display this exact promotion text from the user's specifications when provided.",
  },
  specs: {
    title: "规格参数",
    prompt:
      "Use Image 1 product as the central product visual, with clean callout lines and specification-card zones for measurements, structure, and material notes. Preserve the exact garment category and details from Image 1: same collar, sleeve length, cuffs, placket, hem, fabric sheen, silhouette, buttons, seams, and visible construction. Do not change a long-sleeve blouse or shirt into a sleeveless top, lace top, vest, dress, or unrelated garment. Use only the user-provided product specifications; render important size, material, discount, and availability text exactly when provided.",
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
      "Create UGC-like lifestyle imagery with natural home, street, or cafe context while keeping the product commercially polished. Preserve Image 1 product identity, garment details, colors, fabric, and fit. If Image 2 reference assets are provided, dress the Image 2 buyer/model in the exact Image 1 product while using Image 2 for model, pose, scene, styling, or user material source. Image 2 must not replace the product SKU.",
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

const inspirationPrompt = {
  title: "灵感创作",
  prompt:
    "Create an identity-preserving product replacement edit. Image 1 is the inspiration base photo: it controls the person, pose, hands, body proportions, camera angle, composition, lighting, and scene. Image 2 is the replacement product or garment: place that exact item naturally into Image 1, preserving its category, silhouette, fabric, color, seams, buttons, logos, pattern, and recognisable design. Do not copy the person or scene from Image 2. Do not render upload instructions as visible text.",
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
    "Create an outfit-change edit. Use Image 1 as the base person or model photo, and use Image 2 as the target clothing to put onto the person in Image 1. Preserve the Image 1 person's identity, pose, body proportions, camera angle, and scene where appropriate. Replace only the visible outfit with the Image 2 garment while preserving the Image 2 garment category, color, collar, sleeves, silhouette, fabric texture, pattern, seams, buttons, logos, and recognisable design.",
  model_change:
    "Create a model-replacement edit. Image 1 is the base product photo and its visible product or garment is the sold SKU. Image 2 is the target model reference. Replace the visible person in Image 1 with the Image 2 model, using the model's recognisable face, hair, skin tone, age presentation, and visible body characteristics. Preserve the exact Image 1 product or garment category, color, silhouette, fabric, seams, buttons, logos, pattern, fit, placement, camera angle, composition, lighting, and scene. Do not copy clothing or products from Image 2.",
  product_showcase:
    "Create a premium product showcase composition for ecommerce. Preserve the product identity, then stage it with refined studio lighting, a pedestal, hanger, folded detail, tasteful props, depth, and a polished retail display setup. The result must look like a designed product showcase, not a plain white-background cutout.",
  watermark_remove:
    "Remove only the user-painted watermark, overlaid text, or mark from the authorized source image. Reconstruct the masked pixels from the immediate surrounding texture, lighting, and structure. Preserve every unmasked pixel and do not redesign the product or scene.",
  remove_object:
    "Remove only the user-painted unwanted object from the source image. Reconstruct the masked area from the immediate surrounding background, texture, lighting, and perspective. Preserve every unmasked pixel and the sold product identity.",
  pure_white:
    "Create a strict pure white background product image with preserved product geometry, clean edges, and only minimal natural contact shadow.",
  transparent:
    "Create a transparent-background cutout look with crisp edges, preserved product geometry, and no surrounding scene.",
  light_gray:
    "Create a light gray inspection-background product image with preserved product geometry and neutral catalog lighting.",
};

const colorConstraintModules = new Set<string>([
  "color_set",
  "multi_color",
  "color_size",
]);

const sizeAvailabilityModules = new Set<string>(["color_size", "specs"]);

function hasModuleReferenceImage(asset: ModuleReferenceAsset): boolean {
  return asset.imageUrl.trim().length > 0;
}

function hasModuleReferenceNote(asset: ModuleReferenceAsset): boolean {
  return (asset.note?.trim() ?? "").length > 0;
}

export function buildGenerationPrompt(
  config: GenerationConfig,
): BuiltGenerationPrompt {
  const modules = getModulePrompts(config);
  const exactTextInstruction = getExactTextInstruction(config);
  const moduleReferenceTextInstruction = getModuleReferenceTextInstruction(config);
  const sharedContext = [
    "premium overseas ecommerce image generation",
    `page type: ${config.module}`,
    `aspect ratio: ${config.aspectRatio}`,
    `output format: ${config.outputFormat}`,
    `output language: ${config.outputLanguage ?? "中文"}`,
    config.sellingPoints ? `product requirements: ${config.sellingPoints}` : "",
    config.specifications
      ? `${config.module === "lifestyle" ? "on-image copy" : "promotion information"}: ${config.specifications}`
      : "",
    getSharedImageIdentityInstruction(config),
    exactTextInstruction,
    moduleReferenceTextInstruction,
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
      model_change: "换模特",
      product_showcase: "产品展示",
      watermark_remove: "去除水印或文字",
      remove_object: "移除物体",
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

  if (config.module === "lifestyle") {
    return [
      {
        id: "inspiration",
        title: inspirationPrompt.title,
        prompt: withModuleReferencePrompt(
          `${inspirationPrompt.prompt} ${getInspirationSettingsPrompt(config)}`,
          "inspiration",
          config,
        ),
      },
    ];
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

function getInspirationSettingsPrompt(config: GenerationConfig): string {
  const settings = config.inspirationSettings;

  if (!settings) {
    return "Creative controls: background=keep; pose=keep; model=keep; product=replace. Keep the Image 1 scene and person unchanged, and replace only the product or clothing with Image 2.";
  }

  const backgroundAction = settings.backgroundAction ?? "keep";
  const poseAction = settings.poseAction ?? "keep";
  const modelAction = settings.modelAction ?? "keep";
  const productAction = settings.productAction ?? "replace";
  const backgroundChange = settings.backgroundChange ?? "medium";
  const poseChange = settings.poseChange ?? "medium";
  const backgroundControl = backgroundAction === "adjust"
    ? `adjust (${backgroundChange} change intensity)`
    : backgroundAction;
  const poseControl = poseAction === "adjust"
    ? `adjust (${poseChange} change intensity)`
    : poseAction;
  return `Creative controls: background=${backgroundControl}; pose=${poseControl}; model=${modelAction}; product=${productAction}. Keep means preserve that Image 1 element exactly. Low change is subtle, medium change is clearly visible but identity-safe, and high change allows a larger visual difference. Pose or model replacement is generated without treating Image 2 as a person reference. Product replacement must use Image 2 as the sole product or garment source. Output ratio=${config.aspectRatio}.`;
}

function withModuleReferencePrompt(
  prompt: string,
  moduleId: string,
  config: GenerationConfig,
): string {
  const guardedPrompt = moduleId === "outfit_change"
    ? withOutfitChangeIdentityGuard(prompt)
    : moduleId === "model_change"
      ? withModelChangeIdentityGuard(prompt)
    : moduleId === "inspiration"
      ? withInspirationReplacementGuard(prompt)
      : withProductIdentityGuard(prompt);
  const assets = getModuleReferenceAssets(config, moduleId);

  if (assets.length === 0) {
    return guardedPrompt;
  }

  const notes = uniqueNotes(assets);
  const visibleNotes = getProductFacingCopyNotes(notes);
  const instructionOnlyNotes = notes.filter(
    (note) => !isProductFacingCopyNote(note),
  );
  const colorConstraintNotes = notes.filter(isColorConstraintNote);
  const availableColorways = colorConstraintModules.has(moduleId)
    ? extractAvailableColorways(colorConstraintNotes)
    : [];
  const imageAssets = assets.filter(hasModuleReferenceImage);
  const noteOnlyAssets = assets.filter(
    (asset) => !hasModuleReferenceImage(asset) && hasModuleReferenceNote(asset),
  );
  const imageAssetDescriptions = imageAssets
    .map((asset, index) => {
      const note = asset.note?.trim();
      const label = `Image 2 reference asset ${index + 1}`;

      if (!note) {
        return `${label}: ${asset.fileName}`;
      }

      if (shouldHideInstructionNoteText(moduleId, note)) {
        if (colorConstraintModules.has(moduleId) && isColorConstraintNote(note)) {
          return `${label}: use this uploaded reference asset as a colorway or material reference (${note}); do not render the user note wording as visible text.`;
        }

        return `${label}: use this uploaded reference asset as the buyer-show visual source; do not render the user note wording.`;
      }

      return `${label}: ${formatReferenceNoteForPrompt(note)}`;
    })
    .join(" ");
  const noteOnlyDescriptions = noteOnlyAssets
    .map((asset, index) => {
      const note = asset.note?.trim() ?? "";
      const label = `Module material note ${index + 1}`;

      if (shouldHideInstructionNoteText(moduleId, note)) {
        return `${label}: follow this as an instruction for how to use the module material; do not render the user note wording.`;
      }

      return `${label}: ${formatReferenceNoteForPrompt(note)}`;
    })
    .join(" ");
  const promptParts = [
    guardedPrompt,
  ];

  if (imageAssets.length > 0) {
    promptParts.push(
      moduleId === "outfit_change"
        ? "Image 2 reference assets are the target clothing for outfit change. Use the uploaded Image 2 garment as the clothing to wear on Image 1. Do not render the upload note as visible text. Do not invent extra garments or extra colorways."
        : moduleId === "model_change"
          ? "Image 2 is the target model reference. Use the uploaded person's recognisable identity and appearance to replace only the model in Image 1. Keep the exact Image 1 sold product or garment; never copy Image 2 clothing, accessories, background, or products."
        : moduleId === "inspiration"
          ? "Image 2 is the replacement product or garment. Use its exact visible design on the Image 1 person or in the Image 1 scene. Keep Image 1 as the base photo and do not introduce a third reference role."
        : "Image 2 reference assets are user-uploaded materials for this module only; must use Image 2 reference assets as visual sources for this module while preserving Image 1 product identity. Image 1 is always the product being sold; Image 2 can guide scene, model, packaging, colors, or material references but must not replace Image 1 with an unrelated product.",
    );
  }

  if (noteOnlyAssets.length > 0) {
    promptParts.push(
      "Module material notes are user-provided constraints for this module only; follow them as hard requirements while preserving Image 1 product identity.",
    );
  }

  if (instructionOnlyNotes.length > 0) {
    promptParts.push(
      "Instruction-only module reference notes must be followed as directions, not rendered as text. Do not render the module reference note itself unless it contains product-facing copy.",
    );
  }

  if (visibleNotes.length > 0) {
    promptParts.push(
      `Product-facing module reference copy or constraints: ${visibleNotes.join(" | ")}. Treat these as hard requirements; render module reference note text exactly and legibly only when text belongs in this module.`,
    );
  }

  if (colorConstraintModules.has(moduleId) && colorConstraintNotes.length > 0) {
    const colorwayCopy =
      availableColorways.length > 0
        ? `Available colorways: ${availableColorways.join("\u3001")}. `
        : "";

    promptParts.push(
      `${colorwayCopy}Use exactly the user-specified colorways from the module reference notes. Do not add extra colors, extra variants, or invented swatches. Treat color-only notes as non-visible constraints, not customer-facing copy. Do not render the color constraint note itself as a title, badge, caption, or visible sentence unless the note explicitly asks to display that text.`,
    );

    if (moduleId === "color_size") {
      promptParts.push(
        "Do not place color-only notes in the size information area; show colors only as swatches or short color labels, and reserve the size information area for explicit size or availability copy.",
      );
    }
  }

  if (
    sizeAvailabilityModules.has(moduleId) &&
    visibleNotes.some(isSizeAvailabilityNote)
  ) {
    promptParts.push(
      `Render only this size or availability copy from the module reference notes: ${visibleNotes.filter(isSizeAvailabilityNote).join(" | ")}. Do not invent unavailable sizes, stock labels, or fake size ranges.`,
    );
  }

  if (moduleId === "buyer_show") {
    if (imageAssets.length > 0) {
      promptParts.push(
        "For buyer-show, dress the Image 2 buyer/model in the exact Image 1 product and preserve Image 1 product on that buyer or scene. Image 2 must not replace the product SKU. Do not render the module reference note itself unless it contains product-facing copy; do not write instruction words from the note into the image.",
      );
    } else {
      promptParts.push(
        "For buyer-show, follow module material notes as directions for the buyer/model/pose/scene while preserving Image 1 product identity. Do not render the module reference note itself unless it contains product-facing copy; do not write instruction words from the note into the image.",
      );
    }
  }

  promptParts.push(imageAssetDescriptions, noteOnlyDescriptions);

  return promptParts.filter(Boolean).join(" ");
}

function withProductIdentityGuard(prompt: string): string {
  if (prompt.includes("The Image 1 product is the sold SKU")) {
    return prompt;
  }

  return `${prompt} The Image 1 product is the sold SKU for this module; preserve its exact category, silhouette or shape, material or fabric, colorway, seams, buttons, logos, packaging, hardware, proportions, camera-facing details, and recognisable design. Do not swap in a different product, model garment, stock item, or invented SKU. When placing it on a model, in hands, in packaging, or in a scene, use the exact Image 1 product; only the background, layout, camera framing, styling context, or allowed colorway may change.`;
}

function withOutfitChangeIdentityGuard(prompt: string): string {
  if (prompt.includes("Image 2 is the target clothing")) {
    return prompt;
  }

  return `${prompt} Image 1 is the base photo. Image 2 is the target clothing. Keep the person, pose, hands, face, body proportions, camera angle, and scene from Image 1 stable, but replace the outfit with Image 2 clothing. Preserve Image 2 garment details exactly; do not keep the old Image 1 outfit unless it is not part of the clothing being replaced.`;
}

function withModelChangeIdentityGuard(prompt: string): string {
  if (prompt.includes("Image 2 is the target model reference")) return prompt;
  return `${prompt} Image 1 is the base product photo and Image 2 is the target model reference. Replace only the visible person with the Image 2 model. Preserve the exact Image 1 product or garment and its color, construction, fabric, logos, fit, placement, pose, camera angle, composition, lighting, and scene. Do not import Image 2 clothing, products, accessories, or background.`;
}

function withInspirationReplacementGuard(prompt: string): string {
  if (prompt.includes("Image 1 remains the base inspiration photo")) return prompt;
  return `${prompt} Image 1 remains the base inspiration photo. Preserve the Image 1 person identity, face, hands, pose, body proportions, camera angle, composition, and scene for every element configured as keep. Image 2 is the only replacement product or clothing source. Preserve Image 2 item details exactly and replace only the requested product or garment area.`;
}

function getSharedImageIdentityInstruction(config: GenerationConfig): string {
  if (config.module === "lifestyle") {
    return "For inspiration replacement, Image 1 is the base person and scene, while Image 2 is the replacement product or garment. Preserve the Image 1 identity and all configured keep elements; preserve the exact Image 2 product design. Never swap these roles.";
  }
  if (
    config.module === "white_background" &&
    config.whiteBackgroundMode === "outfit_change"
  ) {
    return "For outfit change, Image 1 is the base person or model photo and Image 2 is the target clothing. Preserve Image 1 person, pose, body shape, camera angle, and scene; replace the visible outfit with Image 2 clothing while preserving Image 2 garment details. Do not render upload notes as visible text.";
  }
  if (
    config.module === "white_background" &&
    config.whiteBackgroundMode === "model_change"
  ) {
    return "For model change, Image 1 is the sold product or garment and scene, while Image 2 is the target model reference. Replace only the person with the Image 2 model identity and appearance. Preserve the exact Image 1 product, pose, framing, lighting, and scene; do not use Image 2 clothing or background.";
  }

  return "Preserve Image 1 product identity: same product category, garment shape, material, color, seams, lace, buttons, logos, packaging, camera-facing details, and recognisable design. A blouse or shirt must remain a blouse or shirt; never turn a top into a dress, lingerie, lace costume, packaging-only mockup, or unrelated SKU. Do not replace it with a different product.";
}

function getExactTextInstruction(config: GenerationConfig): string {
  const specifications = normalizeProductFacingText(config.specifications.trim());

  if (!specifications) {
    return "";
  }

  return `When the image contains text, render user-provided text exactly and legibly from this source: ${specifications}. Do not rewrite numbers, discounts, size labels, availability, or promotional wording.`;
}

function getModuleReferenceTextInstruction(config: GenerationConfig): string {
  const notes = uniqueNotes(
    Object.values(config.moduleReferenceAssets ?? {}).flatMap(
      (assets) => assets ?? [],
    ),
  );
  const visibleNotes = getProductFacingCopyNotes(notes);

  if (notes.length === 0) {
    return "";
  }

  const parts = [
    "Module reference notes can be instructions or constraints. Follow instruction-only notes as directions for how to use uploaded materials, not as visible image text.",
  ];

  if (visibleNotes.length > 0) {
    parts.push(
      `When product-facing module reference notes contain visible copy or constraints, render module reference note text exactly and legibly: ${visibleNotes.join(" | ")}. Do not rewrite slashes, size labels, discounts, availability, colors, or packaging wording.`,
    );
  }

  return parts.join(" ");
}

function uniqueNotes(assets: ModuleReferenceAsset[]): string[] {
  return [
    ...new Set(
      assets
        .map((asset) => asset.note?.trim() ?? "")
        .filter((note) => note.length > 0),
    ),
  ];
}

function getProductFacingCopyNotes(notes: string[]): string[] {
  return [
    ...new Set(
      notes
        .filter(isProductFacingCopyNote)
        .map(normalizeProductFacingText)
        .filter((note) => note.length > 0),
    ),
  ];
}

function formatReferenceNoteForPrompt(note: string): string {
  return isProductFacingCopyNote(note) ? normalizeProductFacingText(note) : note;
}

function normalizeProductFacingText(value: string): string {
  return normalizeSizeCopy(value.trim());
}

function normalizeSizeCopy(value: string): string {
  let output = value
    .replace(/\bXXX\s*\\\s*L\b/gi, "XXXL")
    .replace(/\bXX\s*\\\s*L\b/gi, "XXL")
    .replace(/\bX\s*\\\s*L\b/gi, "XL");

  const sizeListPattern =
    /\b(XXXL|XXL|XL|XS|S|M|L)\s*[\\/、,，]\s*(XXXL|XXL|XL|XS|S|M|L)\b/gi;
  let previous = "";
  while (previous !== output) {
    previous = output;
    output = output.replace(sizeListPattern, "$1 / $2");
  }

  return output
    .replace(/\b(XXXL|XXL|XL|XS|S|M|L)\s*码/gi, "$1 码")
    .replace(/只有\s*(XXXL|XXL|XL|XS|S|M|L)\s*码/gi, "只有 $1 码");
}

function isProductFacingCopyNote(note: string): boolean {
  return (
    hasExplicitTextMarker(note) ||
    isSizeAvailabilityNote(note) ||
    isPromotionCopyNote(note)
  );
}

function hasExplicitTextMarker(note: string): boolean {
  const lower = note.toLowerCase();

  return (
    [
      "\u6587\u6848",
      "\u6587\u5b57",
      "\u5199\u4e0a",
      "\u663e\u793a",
      "\u6807\u6ce8",
      "\u6807\u8bc6",
      "\u6807\u7b7e",
    ].some((marker) => note.includes(marker)) ||
    /\b(copy|text|label|caption|badge|slogan)\b/i.test(lower)
  );
}

function isSizeAvailabilityNote(note: string): boolean {
  const hasSizeSpecificText =
    /(^|[^a-z])(xs|s|m|l|xl|xxl|xxxl)([^a-z]|$)/i.test(note) ||
    /[0-9]+\s*(cm|mm|\u7801)/i.test(note) ||
    ["\u5c3a\u7801", "\u5747\u7801", "\u7801"].some((marker) =>
      note.includes(marker),
    ) ||
    /\b(size|sizes|sizing)\b/i.test(note);
  const hasAvailabilityText =
    ["\u53ea\u5269", "\u73b0\u8d27", "\u5e93\u5b58"].some((marker) =>
      note.includes(marker),
    ) || /\b(available|availability|in stock)\b/i.test(note);

  return (
    hasSizeSpecificText ||
    (hasAvailabilityText && !isColorConstraintNote(note))
  );
}

function isPromotionCopyNote(note: string): boolean {
  return (
    /[0-9]\s*\u6298/.test(note) ||
    /%/.test(note) ||
    [
      "\u9650\u65f6",
      "\u4f18\u60e0",
      "\u6ee1\u51cf",
      "\u5305\u90ae",
      "\u4e70\u4e00",
      "\u8d60",
      "\u6298\u6263",
    ].some((marker) => note.includes(marker)) ||
    /\b(off|discount|sale|promo|promotion)\b/i.test(note)
  );
}

function isColorConstraintNote(note: string): boolean {
  return (
    [
      "\u989c\u8272",
      "\u8272\u53f7",
      "\u8272",
      "\u7d2b",
      "\u9ed1",
      "\u767d",
      "\u7ea2",
      "\u84dd",
      "\u7eff",
      "\u9ec4",
      "\u7070",
      "\u7c89",
      "\u68d5",
      "\u5496",
    ].some((marker) => note.includes(marker)) ||
    /\b(color|colour|purple|black|white|red|blue|green|yellow|gray|grey|pink|brown|beige)\b/i.test(
      note,
    )
  );
}

const colorKeywordCatalog: Array<{
  name: string;
  patterns: RegExp[];
}> = [
  { name: "\u7d2b\u8272", patterns: [/\u7d2b/u, /\blavender\b/i, /\bpurple\b/i] },
  { name: "\u9ed1\u8272", patterns: [/\u9ed1/u, /\bblack\b/i] },
  { name: "\u767d\u8272", patterns: [/\u767d/u, /\bwhite\b/i] },
  { name: "\u7ea2\u8272", patterns: [/\u7ea2/u, /\bred\b/i] },
  { name: "\u84dd\u8272", patterns: [/\u84dd/u, /\bblue\b/i] },
  { name: "\u7eff\u8272", patterns: [/\u7eff/u, /\bgreen\b/i] },
  { name: "\u9ec4\u8272", patterns: [/\u9ec4/u, /\byellow\b/i] },
  { name: "\u7070\u8272", patterns: [/\u7070/u, /\bgr[ae]y\b/i] },
  { name: "\u7c89\u8272", patterns: [/\u7c89/u, /\bpink\b/i] },
  { name: "\u68d5\u8272", patterns: [/\u68d5/u, /\bbrown\b/i] },
  { name: "\u5496\u8272", patterns: [/\u5496/u, /\bcoffee\b/i] },
  { name: "\u7c73\u8272", patterns: [/\u7c73/u, /\bbeige\b/i] },
];

function extractAvailableColorways(notes: string[]): string[] {
  const colorways = colorKeywordCatalog
    .filter((entry) =>
      notes.some((note) => entry.patterns.some((pattern) => pattern.test(note))),
    )
    .map((entry) => entry.name);

  return [...new Set(colorways)];
}

function shouldHideInstructionNoteText(moduleId: string, note: string): boolean {
  if (
    colorConstraintModules.has(moduleId) &&
    isColorConstraintNote(note) &&
    !hasExplicitTextMarker(note)
  ) {
    return true;
  }

  if (moduleId !== "buyer_show" || isProductFacingCopyNote(note)) {
    return false;
  }

  return (
    [
      "\u7167\u7247",
      "\u56fe\u7247",
      "\u8fd9\u5f20\u56fe",
      "\u7d20\u6750",
      "\u4e70\u5bb6\u79c0",
    ].some((marker) => note.includes(marker)) ||
    /\b(photo|image|picture|asset|buyer|model|scene|reference)\b/i.test(note)
  );
}

function getModuleReferenceAssets(
  config: GenerationConfig,
  moduleId: string,
): ModuleReferenceAsset[] {
  const assets = moduleId === "inspiration"
    ? config.moduleReferenceAssets?.inspiration_product ??
      config.moduleReferenceAssets?.inspiration_garment ??
      config.moduleReferenceAssets?.inspiration ??
      []
    : config.moduleReferenceAssets?.[moduleId] ?? [];
  return assets.filter(
    (asset) => hasModuleReferenceImage(asset) || hasModuleReferenceNote(asset),
  );
}
