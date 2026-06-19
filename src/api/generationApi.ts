import { type GenerateInput } from "../providers/generationProvider";
import { GenerationProviderError } from "../providers/generationProvider";
import type { GenerationResult, GenerationTask } from "../domain/types";
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
    creditCost: response.creditCost,
  };
}

export async function generateAsset(
  input: GenerateInput,
  options: GenerationApiOptions = {},
): Promise<GenerationResult> {
  const response = await createGenerationTask(input, options);

  if (response.status === "failed") {
    throw new GenerationProviderError(
      response.errorCode ?? "unknown_generation_error",
      response.errorMessage ?? "生成失败，请重试。",
    );
  }

  return {
    resultUrls: response.resultUrls,
    creditCost: response.creditCost,
  };
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
