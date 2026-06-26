import { useCallback, useEffect, useRef, useState } from "react";
import { defaultConfig } from "../domain/defaults";
import { estimateGenerationCredits } from "../domain/creditCost";
import {
  completeTask,
  createTask,
  failTask,
  markProcessing,
  retryTask,
  updateTaskProgress,
} from "../domain/taskState";
import type {
  GenerationConfig,
  GenerationModule,
  GenerationTask,
  ProductInput,
} from "../domain/types";
import {
  consumeCredits,
  getCurrentAccount,
  getCurrentAccountSnapshot,
} from "../api/accountApi";
import {
  cancelGenerationTask,
  generateAsset,
  getGenerationTaskSnapshot,
  listGenerationTasks,
  resumeGenerationTask,
  saveGenerationTasks,
} from "../api/generationApi";
import { GenerationProviderError } from "../providers/generationProvider";
import { ParameterPanel } from "./ParameterPanel";
import { ResultPreview } from "./ResultPreview";
import { UploadPanel } from "./UploadPanel";

function moveTaskToTop(
  tasks: GenerationTask[],
  nextTask: GenerationTask,
): GenerationTask[] {
  return [nextTask, ...tasks.filter((task) => task.id !== nextTask.id)];
}

const maxConcurrentGenerationTasks = 3;

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

interface WorkspaceProps {
  activeModule?: Extract<
    GenerationModule,
    "main_image" | "white_background" | "detail_page"
  >;
  isVisible?: boolean;
  isAuthenticated?: boolean;
  onOpenPricing?: () => void;
  onRequireLogin?: () => void;
}

function getModuleDefaults(module: GenerationModule): Partial<GenerationConfig> {
  if (module === "detail_page") {
    return { module, aspectRatio: "long_page", outputFormat: "jpg" };
  }

  if (module === "white_background") {
    return {
      module,
      aspectRatio: "original",
      outputFormat: "png",
      whiteBackgroundMode: "white_background",
    };
  }

  return { module, aspectRatio: "1:1", outputFormat: "png" };
}

