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
import { buildGenerationTaskRequest, buildTaskListRequest } from "./apiContracts";
import { refreshKromaSession } from "./accountApi";
import {
  cancelKromaGenerationTask,
  resumeKromaGenerationTask,
  shouldUseKromaGenerationBackend,
  submitKromaGenerationTask,
} from "./kromaGenerationAdapter";
import { submitGenerationTask } from "./mockBackendClient";
import type { GenerationTaskResponse } from "./mockBackendClient";
import { requestRemoteJson, shouldUseRemoteBackend } from "./remoteBackendClient";

interface GenerationApiOptions {
  onProgress?: (progress: string) => void;
  onTaskStarted?: (
    backendTaskId: string,
    index?: number,
    total?: number,
  ) => void;
  shouldContinue?: () => boolean;
}

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
      errorMessage: "\u771f\u5b9e\u751f\u56fe\u540e\u7aef\u672a\u914d\u7f6e\uff0c\u8bf7\u8054\u7cfb\u652f\u6301\u3002",
    };
  }

  return submitGenerationTask(request);
}

export async function resumeGenerationTask(
  task: GenerationTask,
  options: GenerationApiOptions = {},
): Promise<GenerationResult> {
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

  const responses = await Promise.all(
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
  const response = responses.find((item) => item.status === "failed");

  if (response !== undefined) {
    throw new GenerationProviderError(
      response.errorCode ?? "unknown_generation_error",
      response.errorMessage ?? "\u751f\u6210\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002",
    );
  }

  const resultAssets = responses.flatMap((item, index) =>
    buildResultAssets(expandedInputs[index].config, item.resultUrls),
  );

  return {
    resultUrls: responses.flatMap((item) => item.resultUrls),
    resultAssets,
    creditCost: estimateGenerationCredits(task.config),
  };
}

export async function generateAsset(
  input: GenerateInput,
  options: GenerationApiOptions = {},
): Promise<GenerationResult> {
  const expandedInputs = expandGenerationInputs(input);
  const responses = await Promise.all(
    expandedInputs.map((generationInput, index) =>
      createGenerationTask(generationInput, {
        ...options,
        onTaskStarted: (backendTaskId) => {
          options.onTaskStarted?.(backendTaskId, index, expandedInputs.length);
        },
      }),
    ),
  );
  const response = responses.find((item) => item.status === "failed");

  if (response !== undefined) {
    throw new GenerationProviderError(
      response.errorCode ?? "unknown_generation_error",
      response.errorMessage ?? "\u751f\u6210\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002",
    );
  }

  const resultAssets = responses.flatMap((item, index) =>
    buildResultAssets(expandedInputs[index].config, item.resultUrls),
  );

  return {
    resultUrls: responses.flatMap((item) => item.resultUrls),
    resultAssets,
    creditCost: estimateGenerationCredits(input.config),
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
): GenerationResultAsset[] {
  const labels = buildGenerationPrompt(config).modules.map((module) => module.title);
  const fallbackLabel = labels[0] ?? "\u751f\u6210\u7ed3\u679c";

  return resultUrls.map((url, index) => ({
    url,
    label: labels[index] ?? fallbackLabel,
  }));
}

function expandGenerationInputs(input: GenerateInput): GenerateInput[] {
  return expandGenerationConfigs(input.config).map((config) => ({
    ...input,
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
    const modules = Object.entries(counts)
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

export async function listGenerationTasks(): Promise<GenerationTask[]> {
  const request = buildTaskListRequest();
  const localTasks = loadTasks({
    keepResumableTasks: shouldUseKromaGenerationBackend(),
  });

  if (shouldUseWebGenerationHistoryBackend()) {
    try {
      const cloudTasks = await requestWebGenerationJson<GenerationTask[]>(
        "/generations?limit=100",
        { method: "GET" },
      );

      return mergeGenerationTasks(cloudTasks, localTasks);
    } catch {
      return localTasks;
    }
  }

  if (shouldUseRemoteBackend()) {
    return requestRemoteJson<GenerationTask[]>(request);
  }

  return localTasks;
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
  return Boolean(getConfiguredWebGenerationApiBaseUrl() && getAccountAccessToken());
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

  let response = await fetch(
    `${baseUrl}${path}`,
    buildWebGenerationRequestInit(init, accessToken),
  );

  if (response.status === 401 || response.status === 403) {
    await response.text();
    const refreshedToken = await refreshKromaSession();

    if (refreshedToken) {
      response = await fetch(
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
