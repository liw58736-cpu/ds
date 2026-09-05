import { getStorageOwner } from "../storage/workspaceDraftStore";
import { fetchWithTimeout } from "./requestTimeout";
import { type GenerateInput } from "../providers/generationProvider";
import { GenerationProviderError } from "../providers/generationProvider";
import { estimateGenerationCredits } from "../domain/creditCost";
import { buildGenerationPrompt } from "../domain/promptBuilder";
import type {
  DetailPageModuleId,
  GenerationConfig,
  GenerationResult,
  GenerationResultAsset,
  GenerationTask,
  MainImageModuleId,
} from "../domain/types";
import { getAccountAccessToken } from "../storage/accountStore";
import { loadTasks, saveTasks } from "../storage/taskStore";
import {
  buildGenerationTaskRequest,
  buildTaskListRequest,
} from "./apiContracts";
import { refreshKromaSession } from "./accountApi";
import {
  cancelKromaGenerationTask,
  resumeKromaGenerationTask,
  shouldUseKromaGenerationBackend,
  submitKromaGenerationTask,
} from "./kromaGenerationAdapter";
import { submitGenerationTask } from "./mockBackendClient";
import type { GenerationTaskResponse } from "./mockBackendClient";
import {
  requestRemoteJson,
  shouldUseRemoteBackend,
} from "./remoteBackendClient";

interface GenerationApiOptions {
  onProgress?: (progress: string) => void;
  onTaskStarted?: (
    backendTaskId: string,
    index?: number,
    total?: number,
  ) => void;
  shouldContinue?: () => boolean;
}

interface ListGenerationTasksOptions {
  offset?: number;
  strict?: boolean;
  limit?: number;
}

const defaultRecentTaskLimit = 30;
const maxTaskHistoryLimit = 100;

export async function createGenerationTask(
  input: GenerateInput,
  options: GenerationApiOptions = {},
): Promise<GenerationTaskResponse> {
  const request = buildGenerationTaskRequest(input);

  if (shouldUseKromaGenerationBackend()) {
    return submitKromaGenerationTask(request, {
      onProgress: options.onProgress,
      onTaskStarted: options.onTaskStarted,
      shouldContinue: options.shouldContinue,
    });
  }

  if (shouldUseRemoteBackend()) {
    return requestRemoteJson<GenerationTaskResponse>(request);
  }

  if (import.meta.env.PROD) {
    return {
      taskId: `generation-backend-unconfigured-${Date.now()}`,
      status: "failed",
      resultUrls: [],
      creditCost: 0,
      routeMode: request.body.routeMode,
      errorCode: "generation_backend_unconfigured",
      errorMessage:
        "\u771f\u5b9e\u751f\u56fe\u540e\u7aef\u672a\u914d\u7f6e\uff0c\u8bf7\u8054\u7cfb\u652f\u6301\u3002",
    };
  }

  return submitGenerationTask(request);
}

export async function resumeGenerationTask(
  task: GenerationTask,
  options: GenerationApiOptions = {},
): Promise<GenerationResult> {
  if (task.billingManaged) return resumeManagedGeneration(task, options);
  const expandedInputs = expandGenerationInputs({
    product: task.productInput,
    config: task.config,
  });
  const backendTaskIds = getResumeBackendTaskIds(task, expandedInputs.length);

  if (backendTaskIds.length !== expandedInputs.length) {
    throw new GenerationProviderError(
      "missing_backend_task_ids",
      "\u7f3a\u5c11\u5b8c\u6574\u540e\u7aef\u4efb\u52a1\u7f16\u53f7\uff0c\u8bf7\u91cd\u65b0\u751f\u6210\u3002",
    );
  }

  if (!shouldUseKromaGenerationBackend()) {
    throw new GenerationProviderError(
      "backend_resume_unavailable",
      "\u5f53\u524d\u672a\u8fde\u63a5\u771f\u5b9e\u751f\u56fe\u540e\u7aef\uff0c\u8bf7\u91cd\u65b0\u751f\u6210\u3002",
    );
  }

  const responses = await Promise.allSettled(
    expandedInputs.map((generationInput, index) =>
      resumeKromaGenerationTask(
        buildGenerationTaskRequest(generationInput),
        backendTaskIds[index],
        {
          onProgress: options.onProgress,
          shouldContinue: options.shouldContinue,
        },
      ),
    ),
  );
  return combineGenerationResponses(responses, expandedInputs, task.config);
}