export function Workspace({
  activeModule = "main_image",
  isVisible = true,
  isAuthenticated = true,
  onOpenPricing,
  onRequireLogin,
}: WorkspaceProps) {
  const [config, setConfig] = useState<GenerationConfig>(defaultConfig);
  const [product, setProduct] = useState<ProductInput | null>(null);
  const [tasks, setTasks] = useState<GenerationTask[]>(
    () => getGenerationTaskSnapshot(),
  );
  const [accountBalance, setAccountBalance] = useState(
    () => getCurrentAccountSnapshot().balance,
  );
  const [activePreviewTaskId, setActivePreviewTaskId] = useState<
    string | null | undefined
  >(undefined);
  const productRef = useRef<ProductInput | null>(null);
  const activeModuleRef = useRef(activeModule);
  const hasLoadedTasksRef = useRef(true);
  const taskRunTokensRef = useRef<Record<string, number>>({});
  const latestTask = tasks[0];
  const runningTaskCount = tasks.filter(
    (task) => task.status === "queued" || task.status === "processing",
  ).length;
  const isConcurrencyFull = runningTaskCount >= maxConcurrentGenerationTasks;
  const previewTasks = tasks.slice(0, 8);
  const estimatedCreditCost = estimateGenerationCredits(config);
  const isOutOfCredits = accountBalance < estimatedCreditCost;

  const revokeUploadedProduct = (productToRevoke: ProductInput | null) => {
    if (
      productToRevoke?.source === "upload" &&
      productToRevoke.imageUrl.startsWith("blob:")
    ) {
      URL.revokeObjectURL(productToRevoke.imageUrl);
    }
  };

  const startTaskRun = (taskId: string): number => {
    const nextToken = (taskRunTokensRef.current[taskId] ?? 0) + 1;
    taskRunTokensRef.current[taskId] = nextToken;
    return nextToken;
  };

  const isTaskRunCurrent = (taskId: string, token: number): boolean =>
    taskRunTokensRef.current[taskId] === token;

  const handleProductChange = (nextProduct: ProductInput) => {
    const previousProduct = productRef.current;

    if (previousProduct?.imageUrl !== nextProduct.imageUrl) {
      revokeUploadedProduct(previousProduct);
    }

    productRef.current = nextProduct;
    setProduct(nextProduct);
  };

  const runProcessingTask = useCallback(
    async (
      processingTask: GenerationTask,
      runToken: number,
      mode: "submit" | "resume" = "submit",
    ) => {
      let currentProcessingTask = processingTask;

      try {
        const generationOptions = {
          onProgress: (progress: string) => {
            if (!isTaskRunCurrent(processingTask.id, runToken)) {
              return;
            }

            setTasks((currentTasks) =>
              currentTasks.map((task) =>
                task.id === processingTask.id && task.status === "processing"
                  ? updateTaskProgress(task, progress)
                  : task,
              ),
            );
          },
          onTaskStarted: (backendTaskId: string) => {
            if (!isTaskRunCurrent(processingTask.id, runToken)) {
              return;
            }

            currentProcessingTask = {
              ...currentProcessingTask,
              backendTaskId,
            };
            setTasks((currentTasks) =>
              currentTasks.map((task) =>
                task.id === processingTask.id && task.status === "processing"
                  ? { ...task, backendTaskId }
                  : task,
              ),
            );
          },
          shouldContinue: () => isTaskRunCurrent(processingTask.id, runToken),
        };
        const result =
          mode === "resume"
            ? await resumeGenerationTask(processingTask, generationOptions)
            : await generateAsset(
                {
                  product: processingTask.productInput,
                  config: processingTask.config,
                },
                generationOptions,
              );
        if (!isTaskRunCurrent(processingTask.id, runToken)) {
          return;
        }

        const completedTask = completeTask(currentProcessingTask, {
          resultUrls: result.resultUrls,
          resultAssets: result.resultAssets,
          creditCost: result.creditCost,
          completedAt: new Date().toISOString(),
        });
        const account = await consumeCredits({
          amount: result.creditCost,
          label: "生成商品素材",
        });

        setAccountBalance(account.balance);
        setTasks((currentTasks) => moveTaskToTop(currentTasks, completedTask));
      } catch (error) {
        if (!isTaskRunCurrent(processingTask.id, runToken)) {
          return;
        }

        const failure = getFailureDetails(error);
        const failedTask = failTask(currentProcessingTask, {
          ...failure,
          completedAt: new Date().toISOString(),
        });

        setTasks((currentTasks) => moveTaskToTop(currentTasks, failedTask));
      }
    },
    [],
  );

  const handleGenerate = () => {
    if (!isAuthenticated) {
      onRequireLogin?.();
      return;
    }

    if (isOutOfCredits) {
      onOpenPricing?.();
      return;
    }

    if (!product || isConcurrencyFull) {
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
    void runProcessingTask(processingTask, startTaskRun(processingTask.id));
  };

  const handleCancelTask = (taskToCancel: GenerationTask) => {
    if (taskToCancel.status !== "processing") {
      return;
    }

    taskRunTokensRef.current[taskToCancel.id] =
      (taskRunTokensRef.current[taskToCancel.id] ?? 0) + 1;
    void cancelGenerationTask(taskToCancel);

    const canceledTask = failTask(taskToCancel, {
      errorCode: "task_canceled",
      errorMessage: "已取消本次生成。",
      completedAt: new Date().toISOString(),
    });

    setTasks((currentTasks) => moveTaskToTop(currentTasks, canceledTask));
  };

  const handleRetryTask = (taskToRetry: GenerationTask) => {
    if (taskToRetry.status !== "failed") {
      return;
    }

    if (!isAuthenticated) {
      onRequireLogin?.();
      return;
    }

    if (isOutOfCredits) {
      onOpenPricing?.();
      return;
    }

    if (isConcurrencyFull) {
      return;
    }

    const processingTask = markProcessing(
      retryTask(taskToRetry, new Date().toISOString()),
    );

    setTasks((currentTasks) => moveTaskToTop(currentTasks, processingTask));
    setActivePreviewTaskId(processingTask.id);
    void runProcessingTask(processingTask, startTaskRun(processingTask.id));
  };

  useEffect(() => {
    if (hasLoadedTasksRef.current) {
      void saveGenerationTasks(tasks);
    }
  }, [tasks]);

  useEffect(() => {
    void listGenerationTasks().then((storedTasks) => {
      hasLoadedTasksRef.current = true;
      setTasks(storedTasks);
      storedTasks
        .filter(
          (task) => task.status === "processing" && Boolean(task.backendTaskId),
        )
        .forEach((task) => {
          void runProcessingTask(task, startTaskRun(task.id), "resume");
        });
    });
  }, [runProcessingTask]);

  useEffect(() => {
    if (isVisible) {
      void getCurrentAccount().then((account) => {
        setAccountBalance(account.balance);
      });
    }
  }, [isVisible]);

  useEffect(() => {
    setConfig((currentConfig) => ({
      ...currentConfig,
      ...getModuleDefaults(activeModule),
    }));

    activeModuleRef.current = activeModule;
  }, [activeModule]);

  useEffect(() => {
    return () => {
      revokeUploadedProduct(productRef.current);
    };
  }, []);

  return (
    <main className="workspace">
      <div className="studio-split">
        <section className="studio-settings" aria-label="生成设置">
          <UploadPanel product={product} onProductChange={handleProductChange} />
          <ParameterPanel
            activeModule={activeModule}
            config={config}
            onChange={setConfig}
            onGenerate={handleGenerate}
            onBuyCredits={onOpenPricing}
            isGenerateDisabled={!product || isConcurrencyFull}
            isConcurrencyFull={isConcurrencyFull}
            runningTaskCount={runningTaskCount}
            maxConcurrentTasks={maxConcurrentGenerationTasks}
            isOutOfCredits={isAuthenticated && isOutOfCredits}
          />
        </section>
        <section className="studio-preview" aria-label="生成预览">
          <ResultPreview
            product={product}
            latestTask={activePreviewTaskId ? tasks.find((task) => task.id === activePreviewTaskId) : latestTask}
            tasks={previewTasks}
            onCancelTask={handleCancelTask}
            onRetryTask={handleRetryTask}
          />
        </section>
      </div>
    </main>
  );
}
