export type ProductSource = "upload" | "sample";

export type GenerationModule =
  | "main_image"
  | "white_background"
  | "lifestyle"
  | "detail_page"
  | "shopify_banner"
  | "video_preview";

export type Platform = "amazon" | "shopify" | "independent_store";

export type AspectRatio = "1:1" | "4:5" | "16:9" | "long_page";

export type VisualStyle = "studio" | "lifestyle" | "premium" | "minimal";

export type OutputFormat = "png" | "jpg" | "webp";

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
}

export interface GenerationTask {
  id: string;
  productInput: ProductInput;
  config: GenerationConfig;
  status: TaskStatus;
  resultUrls: string[];
  errorCode?: string;
  errorMessage?: string;
  creditCost: number;
  createdAt: string;
  completedAt?: string;
  attempt: number;
}

export interface GenerationResult {
  resultUrls: string[];
  creditCost: number;
}
