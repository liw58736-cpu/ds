import type { GenerationTaskResponse } from "./mockBackendClient";
import type { GenerationTaskCreateRequest } from "./apiContracts";
import type { AspectRatio, GenerationResolution } from "../domain/types";
import { getAccountAccessToken } from "../storage/accountStore";
import { refreshKromaSession } from "./accountApi";

export interface KromaGenerateRequest {
  prompt: string;
  task_type: "ecommerce" | "image_edit";
  style: string;
  image_url?: string;
  image_base64?: string;
  template_image_base64?: string;
  template_image_base64s?: string[];
  size: string;
  quality: "standard" | "2k" | "4k";
  use_template_mode: boolean;
  keep_user_outfit_pose: boolean;
}

interface KromaTaskResponse {
  task_id: string;
  status: "pending" | "processing" | "done" | "error";
  image_url?: string | null;
  image_base64?: string | null;
  channel_used?: string | null;
  error?: string | null;
  progress?: string | null;
}

interface KromaGenerationSubmitOptions {
  pollIntervalMs?: number;
  maxPolls?: number;
  onProgress?: (progress: string) => void;
  onTaskStarted?: (taskId: string) => void;
  shouldContinue?: () => boolean;
}

export function getConfiguredKromaApiBaseUrl(): string | null {
  const value =
    import.meta.env.VITE_KROMA_API_BASE_URL?.trim() ||
    import.meta.env.VITE_WEB_API_BASE_URL?.trim();

  if (!value) {
    return null;
  }

  return value.replace(/\/+$/, "");
}

export function shouldUseKromaGenerationBackend(): boolean {
  return getConfiguredKromaApiBaseUrl() !== null;
}

export function buildKromaGenerateRequest(
  request: GenerationTaskCreateRequest,
  imageInput: Pick<KromaGenerateRequest, "image_url" | "image_base64"> = getDirectImageInput(
    request.body.product.imageUrl,
  ),
): KromaGenerateRequest {
  const { config, prompt, routeMode, route } = request.body;
  const moduleReferenceImageInput = getModuleReferenceImageInput(request);
  const hasModuleReferenceImages =
    Boolean(moduleReferenceImageInput.template_image_base64) ||
    Boolean(moduleReferenceImageInput.template_image_base64s?.length);

  return {
    prompt: prompt.finalPrompt,
    task_type: "ecommerce",
    style: buildKromaStyle(config, routeMode),
    ...imageInput,
    ...moduleReferenceImageInput,
    size: getKromaSize(config.aspectRatio, config.resolution),
    quality: route.quality,
    use_template_mode: hasModuleReferenceImages,
    keep_user_outfit_pose: false,
  };
}

function getModuleReferenceImageInput(
  request: GenerationTaskCreateRequest,
): Pick<KromaGenerateRequest, "template_image_base64" | "template_image_base64s"> {
  const moduleIds = request.body.prompt.modules.map((module) => module.id);
  const imageUrls = moduleIds
    .flatMap((moduleId) =>
      (request.body.config.moduleReferenceAssets?.[moduleId] ?? [])
        .map((asset) => asset.imageUrl.trim())
        .filter(Boolean),
    );

  if (imageUrls.length === 0) {
    return {};
  }

  return {
    template_image_base64: imageUrls[0],
    template_image_base64s: imageUrls,
  };
}

function buildKromaStyle(
  config: GenerationTaskCreateRequest["body"]["config"],
  routeMode: GenerationTaskCreateRequest["body"]["routeMode"],
): string {
  if (config.module === "white_background") {
    return `${config.module}:${config.whiteBackgroundMode ?? "white_background"}:${routeMode}`;
  }

  return `${config.module}:${routeMode}`;
}

