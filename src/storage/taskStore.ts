import type {
  AspectRatio,
  GenerationConfig,
  GenerationModule,
  GenerationTask,
  OutputFormat,
  Platform,
  ProductInput,
  ProductSource,
  TaskStatus,
  VisualStyle,
} from "../domain/types";

const TASKS_STORAGE_KEY = "commerce-studio-tasks-v1";
const INTERRUPTED_TASK_ERROR = {
  errorCode: "task_interrupted",
  errorMessage: "任务在上次会话中断，请重新生成。",
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
  "1:1",
  "4:5",
  "16:9",
  "long_page",
]);
const styles = new Set<VisualStyle>([
  "studio",
  "lifestyle",
  "premium",
  "minimal",
]);
const outputFormats = new Set<OutputFormat>(["png", "jpg", "webp"]);
const statuses = new Set<TaskStatus>([
  "queued",
  "processing",
  "completed",
  "failed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function readOptionalString(value: unknown): string | undefined {
  return isString(value) ? value : undefined;
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

  return {
    id,
    productInput,
    config,
    status: status as TaskStatus,
    resultUrls,
    errorCode: readOptionalString(value.errorCode),
    errorMessage: readOptionalString(value.errorMessage),
    creditCost,
    createdAt,
    completedAt: readOptionalString(value.completedAt),
    attempt,
  };
}

function normalizeTask(task: GenerationTask, now: string): GenerationTask {
  if (task.status !== "queued" && task.status !== "processing") {
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

export function loadTasks(): GenerationTask[] {
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
      .map((task) => normalizeTask(task, now));

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
