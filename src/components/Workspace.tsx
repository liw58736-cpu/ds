import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultConfig } from "../domain/defaults";
import {
  completeTask,
  createTask,
  failTask,
  markProcessing,
  retryTask,
} from "../domain/taskState";
import type {
  GenerationConfig,
  GenerationModule,
  GenerationTask,
  ProductInput,
} from "../domain/types";
import {
  GenerationProviderError,
  MockGenerationProvider,
} from "../providers/generationProvider";
import { loadTasks, saveTasks } from "../storage/taskStore";
import { ModuleNav } from "./ModuleNav";
import { ParameterPanel } from "./ParameterPanel";
import { ResultPreview } from "./ResultPreview";
import { TaskHistory } from "./TaskHistory";
import { UploadPanel } from "./UploadPanel";

function moveTaskToTop(
  tasks: GenerationTask[],
  nextTask: GenerationTask,
): GenerationTask[] {
  return [nextTask, ...tasks.filter((task) => task.id !== nextTask.id)];
}

function getFailureDetails(error: unknown): {
  errorCode: string;
  errorMessage: string;
} {
  if (error instanceof GenerationProviderError) {
    return {
      errorCode: error.code,
      errorMessage: error.message,
    };
  }

  return {
    errorCode: "unknown_generation_error",
    errorMessage: "生成失败，请重试。",
  };
}

function hasUnavailableUploadSource(task: GenerationTask): boolean {
  return task.errorCode === "upload_source_unavailable";
}

export function Workspace() {
  const [config, setConfig] = useState<GenerationConfig>(defaultConfig);
  const [product, setProduct] = useState<ProductInput | null>(null);
  const [tasks, setTasks] = useState<GenerationTask[]>(() => loadTasks());
  const [activePreviewTaskId, setActivePreviewTaskId] = useState<
    string | null | undefined
  >(undefined);
  const provider = useMemo(() => new MockGenerationProvider({ delayMs: 20 }), []);
  const productRef = useRef<ProductInput | null>(null);
  const latestTask = tasks[0];
  const activePreviewTask =
    activePreviewTaskId === undefined
      ? latestTask
      : activePreviewTaskId === null
        ? undefined
        : tasks.find((task) => task.id === activePreviewTaskId);
  const hasRunningLatestTask =
    latestTask?.status === "queued" || latestTask?.status === "processing";

  const revokeUploadedProduct = (productToRevoke: ProductInput | null) => {
    if (productToRevoke?.source === "upload") {
      URL.revokeObjectURL(productToRevoke.imageUrl);
    }
  };

  const handleModuleSelect = (module: GenerationModule) => {
    setConfig((currentConfig) => ({ ...currentConfig, module }));
  };

  const handleProductChange = (nextProduct: ProductInput) => {
    const previousProduct = productRef.current;

    if (previousProduct?.imageUrl !== nextProduct.imageUrl) {
      revokeUploadedProduct(previousProduct);
    }

    productRef.current = nextProduct;
    setProduct(nextProduct);
  };

  const runProcessingTask = useCallback(
    async (processingTask: GenerationTask) => {
      try {
        const result = await provider.generate({
          product: processingTask.productInput,
          config: processingTask.config,
        });
        const completedTask = completeTask(processingTask, {
          resultUrls: result.resultUrls,
          creditCost: result.creditCost,
          completedAt: new Date().toISOString(),
        });

        setTasks((currentTasks) => moveTaskToTop(currentTasks, completedTask));
      } catch (error) {
        const failure = getFailureDetails(error);
        const failedTask = failTask(processingTask, {
          ...failure,
          completedAt: new Date().toISOString(),
        });

        setTasks((currentTasks) => moveTaskToTop(currentTasks, failedTask));
      }
    },
    [provider],
  );

  const handleGenerate = () => {
    if (!product || hasRunningLatestTask) {
      return;
    }

    const queuedTask = createTask({
      product,
      config,
      now: new Date().toISOString(),
    });
    const processingTask = markProcessing(queuedTask);

    setTasks((currentTasks) => [processingTask, ...currentTasks]);
    setActivePreviewTaskId(processingTask.id);
    void runProcessingTask(processingTask);
  };

  const handleRetryTask = (task: GenerationTask) => {
    if (hasRunningLatestTask || hasUnavailableUploadSource(task)) {
      return;
    }

    const queuedTask = retryTask(task, new Date().toISOString());
    const processingTask = markProcessing(queuedTask);

    setTasks((currentTasks) => moveTaskToTop(currentTasks, processingTask));
    setActivePreviewTaskId(processingTask.id);
    void runProcessingTask(processingTask);
  };

  const handleReuseTask = (task: GenerationTask) => {
    if (hasUnavailableUploadSource(task)) {
      return;
    }

    handleProductChange(task.productInput);
    setConfig(task.config);
    setActivePreviewTaskId(null);
  };

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    return () => {
      revokeUploadedProduct(productRef.current);
    };
  }, []);

  return (
    <main className="workspace">
      <div className="workspace-sidebar">
        <ModuleNav selectedModule={config.module} onSelect={handleModuleSelect} />
        <TaskHistory
          tasks={tasks}
          onReuseTask={handleReuseTask}
          onRetryTask={handleRetryTask}
          isRetryDisabled={hasRunningLatestTask}
        />
      </div>
      <div className="workspace-main">
        <UploadPanel product={product} onProductChange={handleProductChange} />
        <ResultPreview
          product={product}
          latestTask={activePreviewTask}
          onGenerate={handleGenerate}
          isGenerateDisabled={!product || hasRunningLatestTask}
        />
      </div>
      <ParameterPanel config={config} onChange={setConfig} />
    </main>
  );
}
