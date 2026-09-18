import type { GenerationConfig, WhiteBackgroundMode } from "./types";

const aiToolCreditLabels: Partial<Record<WhiteBackgroundMode, string>> = {
  white_background: "生成白底图",
  pure_white: "生成纯白底图",
  transparent: "生成透明底图",
  light_gray: "生成浅灰底图",
  ghost_model: "生成幽灵模特图",
  ai_background: "生成 AI 背景图",
  retouch: "生成精修图",
  outfit_change: "生成换装图",
  model_change: "生成换模特图",
  product_showcase: "生成产品展示图",
  watermark_remove: "图片局部清理",
  remove_object: "图片移除物体",
};

export function getGenerationCreditLabel(config: GenerationConfig): string {
  if (config.module === "main_image") return "生成商品主图";
  if (config.module === "detail_page") return "生成详情页图片";
  if (config.module === "lifestyle") return "生成灵感创作图片";
  if (config.module === "white_background") {
    return (
      aiToolCreditLabels[config.whiteBackgroundMode ?? "white_background"] ??
      "生成 AI 工具图片"
    );
  }
  return "生成图片";
}

export function getCreditTransactionDisplayLabel(input: {
  description: string;
  amount: number;
}): string {
  const description = input.description.trim();
  if (description === "Web image generation") {
    return [30, 40].includes(Math.abs(input.amount))
      ? "生成 Live 图"
      : "生成图片（历史记录）";
  }
  if (["Web credit top-up", "Manual credit top-up"].includes(description)) {
    return "手动充值积分";
  }
  if (description.startsWith("Paddle purchase:")) {
    const planName = description.slice("Paddle purchase:".length).trim();
    return planName ? `购买${planName}` : "购买积分套餐";
  }
  return description || "积分变动";
}
