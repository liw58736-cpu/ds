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
