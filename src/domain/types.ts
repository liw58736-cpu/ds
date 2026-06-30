export type ProductSource = "upload" | "sample";

export type GenerationModule =
  | "main_image"
  | "white_background"
  | "lifestyle"
  | "detail_page"
  | "shopify_banner"
  | "video_preview";

export type Platform = "amazon" | "shopify" | "independent_store";

export type AspectRatio =
  | "original"
  | "1:1"
  | "4:5"
  | "3:4"
  | "16:9"
  | "9:16"
  | "long_page";

export type VisualStyle = "studio" | "lifestyle" | "premium" | "minimal";

export type OutputFormat = "png" | "jpg" | "webp";

export type GenerationResolution = "1K" | "2K" | "4K";

export type GenerationVersion = "standard" | "brand";

export type GenerationQuality = "standard" | "2k" | "4k";

export type MainImageModuleId =
  | "hero_kv"
  | "overall_show"
  | "detail_closeup"
  | "use_scene"
  | "color_set"
  | "function_compare"
  | "packaging"
  | "trust";

export type DetailPageModuleId =
  | "main_display"
  | "brand_intro"
  | "style_selling"
  | "fabric_craft"
  | "cutting"
  | "color_size"
  | "multi_color"
  | "promotion"
  | "specs"
  | "care"
  | "service"
  | "faq"
  | "buyer_show"
  | "outfit_recommend"
  | "scene_outfit"
  | "blogger_outfit"
  | "flat_lay"
  | "hanger"
  | "chapter";

export type WhiteBackgroundMode =
  | "white_background"
  | "ghost_model"
  | "ai_background"
  | "retouch"
  | "outfit_change"
  | "product_showcase"
  | "pure_white"
  | "transparent"
  | "light_gray";

export type ShadowMode = "natural" | "none" | "contact_shadow";

export type TaskStatus = "queued" | "processing" | "completed" | "failed";

export interface ProductInput {
  id: string;
  imageUrl: string;
  fileName: string;
  createdAt: string;
  source: ProductSource;
}

export interface GenerationConfig {
  module: GenerationModule;
  platform: Platform;
  aspectRatio: AspectRatio;
  style: VisualStyle;
  outputFormat: OutputFormat;
  sellingPoints: string;
  specifications: string;
  outputLanguage?: string;
  resolution?: GenerationResolution;
  generationVersion?: GenerationVersion;
  selectedMainModules?: MainImageModuleId[];
  detailModuleCounts?: Partial<Record<DetailPageModuleId, number>>;
  moduleReferenceAssets?: Partial<Record<string, ModuleReferenceAsset[]>>;
  whiteBackgroundMode?: WhiteBackgroundMode;
  shadowMode?: ShadowMode;
}

export interface ModuleReferenceAsset {
  id: string;
  fileName: string;
  imageUrl: string;
  note?: string;
}

export interface GenerationTask {
  id: string;
  productInput: ProductInput;
  config: GenerationConfig;
  status: TaskStatus;
  resultUrls: string[];
  resultAssets?: GenerationResultAsset[];
  channelUsed?: string;
  channelUsedByAsset?: string[];
  errorCode?: string;
  errorMessage?: string;
  progress?: string;
  backendTaskId?: string;
  backendTaskIds?: string[];
  creditCost: number;
  createdAt: string;
  completedAt?: string;
  attempt: number;
}

export interface GenerationResultAsset {
  url: string;
  label: string;
  channelUsed?: string;
}

export interface GenerationResult {
  resultUrls: string[];
  resultAssets?: GenerationResultAsset[];
  channelUsed?: string;
  channelUsedByAsset?: string[];
  creditCost: number;
}
