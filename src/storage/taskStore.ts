import type {
  AspectRatio,
  DetailPageModuleId,
  GenerationConfig,
  GenerationResolution,
  GenerationModule,
  MainImageModuleId,
  GenerationTask,
  OutputFormat,
  Platform,
  ProductInput,
  ProductSource,
  ShadowMode,
  TaskStatus,
  VisualStyle,
  WhiteBackgroundMode,
} from "../domain/types";

const TASKS_STORAGE_KEY = "commerce-studio-tasks-v1";
const INTERRUPTED_TASK_ERROR = {
  errorCode: "task_interrupted",
  errorMessage: "任务在上次会话中断，请重新生成。",
} as const;
const UNAVAILABLE_UPLOAD_SOURCE_ERROR = {
  errorCode: "upload_source_unavailable",
  errorMessage: "原始上传图已失效，请重新上传后再生成。",
} as const;

const productSources = new Set<ProductSource>(["upload", "sample"]);
const modules = new Set<GenerationModule>([
  "main_image",
  "white_background",
  "lifestyle",
  "detail_page",
  "shopify_banner",
  "video_preview",
]);
const platforms = new Set<Platform>([
  "amazon",
  "shopify",
  "independent_store",
]);
const aspectRatios = new Set<AspectRatio>([
  "original",
  "1:1",
  "4:5",
  "3:4",
  "16:9",
  "9:16",
  "long_page",
]);
const styles = new Set<VisualStyle>([
  "studio",
  "lifestyle",
  "premium",
  "minimal",
]);
const outputFormats = new Set<OutputFormat>(["png", "jpg", "webp"]);
const resolutions = new Set<GenerationResolution>(["1K", "2K", "4K"]);
const mainImageModules = new Set<MainImageModuleId>([
  "hero_kv",
  "overall_show",
  "detail_closeup",
  "use_scene",
  "color_set",
  "function_compare",
  "packaging",
  "trust",
]);
const detailPageModules = new Set<DetailPageModuleId>([
  "main_display",
  "brand_intro",
  "style_selling",
  "fabric_craft",
  "cutting",
  "color_size",
  "multi_color",
  "promotion",
  "specs",
  "care",
  "service",
  "faq",
  "buyer_show",
  "outfit_recommend",
  "scene_outfit",
  "blogger_outfit",
  "flat_lay",
  "hanger",
  "chapter",
]);
const whiteBackgroundModes = new Set<WhiteBackgroundMode>([
  "white_background",
  "ghost_model",
  "ai_background",
  "retouch",
  "outfit_change",
  "product_showcase",
  "pure_white",
  "transparent",
  "light_gray",
]);
const shadowModes = new Set<ShadowMode>(["natural", "none", "contact_shadow"]);
const statuses = new Set<TaskStatus>([
  "queued",
  "processing",
  "completed",
  "failed",
]);

export interface LoadTasksOptions {
  keepResumableTasks?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function readOptionalString(value: unknown): string | undefined {
  return isString(value) ? value : undefined;
}

function parseSelectedMainModules(value: unknown): MainImageModuleId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (moduleId): moduleId is MainImageModuleId =>
      isString(moduleId) && mainImageModules.has(moduleId as MainImageModuleId),
  );
}

function parseDetailModuleCounts(
  value: unknown,
): Partial<Record<DetailPageModuleId, number>> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Partial<Record<DetailPageModuleId, number>>>(
    (counts, [moduleId, count]) => {
      if (
        detailPageModules.has(moduleId as DetailPageModuleId) &&
        typeof count === "number" &&
        Number.isFinite(count) &&
        count > 0
      ) {
        counts[moduleId as DetailPageModuleId] = Math.floor(count);
      }

      return counts;
    },
    {},
  );
}

function parseProductInput(value: unknown): ProductInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, imageUrl, fileName, createdAt, source } = value;

  if (
    !isString(id) ||
    !isString(imageUrl) ||
    !isString(fileName) ||
    !isString(createdAt) ||
    !isString(source) ||
    !productSources.has(source as ProductSource)
  ) {
    return null;
  }

  return {
    id,
    imageUrl,
    fileName,
    createdAt,
    source: source as ProductSource,
  };
}

