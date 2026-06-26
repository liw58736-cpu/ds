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
import { loadTasks, saveTasks } from "../storage/taskStore";
import { buildGenerationTaskRequest, buildTaskListRequest } from "./apiContracts";
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
  onTaskStarted?: (backendTaskId: string) => void;
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
      errorMessage: "真实生图后端未配置，请联系支持。",
    };
  }

  return submitGenerationTask(request);
}

export async function resumeGenerationTask(
  task: GenerationTask,
  options: GenerationApiOptions = {},
): Promise<GenerationResult> {
  if (!task.backendTaskId) {
    throw new GenerationProviderError(
      "missing_backend_task_id",
      "缺少后端任务编号，请重新生成。",
    );
  }

  if (!shouldUseKromaGenerationBackend()) {
    throw new GenerationProviderError(
      "backend_resume_unavailable",
      "当前未连接真实生图后端，请重新生成。",
    );
  }

  const response = await resumeKromaGenerationTask(
    buildGenerationTaskRequest({
      product: task.productInput,
      config: task.config,
    }),
    task.backendTaskId,
    {
      onProgress: options.onProgress,
      shouldContinue: options.shouldContinue,
    },
  );

  if (response.status === "failed") {
    throw new GenerationProviderError(
      response.errorCode ?? "unknown_generation_error",
      response.errorMessage ?? "生成失败，请重试。",
    );
  }

  return {
    resultUrls: response.resultUrls,
    resultAssets: buildResultAssets(task.config, response.resultUrls),
    creditCost: response.creditCost,
  };
}

export async function generateAsset(
  input: GenerateInput,
  options: GenerationApiOptions = {},
): Promise<GenerationResult> {
  const expandedInputs = expandGenerationInputs(input);
  const responses = await Promise.all(
    expandedInputs.map((generationInput) =>
      createGenerationTask(generationInput, options),
    ),
  );
  const response = responses.find((item) => item.status === "failed");

  if (response !== undefined) {
    throw new GenerationProviderError(
      response.errorCode ?? "unknown_generation_error",
      response.errorMessage ?? "生成失败，请重试。",
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

function buildResultAssets(
  config: GenerationConfig,
  resultUrls: string[],
): GenerationResultAsset[] {
  const labels = buildGenerationPrompt(config).modules.map((module) => module.title);
  const fallbackLabel = labels[0] ?? "生成结果";

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
  if (!task.backendTaskId || !shouldUseKromaGenerationBackend()) {
    return false;
  }

  return cancelKromaGenerationTask(task.backendTaskId);
}

export async function listGenerationTasks(): Promise<GenerationTask[]> {
  const request = buildTaskListRequest();

  if (shouldUseRemoteBackend()) {
    return requestRemoteJson<GenerationTask[]>(request);
  }

  return loadTasks({ keepResumableTasks: shouldUseKromaGenerationBackend() });
}

export function getGenerationTaskSnapshot(): GenerationTask[] {
  return loadTasks({ keepResumableTasks: shouldUseKromaGenerationBackend() });
}

export async function saveGenerationTasks(
  tasks: GenerationTask[],
): Promise<void> {
  saveTasks(tasks);
}
