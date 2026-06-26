import type {
  GenerationConfig,
  GenerationResultAsset,
  GenerationTask,
  ProductInput,
  TaskStatus,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function assertStatus(
  task: GenerationTask,
  expected: TaskStatus,
  action: string,
): void {
  if (task.status !== expected) {
    throw new Error(
      `Cannot ${action} task from ${task.status} status; expected ${expected}.`,
    );
  }
}

export function createTask(input: {
  product: ProductInput;
  config: GenerationConfig;
  now: string;
}): GenerationTask {
  return {
    id: createId("task"),
    productInput: input.product,
    config: input.config,
    status: "queued",
    resultUrls: [],
    creditCost: 0,
    createdAt: input.now,
    attempt: 1,
  };
}

export function markProcessing(task: GenerationTask): GenerationTask {
  assertStatus(task, "queued", "process");

  return {
    ...task,
    status: "processing",
    progress: "正在准备生成",
  };
}

export function updateTaskProgress(
  task: GenerationTask,
  progress: string,
): GenerationTask {
  assertStatus(task, "processing", "update progress");

  return {
    ...task,
    progress,
  };
}

export function completeTask(
  task: GenerationTask,
  input: {
    resultUrls: string[];
    resultAssets?: GenerationResultAsset[];
    completedAt: string;
    creditCost: number;
  },
): GenerationTask {
  assertStatus(task, "processing", "complete");

  const {
    errorCode: _errorCode,
    errorMessage: _errorMessage,
    progress: _progress,
    ...rest
  } = task;

  return {
    ...rest,
    status: "completed",
    resultUrls: input.resultUrls,
    ...(input.resultAssets ? { resultAssets: input.resultAssets } : {}),
    completedAt: input.completedAt,
    creditCost: input.creditCost,
  };
}

export function failTask(
  task: GenerationTask,
  input: { errorCode: string; errorMessage: string; completedAt: string },
): GenerationTask {
  assertStatus(task, "processing", "fail");
  const { resultAssets: _resultAssets, ...rest } = task;

  return {
    ...rest,
    status: "failed",
    resultUrls: [],
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    progress: undefined,
    completedAt: input.completedAt,
    creditCost: 0,
  };
}

export function retryTask(task: GenerationTask, now: string): GenerationTask {
  assertStatus(task, "failed", "retry");

  const {
    errorCode: _errorCode,
    errorMessage: _errorMessage,
    progress: _progress,
    completedAt: _completedAt,
    backendTaskId: _backendTaskId,
    backendTaskIds: _backendTaskIds,
    resultAssets: _resultAssets,
    ...rest
  } = task;

  return {
    ...rest,
    status: "queued",
    resultUrls: [],
    creditCost: 0,
    createdAt: now,
    attempt: task.attempt + 1,
  };
}
