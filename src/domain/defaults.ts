import type { GenerationConfig, GenerationModule } from "./types";

export const defaultConfig: GenerationConfig = {
  module: "main_image",
  platform: "amazon",
  aspectRatio: "1:1",
  style: "studio",
  outputFormat: "png",
  sellingPoints: [],
  specifications: [],
};

export const moduleLabels = {
  main_image: "商品主图",
  white_background: "白底图",
  lifestyle: "生活方式场景图",
  detail_page: "详情页长图",
  shopify_banner: "Shopify Banner",
  video_preview: "商品视频入口",
} as const satisfies Record<GenerationModule, string>;