async function resumeManagedGeneration(
  task: GenerationTask,
  options: GenerationApiOptions,
): Promise<GenerationResult> {
  const owner = getStorageOwner();
  const deadline = Date.now() + 30 * 60 * 1000;
  while (Date.now() < deadline) {
    if (getStorageOwner() !== owner || options.shouldContinue?.() === false)
      throw new GenerationProviderError("generation_cancelled", "任务查询已停止。");
    let rows: GenerationTask[] = [];
    try {
      rows = await requestWebGenerationJson<GenerationTask[]>(
        `/generations?group_id=${encodeURIComponent(task.id)}`, { method: "GET" },
      );
    } catch {
      options.onProgress?.("正在恢复任务连接");
    }
    const current = rows.find((row) => row.id === task.id);
    if (current?.status === "completed" || current?.status === "partial") {
      return {
        resultUrls: current.resultUrls,
        resultAssets: current.resultAssets,
        failedItems: current.failedItems,
        creditCost: current.creditCost,
        billingManaged: true,
      };
    }
    if (current?.status === "failed")
      throw new GenerationProviderError("generation_failed", current.errorMessage || current.failedItems?.[0]?.error || "生成失败，请重试。");
    if (current) options.onProgress?.(current.progress || "正在生成图片");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new GenerationProviderError("generation_timeout", "任务仍在后台处理中，请稍后在任务中心查看。");
}

export async function generateAsset(
  input: GenerateInput,
  options: GenerationApiOptions = {},
): Promise<GenerationResult> {
  const expandedInputs = expandGenerationInputs({
    ...input,
    groupId: input.groupId || crypto.randomUUID(),
  });
  const responses = await Promise.allSettled(
    expandedInputs.map((generationInput, index) =>
      createGenerationTask(generationInput, {
        ...options,
        onTaskStarted: (backendTaskId) => {
          options.onTaskStarted?.(backendTaskId, index, expandedInputs.length);
        },
      }),
    ),
  );
  return combineGenerationResponses(responses, expandedInputs, input.config);
}

function combineGenerationResponses(
  responses: PromiseSettledResult<GenerationTaskResponse>[],
  inputs: GenerateInput[],
  config: GenerationConfig,
): GenerationResult {
  const failedItems: NonNullable<GenerationResult["failedItems"]> = [];
  const resultAssets: GenerationResultAsset[] = [];
  let cost = 0;
  let managed = true;
  responses.forEach((settled, index) => {
    const item = settled.status === "fulfilled" ? settled.value : null;
    const label =
      buildGenerationPrompt(inputs[index].config).modules[0]?.title ||
      "生成图片";
    if (!item || item.status === "failed") {
      failedItems.push({
        index,
        label,
        config: inputs[index].config,
        error:
          item?.errorMessage ||
          (settled.status === "rejected"
            ? String(settled.reason?.message || "请求失败")
            : "生成失败"),
      });
      return;
    }
    resultAssets.push(
      ...buildResultAssets(
        inputs[index].config,
        item.resultUrls,
        item.channelUsed,
      ),
    );
    managed = managed && Boolean(item.billingManaged);
    cost += item.creditCost;
  });
  if (!resultAssets.length) {
    const first = responses.find((r) => r.status === "fulfilled");
    throw new GenerationProviderError(
      first?.status === "fulfilled"
        ? first.value.errorCode || "generation_failed"
        : "generation_failed",
      failedItems[0]?.error || "生成失败",
    );
  }
  const legacyCost =
    resultAssets.length *
    { "1K": 1, "2K": 2, "4K": 4 }[config.resolution || "1K"];
  return {
    resultUrls: resultAssets.map((asset) => asset.url),
    resultAssets,
    failedItems,
    billingManaged: managed,
    ...buildChannelMetadata(
      resultAssets.map((asset) => asset.channelUsed || "").filter(Boolean),
    ),
    creditCost: managed ? cost : legacyCost,
  };
}

function getResumeBackendTaskIds(
  task: GenerationTask,
  expectedCount: number,
): string[] {
  if (
    task.backendTaskIds &&
    task.backendTaskIds.length === expectedCount &&
    task.backendTaskIds.every((taskId) => taskId.trim())
  ) {
    return task.backendTaskIds;
  }

  if (task.backendTaskId && expectedCount === 1) {
    return [task.backendTaskId];
  }

  return [];
}

function buildResultAssets(
  config: GenerationConfig,
  resultUrls: string[],
  channelUsed?: string,
): GenerationResultAsset[] {
  const labels = buildGenerationPrompt(config).modules.map(
    (module) => module.title,
  );
  const fallbackLabel = labels[0] ?? "\u751f\u6210\u7ed3\u679c";

  return resultUrls.map((url, index) => ({
    url,
    label: labels[index] ?? fallbackLabel,
    ...(channelUsed ? { channelUsed } : {}),
  }));
}

function buildChannelMetadata(
  channelUsedByAsset: string[],
): Pick<GenerationResult, "channelUsed" | "channelUsedByAsset"> {
  if (channelUsedByAsset.length === 0) {
    return {};
  }

  return {
    channelUsedByAsset,
    channelUsed: [...new Set(channelUsedByAsset)].join(" / "),
  };
}

function expandGenerationInputs(input: GenerateInput): GenerateInput[] {
  return expandGenerationConfigs(input.config).map((config, index, all) => ({
    ...input,
    requestIndex: index,
    requestTotal: all.length,
    groupConfig: input.config,
    config,
  }));
}

function expandGenerationConfigs(config: GenerationConfig): GenerationConfig[] {
  if (config.module === "main_image") {
    const modules =
      config.selectedMainModules && config.selectedMainModules.length > 0
        ? config.selectedMainModules
        : (["hero_kv"] satisfies MainImageModuleId[]);

    return modules.map((moduleId) => ({
      ...config,
      selectedMainModules: [moduleId],
    }));
  }

  if (config.module === "detail_page") {
    const counts = config.detailModuleCounts ?? {};
    const order = config.detailModuleOrder || Object.keys(counts);
    const modules = Object.entries(counts)
      .sort(
        ([a], [b]) =>
          order.indexOf(a as DetailPageModuleId) -
          order.indexOf(b as DetailPageModuleId),
      )
      .filter((entry): entry is [DetailPageModuleId, number] => entry[1] > 0)
      .flatMap(([moduleId, count]) =>
        Array.from({ length: Math.floor(count) }, () => moduleId),
      );
    const selectedModules =
      modules.length > 0
        ? modules
        : (["main_display"] satisfies DetailPageModuleId[]);

    return selectedModules.map((moduleId) => ({
      ...config,
      detailModuleCounts: { [moduleId]: 1 },
    }));
  }

  return [config];
}

export async function cancelGenerationTask(
  task: GenerationTask,
): Promise<boolean> {
  const taskIds = [
    ...(task.backendTaskIds ?? []),
    ...(task.backendTaskId ? [task.backendTaskId] : []),
  ].filter(
    (taskId, index, taskIds) =>
      Boolean(taskId.trim()) && taskIds.indexOf(taskId) === index,
  );

  if (taskIds.length === 0 || !shouldUseKromaGenerationBackend()) {
    return false;
  }

  const results = await Promise.all(
    taskIds.map((taskId) => cancelKromaGenerationTask(taskId)),
  );

  return results.some(Boolean);
}

export async function listGenerationTasks(
  options: ListGenerationTasksOptions = {},
): Promise<GenerationTask[]> {
  const request = buildTaskListRequest();
  const requestOwner = getStorageOwner();
  const localTasks = loadTasks({
    keepResumableTasks: shouldUseKromaGenerationBackend(),
  });
  const limit = clampTaskHistoryLimit(options.limit);

  if (shouldUseWebGenerationHistoryBackend()) {
    try {
      const cloudTasks = await requestWebGenerationJson<GenerationTask[]>(
        `/generations?limit=${limit}${options.offset ? `&offset=${options.offset}` : ""}`,
        { method: "GET" },
      );

      if (getStorageOwner() !== requestOwner) return [];
      return options.offset
        ? cloudTasks
        : mergeGenerationTasks(cloudTasks, localTasks);
    } catch (error) {
      if (options.strict) throw error;
      return localTasks;
    }
  }

  if (shouldUseRemoteBackend()) {
    return requestRemoteJson<GenerationTask[]>(request);
  }

  return localTasks;
}

function clampTaskHistoryLimit(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultRecentTaskLimit;
  }

  return Math.max(1, Math.min(maxTaskHistoryLimit, Math.floor(value)));
}