function parseConfig(value: unknown): GenerationConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    module,
    platform,
    aspectRatio,
    style,
    outputFormat,
    sellingPoints,
    specifications,
    outputLanguage,
    resolution,
    selectedMainModules,
    detailModuleCounts,
    whiteBackgroundMode,
    shadowMode,
  } = value;

  if (
    !isString(module) ||
    !modules.has(module as GenerationModule) ||
    !isString(platform) ||
    !platforms.has(platform as Platform) ||
    !isString(aspectRatio) ||
    !aspectRatios.has(aspectRatio as AspectRatio) ||
    !isString(style) ||
    !styles.has(style as VisualStyle) ||
    !isString(outputFormat) ||
    !outputFormats.has(outputFormat as OutputFormat) ||
    !isString(sellingPoints) ||
    !isString(specifications)
  ) {
    return null;
  }

  return {
    module: module as GenerationModule,
    platform: platform as Platform,
    aspectRatio: aspectRatio as AspectRatio,
    style: style as VisualStyle,
    outputFormat: outputFormat as OutputFormat,
    sellingPoints,
    specifications,
    outputLanguage: isString(outputLanguage) ? outputLanguage : "中文",
    resolution:
      isString(resolution) && resolutions.has(resolution as GenerationResolution)
        ? (resolution as GenerationResolution)
        : "1K",
    selectedMainModules: parseSelectedMainModules(selectedMainModules),
    detailModuleCounts: parseDetailModuleCounts(detailModuleCounts),
    whiteBackgroundMode:
      isString(whiteBackgroundMode) &&
      whiteBackgroundModes.has(whiteBackgroundMode as WhiteBackgroundMode)
        ? (whiteBackgroundMode as WhiteBackgroundMode)
        : "pure_white",
    shadowMode:
      isString(shadowMode) && shadowModes.has(shadowMode as ShadowMode)
        ? (shadowMode as ShadowMode)
        : "natural",
  };
}

function parseTask(value: unknown): GenerationTask | null {
  if (!isRecord(value)) {
    return null;
  }

  const productInput = parseProductInput(value.productInput);
  const config = parseConfig(value.config);
  const { id, status, resultUrls, creditCost, createdAt, attempt } = value;

  if (
    !isString(id) ||
    productInput === null ||
    config === null ||
    !isString(status) ||
    !statuses.has(status as TaskStatus) ||
    !Array.isArray(resultUrls) ||
    !resultUrls.every(isString) ||
    typeof creditCost !== "number" ||
    !isString(createdAt) ||
    typeof attempt !== "number"
  ) {
    return null;
  }

  const errorCode = readOptionalString(value.errorCode);
  const errorMessage = readOptionalString(value.errorMessage);
  const completedAt = readOptionalString(value.completedAt);
  const progress = readOptionalString(value.progress);
  const backendTaskId = readOptionalString(value.backendTaskId);

  return {
    id,
    productInput,
    config,
    status: status as TaskStatus,
    resultUrls,
    creditCost,
    createdAt,
    attempt,
    ...(errorCode ? { errorCode } : {}),
    ...(errorMessage ? { errorMessage } : {}),
    ...(completedAt ? { completedAt } : {}),
    ...(progress ? { progress } : {}),
    ...(backendTaskId ? { backendTaskId } : {}),
  };
}

function hasUnavailableUploadSource(task: GenerationTask): boolean {
  return (
    task.productInput.source === "upload" &&
    task.productInput.imageUrl.startsWith("blob:")
  );
}

function normalizeTask(
  task: GenerationTask,
  now: string,
  options: LoadTasksOptions,
): GenerationTask {
  if (hasUnavailableUploadSource(task)) {
    if (task.status === "completed") {
      return {
        ...task,
        ...UNAVAILABLE_UPLOAD_SOURCE_ERROR,
      };
    }

    return {
      ...task,
      status: "failed",
      ...UNAVAILABLE_UPLOAD_SOURCE_ERROR,
      completedAt: task.completedAt ?? now,
      creditCost: 0,
      resultUrls: [],
    };
  }

  if (task.status !== "queued" && task.status !== "processing") {
    return task;
  }

  if (
    options.keepResumableTasks === true &&
    task.status === "processing" &&
    task.backendTaskId
  ) {
    return task;
  }

  return {
    ...task,
    status: "failed",
    ...INTERRUPTED_TASK_ERROR,
    completedAt: task.completedAt ?? now,
    creditCost: 0,
    resultUrls: [],
  };
}

export function loadTasks(options: LoadTasksOptions = {}): GenerationTask[] {
  const storedTasks = localStorage.getItem(TASKS_STORAGE_KEY);

  if (storedTasks === null) {
    return [];
  }

  try {
    const parsedTasks = JSON.parse(storedTasks);
    if (!Array.isArray(parsedTasks)) {
      return [];
    }

    const now = new Date().toISOString();
    const normalizedTasks = parsedTasks
      .map(parseTask)
      .filter((task): task is GenerationTask => task !== null)
      .map((task) => normalizeTask(task, now, options));

    if (JSON.stringify(parsedTasks) !== JSON.stringify(normalizedTasks)) {
      saveTasks(normalizedTasks);
    }

    return normalizedTasks;
  } catch {
    return [];
  }
}

export function saveTasks(tasks: GenerationTask[]): void {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}