export async function submitKromaGenerationTask(
  request: GenerationTaskCreateRequest,
  options: KromaGenerationSubmitOptions = {},
): Promise<GenerationTaskResponse> {
  const baseUrl = getConfiguredKromaApiBaseUrl();

  if (!baseUrl) {
    throw new Error("Kroma image backend URL is not configured.");
  }

  const body = JSON.stringify(
    buildKromaGenerateRequest(
      request,
      await resolveKromaImageInput(request.body.product.imageUrl),
    ),
  );
  const response = await fetchKromaWithAuthRefresh(`${baseUrl}/image/generate`, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    const text = await response.text();

    return failedKromaTask(request, `HTTP ${response.status}: ${text}`);
  }

  const data = (await response.json()) as KromaTaskResponse;
  options.onTaskStarted?.(data.task_id);

  return pollKromaTaskUntilComplete(request, baseUrl, data, options);
}

export async function resumeKromaGenerationTask(
  request: GenerationTaskCreateRequest,
  backendTaskId: string,
  options: KromaGenerationSubmitOptions = {},
): Promise<GenerationTaskResponse> {
  const baseUrl = getConfiguredKromaApiBaseUrl();

  if (!baseUrl) {
    throw new Error("Kroma image backend URL is not configured.");
  }

  const initialTask = await fetchKromaTask(request, baseUrl, backendTaskId);

  if (initialTask.status === "failed") {
    return initialTask.task;
  }

  return pollKromaTaskUntilComplete(
    request,
    baseUrl,
    initialTask.task,
    options,
  );
}

export async function cancelKromaGenerationTask(
  backendTaskId: string,
): Promise<boolean> {
  const baseUrl = getConfiguredKromaApiBaseUrl();

  if (!baseUrl) {
    return false;
  }

  try {
    const response = await fetchKromaWithAuthRefresh(
      `${baseUrl}/image/task/${backendTaskId}/cancel`,
      { method: "POST" },
    );

    return response.ok;
  } catch {
    return false;
  }
}

async function pollKromaTaskUntilComplete(
  request: GenerationTaskCreateRequest,
  baseUrl: string,
  initialTask: KromaTaskResponse,
  options: KromaGenerationSubmitOptions,
): Promise<GenerationTaskResponse> {
  let task = initialTask;
  const maxPolls = options.maxPolls ?? 360;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;

  for (let poll = 0; poll <= maxPolls; poll += 1) {
    notifyProgress(task, options.onProgress);

    if (task.status === "done") {
      return completedKromaTask(request, task);
    }

    if (task.status === "error") {
      return failedKromaTask(
        request,
        task.error ?? "Reference image backend returned a failed generation.",
        task.task_id,
      );
    }

    if (poll === maxPolls) {
      return failedKromaTask(
        request,
        "Reference image backend task polling timed out.",
        task.task_id,
      );
    }

    if (options.shouldContinue?.() === false) {
      return failedKromaTask(request, "Task polling stopped.", task.task_id);
    }

    if (pollIntervalMs > 0) {
      await wait(pollIntervalMs);
    }

    if (options.shouldContinue?.() === false) {
      return failedKromaTask(request, "Task polling stopped.", task.task_id);
    }

    const nextTask = await fetchKromaTask(request, baseUrl, task.task_id);

    if (nextTask.status === "failed") {
      return nextTask.task;
    }

    task = nextTask.task;
  }

  return failedKromaTask(
    request,
    "Reference image backend task polling timed out.",
    task.task_id,
  );
}

async function fetchKromaTask(
  request: GenerationTaskCreateRequest,
  baseUrl: string,
  taskId: string,
): Promise<
  | { status: "ok"; task: KromaTaskResponse }
  | { status: "failed"; task: GenerationTaskResponse }
> {
  const pollResponse = await fetchKromaWithAuthRefresh(
    `${baseUrl}/image/task/${taskId}`,
    {
      method: "GET",
    },
  );

  if (!pollResponse.ok) {
    const text = await pollResponse.text();

    return {
      status: "failed",
      task: failedKromaTask(
        request,
        `Task polling failed: HTTP ${pollResponse.status}: ${text}`,
        taskId,
      ),
    };
  }

  return {
    status: "ok",
    task: (await pollResponse.json()) as KromaTaskResponse,
  };
}

function notifyProgress(
  task: KromaTaskResponse,
  onProgress: KromaGenerationSubmitOptions["onProgress"],
): void {
  if (task.progress) {
    onProgress?.(task.progress);
  }
}