export function getGenerationTaskSnapshot(): GenerationTask[] {
  return loadTasks({ keepResumableTasks: shouldUseKromaGenerationBackend() });
}

export async function saveGenerationTasks(
  tasks: GenerationTask[],
): Promise<void> {
  saveTasks(tasks);
}

export async function saveGenerationTaskHistory(
  task: GenerationTask,
): Promise<void> {
  if (!shouldUseWebGenerationHistoryBackend()) {
    return;
  }

  try {
    await requestWebGenerationJson<{ saved: boolean; task: GenerationTask }>(
      "/generations",
      {
        method: "POST",
        body: JSON.stringify(task),
      },
    );
  } catch {
    // Local history remains the immediate fallback; cloud history should not
    // interrupt generation completion.
  }
}

function mergeGenerationTasks(
  cloudTasks: GenerationTask[],
  localTasks: GenerationTask[],
): GenerationTask[] {
  const cloudTaskIds = new Set(cloudTasks.map((task) => task.id));

  return [
    ...cloudTasks,
    ...localTasks.filter((task) => !cloudTaskIds.has(task.id)),
  ];
}

function getConfiguredWebGenerationApiBaseUrl(): string | null {
  const value = import.meta.env.VITE_WEB_API_BASE_URL?.trim();

  if (!value) {
    return null;
  }

  return value.replace(/\/+$/, "");
}

function shouldUseWebGenerationHistoryBackend(): boolean {
  return Boolean(
    getConfiguredWebGenerationApiBaseUrl() && getAccountAccessToken(),
  );
}

async function requestWebGenerationJson<Payload>(
  path: string,
  init: RequestInit,
): Promise<Payload> {
  const baseUrl = getConfiguredWebGenerationApiBaseUrl();
  const accessToken = getAccountAccessToken();

  if (!baseUrl || !accessToken) {
    throw new Error("Web generation history backend is not configured.");
  }

  let response = await fetchWithTimeout(
    `${baseUrl}${path}`,
    buildWebGenerationRequestInit(init, accessToken),
  );

  if (response.status === 401 || response.status === 403) {
    await response.text();
    const refreshedToken = await refreshKromaSession();

    if (refreshedToken) {
      response = await fetchWithTimeout(
        `${baseUrl}${path}`,
        buildWebGenerationRequestInit(init, refreshedToken),
      );
    }
  }

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Web generation history request failed: ${response.status} ${text}`,
    );
  }

  return response.json() as Promise<Payload>;
}

function buildWebGenerationRequestInit(
  init: RequestInit,
  accessToken: string,
): RequestInit {
  return {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Kroma-Client": "web",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  };
}
