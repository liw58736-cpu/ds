import type {
  GenerationConfig,
  InspirationSettings,
  ModuleReferenceAsset,
} from "./types";

export type InspirationReferenceKey =
  | "inspiration_pose"
  | "inspiration_model"
  | "inspiration_product";

export interface InspirationReferenceDefinition {
  key: InspirationReferenceKey;
  actionKey: "poseAction" | "modelAction" | "productAction";
  title: string;
  shortLabel: string;
  pickerTitle: string;
  buttonLabel: string;
  description: string;
  imageAlt: string;
  instruction: string;
  roleInstruction: string;
}

export const inspirationReferenceDefinitions: InspirationReferenceDefinition[] = [
  {
    key: "inspiration_pose",
    actionKey: "poseAction",
    title: "姿势参考图",
    shortLabel: "姿势",
    pickerTitle: "从图片库选择姿势参考图",
    buttonLabel: "选择想要替换的姿势",
    description: "只参考身体姿势与肢体关系，不复制人物、服装或背景",
    imageAlt: "目标姿势参考图",
    instruction:
      "Use this image only as the target pose reference. Copy body pose, limb placement, crop and camera relationship; do not copy this person's identity, clothing, product or background.",
    roleInstruction:
      "is the target pose reference. Copy only body pose, limb placement, crop and camera relationship. Never copy its person identity, clothing, product or background",
  },
  {
    key: "inspiration_model",
    actionKey: "modelAction",
    title: "目标模特照片",
    shortLabel: "模特",
    pickerTitle: "从图片库选择目标模特照片",
    buttonLabel: "选择想要替换的模特",
    description: "只参考模特的脸部、发型和人物特征，不复制其服装、姿势或背景",
    imageAlt: "灵感创作目标模特",
    instruction:
      "Use this image only as the target model identity reference. Copy the recognisable face, hair, skin tone and person characteristics; do not copy clothing, product, pose or background.",
    roleInstruction:
      "is the target model identity reference. Copy the recognisable face, hair, skin tone and person characteristics. Never copy its clothing, product, pose or background",
  },
  {
    key: "inspiration_product",
    actionKey: "productAction",
    title: "替换产品 / 服装图",
    shortLabel: "产品 / 服装",
    pickerTitle: "从图片库选择替换产品 / 服装图",
    buttonLabel: "选择要替换进去的产品 / 服装",
    description: "作为最终替换商品来源，保留其颜色、版型、材质和设计细节",
    imageAlt: "替换产品服装图",
    instruction:
      "Use this image only as the replacement product or clothing source. Preserve its exact category, color, silhouette, material, pattern, seams, buttons, logos and recognisable design.",
    roleInstruction:
      "is the replacement product or clothing source. Preserve its exact category, color, silhouette, material, pattern, seams, buttons, logos and recognisable design",
  },
];

function actionValue(
  settings: InspirationSettings | undefined,
  key: InspirationReferenceDefinition["actionKey"],
): string {
  if (key === "productAction") return settings?.productAction ?? "replace";
  return settings?.[key] ?? "keep";
}

export function getActiveInspirationReferenceDefinitions(
  config: GenerationConfig,
): InspirationReferenceDefinition[] {
  if (config.module !== "lifestyle") return [];
  return inspirationReferenceDefinitions.filter(
    (definition) =>
      actionValue(config.inspirationSettings, definition.actionKey) ===
      "replace",
  );
}

export function getInspirationReferenceAsset(
  config: GenerationConfig,
  key: InspirationReferenceKey,
): ModuleReferenceAsset | null {
  return (
    config.moduleReferenceAssets?.[key]?.find((asset) =>
      Boolean(asset.imageUrl.trim()),
    ) ?? null
  );
}

export function getOrderedInspirationReferenceAssets(
  config: GenerationConfig,
): Array<{
  definition: InspirationReferenceDefinition;
  asset: ModuleReferenceAsset;
  imageNumber: number;
}> {
  return getActiveInspirationReferenceDefinitions(config).flatMap(
    (definition, index) => {
      const asset = getInspirationReferenceAsset(config, definition.key);
      return asset
        ? [{ definition, asset, imageNumber: index + 2 }]
        : [];
    },
  );
}

export function getMissingInspirationReference(
  config: GenerationConfig,
): InspirationReferenceDefinition | null {
  return (
    getActiveInspirationReferenceDefinitions(config).find(
      (definition) =>
        !getInspirationReferenceAsset(config, definition.key),
    ) ?? null
  );
}

export function buildInspirationReferenceRoleContract(
  config: GenerationConfig,
): string {
  const active = getActiveInspirationReferenceDefinitions(config);
  if (!active.length) {
    return "Reference image role contract: Image 1 is the base inspiration photo. No replacement reference image is active.";
  }
  return [
    "Reference image role contract: Image 1 is the base inspiration photo.",
    ...active.map(
      (definition, index) =>
        `Image ${index + 2} ${definition.roleInstruction}.`,
    ),
    "Use every active reference image according to its assigned role only. Never swap, merge or infer roles from another reference image.",
  ].join(" ");
}

export function isInspirationReferenceKey(
  value: string | null,
): value is InspirationReferenceKey {
  return inspirationReferenceDefinitions.some(
    (definition) => definition.key === value,
  );
}