function completedKromaTask(
  request: GenerationTaskCreateRequest,
  task: KromaTaskResponse,
): GenerationTaskResponse {
  const resultUrl = normalizeKromaResultUrl(task);

  if (!resultUrl) {
    return failedKromaTask(
      request,
      "Reference image backend did not return an image.",
      task.task_id,
    );
  }

  return {
    taskId: task.task_id,
    status: "completed",
    resultUrls: [resultUrl],
    creditCost: request.body.billing.estimatedCreditCost,
    routeMode: request.body.routeMode,
  };
}

function failedKromaTask(
  request: GenerationTaskCreateRequest,
  errorMessage: string,
  taskId = createKromaTaskId(),
): GenerationTaskResponse {
  return {
    taskId,
    status: "failed",
    resultUrls: [],
    creditCost: 0,
    routeMode: request.body.routeMode,
    errorCode: "kroma_generation_failed",
    errorMessage,
  };
}

function normalizeKromaResultUrl(response: KromaTaskResponse): string | null {
  if (response.image_url) {
    return response.image_url;
  }

  if (!response.image_base64) {
    return null;
  }

  if (response.image_base64.startsWith("data:")) {
    return response.image_base64;
  }

  return `data:image/png;base64,${response.image_base64}`;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

function getDirectImageInput(
  imageUrl: string,
): Pick<KromaGenerateRequest, "image_url" | "image_base64"> {
  if (imageUrl.startsWith("data:")) {
    return { image_base64: imageUrl };
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return { image_url: imageUrl };
  }

  return { image_url: imageUrl };
}

async function resolveKromaImageInput(
  imageUrl: string,
): Promise<Pick<KromaGenerateRequest, "image_url" | "image_base64">> {
  const directInput = getDirectImageInput(imageUrl);

  if (directInput.image_base64 || directInput.image_url?.startsWith("http")) {
    return directInput;
  }

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return directInput;
    }

    const contentType = response.headers.get("Content-Type") ?? "image/png";
    const buffer = await response.arrayBuffer();

    return {
      image_base64: `data:${contentType};base64,${arrayBufferToBase64(buffer)}`,
    };
  } catch {
    return directInput;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return globalThis.btoa(binary);
}

function getKromaSize(
  aspectRatio: AspectRatio,
  resolution: GenerationResolution = "1K",
): string {
  const sizes: Record<GenerationResolution, Record<AspectRatio, string>> = {
    "1K": {
      original: "1024x1024",
      "1:1": "1024x1024",
      "4:5": "1024x1280",
      "3:4": "1024x1365",
      "16:9": "1024x576",
      "9:16": "1024x1820",
      long_page: "1024x1536",
    },
    "2K": {
      original: "2048x2048",
      "1:1": "2048x2048",
      "4:5": "2048x2560",
      "3:4": "2048x2730",
      "16:9": "2048x1152",
      "9:16": "2048x3640",
      long_page: "1536x3072",
    },
    "4K": {
      original: "2880x2880",
      "1:1": "2880x2880",
      "4:5": "2560x3200",
      "3:4": "2880x3840",
      "16:9": "3840x2160",
      "9:16": "2160x3840",
      long_page: "2160x3840",
    },
  };

  return sizes[resolution][aspectRatio];
}

function createKromaTaskId(): string {
  return `kroma-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function fetchKromaWithAuthRefresh(
  url: string,
  init: Omit<RequestInit, "headers">,
): Promise<Response> {
  const response = await fetch(url, buildKromaRequestInit(init));

  if (!isExpiredAuthResponse(response)) {
    return response;
  }

  await response.text();
  const freshToken = await refreshKromaSession();

  if (!freshToken) {
    return new Response(
      JSON.stringify({ detail: "登录已过期，请重新登录。" }),
      {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return fetch(url, buildKromaRequestInit(init, freshToken));
}

function buildKromaRequestInit(
  init: Omit<RequestInit, "headers">,
  accessToken = getAccountAccessToken(),
): RequestInit {
  return {
    ...init,
    headers: buildKromaHeaders(accessToken),
  };
}

function isExpiredAuthResponse(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

function buildKromaHeaders(accessToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Kroma-Client": "web",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}
