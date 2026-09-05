import { ImageCleanupPage } from "./ImageCleanupPage";
import {
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  ModuleReferenceAsset,
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
  saveGenerationTaskHistory,
  saveGenerationTasks,
} from "../api/generationApi";
import { shouldUseKromaGenerationBackend } from "../api/kromaGenerationAdapter";
import { GenerationProviderError } from "../providers/generationProvider";
import { ParameterPanel } from "./ParameterPanel";
import { ResultPreview } from "./ResultPreview";
import { UploadPanel } from "./UploadPanel";
import { InspirationUploadPanel } from "./InspirationUploadPanel";
import { NoticeDialog } from "./NoticeDialog";
import {
  getStorageOwner,
  loadWorkspaceDrafts,
  saveWorkspaceDraft,
  reuseTaskDraft,
} from "../storage/workspaceDraftStore";

function moveTaskToTop(
  tasks: GenerationTask[],
  nextTask: GenerationTask,
): GenerationTask[] {
  return [nextTask, ...tasks.filter((task) => task.id !== nextTask.id)];
}

function getTaskCreatedAtTime(task: GenerationTask): number {
  const time = Date.parse(task.createdAt);

  return Number.isFinite(time) ? time : 0;
}

function mergeLoadedTasksWithCurrent(
  currentTasks: GenerationTask[],
  loadedTasks: GenerationTask[],
  activeTaskIds: Set<string>,
): GenerationTask[] {
  const taskById = new Map(loadedTasks.map((task) => [task.id, task]));

  for (const task of currentTasks) {
    if (!taskById.has(task.id) || activeTaskIds.has(task.id)) {
      taskById.set(task.id, task);
    }
  }

  return Array.from(taskById.values()).sort(
    (firstTask, secondTask) =>
      getTaskCreatedAtTime(secondTask) - getTaskCreatedAtTime(firstTask),
  );
}

function getFailureDetails(error: unknown): {
  errorCode: string;
  errorMessage: string;
} {
  if (error instanceof GenerationProviderError) {
    return {
      errorCode: error.code,
      errorMessage: /failed to fetch|networkerror|load failed/i.test(error.message)
        ? "网络连接中断，请检查网络后重试。"
        : error.message,
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
    "main_image" | "white_background" | "detail_page" | "lifestyle"
  >;
  isVisible?: boolean;
  isAuthenticated?: boolean;
  onOpenPricing?: () => void;
  onRequireLogin?: () => void;
  onOpenMotion?: (imageUrl: string, title: string) => void;
}

export function Workspace({
  activeModule = "main_image",
  isVisible = true,
  isAuthenticated = true,
  onOpenPricing,
  onRequireLogin,
  onOpenMotion,
}: WorkspaceProps) {
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null);
  const [owner] = useState(getStorageOwner);
  const [drafts, setDrafts] = useState(() => loadWorkspaceDrafts(owner));
  const draftsRef = useRef(drafts);
  const [draftSaveFailed, setDraftSaveFailed] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"settings" | "results">(
    "settings",
  );
  const config = drafts[activeModule].config;
  const setConfig = (update: SetStateAction<GenerationConfig>) => {
    const current = draftsRef.current[activeModule];
    const nextConfig =
      typeof update === "function" ? update(current.config) : update;
    const nextDraft = { ...current, config: nextConfig };
    draftsRef.current = { ...draftsRef.current, [activeModule]: nextDraft };
    setDrafts(draftsRef.current);
    setDraftSaveFailed(!saveWorkspaceDraft(owner, activeModule, nextDraft));
  };
  const [tasks, setTasks] = useState<GenerationTask[]>(() =>
    getGenerationTaskSnapshot(),
  );
  const [accountBalance, setAccountBalance] = useState(
    () => getCurrentAccountSnapshot().balance,
  );
  const [activePreviewTaskId, setActivePreviewTaskId] = useState<
    string | null | undefined
  >(undefined);
  const [showLoginRequiredNotice, setShowLoginRequiredNotice] = useState(false);
  const [showReplacementRequiredNotice, setShowReplacementRequiredNotice] =
    useState(false);

  const hasLoadedTasksRef = useRef(true);
  const taskRunTokensRef = useRef<Record<string, number>>({});
  const taskRunSequenceRef = useRef(0);
  useEffect(
    () => () => {
      taskRunTokensRef.current = {};
    },
    [],
  );
  const latestTask = tasks[0];
  const runningTaskCount = tasks.filter(
    (task) => task.status === "queued" || task.status === "processing",
  ).length;
  const previewTasks = tasks.slice(0, 8);
  const product = drafts[activeModule].product;
  const estimatedCreditCost = estimateGenerationCredits(config);
  const isOutOfCredits = accountBalance < estimatedCreditCost;

  const startTaskRun = (taskId: string): number => {
    const nextToken = ++taskRunSequenceRef.current;
    taskRunTokensRef.current[taskId] = nextToken;
    return nextToken;
  };

  const isTaskRunCurrent = (taskId: string, token: number): boolean =>
    getStorageOwner() === owner && taskRunTokensRef.current[taskId] === token;

  const handleProductChange = (nextProduct: ProductInput) => {
    const current = draftsRef.current[activeModule];
    const nextDraft = { ...current, product: nextProduct };
    draftsRef.current = { ...draftsRef.current, [activeModule]: nextDraft };
    setDrafts(draftsRef.current);
    setDraftSaveFailed(!saveWorkspaceDraft(owner, activeModule, nextDraft));
  };

  const replacementAsset =
    config.moduleReferenceAssets?.inspiration_product?.find(
      (asset) => asset.imageUrl.trim().length > 0,
    );

  const handleReplacementChange = (asset: ModuleReferenceAsset) => {
    setConfig((currentConfig) => ({
      ...currentConfig,
      moduleReferenceAssets: {
        ...(currentConfig.moduleReferenceAssets ?? {}),
        inspiration_product: [asset],
      },
    }));
  };

  useEffect(() => {
    const reload = () => {
      const next = loadWorkspaceDrafts(owner);
      draftsRef.current = next;
      setDrafts(next);
    };
    window.addEventListener("kroma-reuse-task", reload);
    return () => window.removeEventListener("kroma-reuse-task", reload);
  }, [owner]);

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
          onTaskStarted: (backendTaskId: string, index = 0, total = 1) => {
            if (!isTaskRunCurrent(processingTask.id, runToken)) {
              return;
            }

            const backendTaskIds =
              total > 1
                ? Array.from(
                    {
                      length: Math.max(
                        total,
                        currentProcessingTask.backendTaskIds?.length ?? 0,
                      ),
                    },
                    (_, taskIndex) =>
                      taskIndex === index
                        ? backendTaskId
                        : (currentProcessingTask.backendTaskIds?.[taskIndex] ??
                          ""),
                  )
                : undefined;

            currentProcessingTask = {
              ...currentProcessingTask,
              backendTaskId,
              ...(backendTaskIds ? { backendTaskIds } : {}),
            };
            setTasks((currentTasks) =>
              currentTasks.map((task) =>
                task.id === processingTask.id && task.status === "processing"
                  ? {
                      ...task,
                      backendTaskId,
                      ...(backendTaskIds ? { backendTaskIds } : {}),
                    }
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
                  groupId: processingTask.id,
                  taskAttempt: processingTask.attempt,
                },
                generationOptions,
              );
        if (!isTaskRunCurrent(processingTask.id, runToken)) {
          return;
        }

        const completedTask = completeTask(currentProcessingTask, {
          resultUrls: result.resultUrls,
          failedItems: result.failedItems,
          billingManaged: result.billingManaged,
          resultAssets: result.resultAssets,
          channelUsed: result.channelUsed,
          channelUsedByAsset: result.channelUsedByAsset,
          creditCost: result.creditCost,
          completedAt: new Date().toISOString(),
        });

        setTasks((currentTasks) => moveTaskToTop(currentTasks, completedTask));
        void saveGenerationTaskHistory(completedTask);
        try {
          const account = result.billingManaged
            ? await getCurrentAccount()
            : await consumeCredits({
                amount: result.creditCost,
                label: "生成商品素材",
              });

          setAccountBalance(account.balance);
        } catch {
          // Keep the generated result visible; a temporary credit sync failure
          // should not turn a completed image into a failed task.
        }
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
        void saveGenerationTaskHistory(failedTask);
      }
    },
    [],
  );

  const handleGenerate = () => {
    if (!isAuthenticated) {
      setShowLoginRequiredNotice(true);
      return;
    }

    if (isOutOfCredits) {
      onOpenPricing?.();
      return;
    }

    if (!product) {
      return;
    }

    if (
      config.module === "lifestyle" &&
      config.inspirationSettings?.productAction !== "keep" &&
      !replacementAsset
    ) {
      setShowReplacementRequiredNotice(true);
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
    setMobilePanel("results");
    void runProcessingTask(processingTask, startTaskRun(processingTask.id));
  };

  const handleCancelTask = async (taskToCancel: GenerationTask) => {
    if (taskToCancel.status !== "processing") {
      return;
    }

    const canceled =
      !shouldUseKromaGenerationBackend() ||
      (await cancelGenerationTask(taskToCancel));
    if (!canceled) {
      void listGenerationTasks().then((stored) =>
        setTasks((current) =>
          mergeLoadedTasksWithCurrent(current, stored, new Set()),
        ),
      );
      return;
    }
    taskRunTokensRef.current[taskToCancel.id] =
      (taskRunTokensRef.current[taskToCancel.id] ?? 0) + 1;

    const canceledTask = failTask(taskToCancel, {
      errorCode: "task_canceled",
      errorMessage: "已取消本次生成。",
      completedAt: new Date().toISOString(),
    });

    setTasks((currentTasks) => moveTaskToTop(currentTasks, canceledTask));
  };

  const handleRetryTask = (taskToRetry: GenerationTask) => {
    if (
      ["watermark_remove", "remove_object"].includes(
        taskToRetry.config.whiteBackgroundMode || "",
      )
    ) {
      reuseTaskDraft(taskToRetry);
      return;
    }
    if (taskToRetry.status !== "failed" && taskToRetry.status !== "partial") {
      return;
    }

    if (!isAuthenticated) {
      setShowLoginRequiredNotice(true);
      return;
    }

    if (isOutOfCredits) {
      onOpenPricing?.();
      return;
    }

    const retryConfig = taskToRetry.failedItems?.length
      ? {
          ...taskToRetry.config,
          ...(taskToRetry.config.module === "main_image"
            ? {
                selectedMainModules: taskToRetry.failedItems.flatMap(
                  (item) => item.config.selectedMainModules || [],
                ),
              }
            : {}),
          ...(taskToRetry.config.module === "detail_page"
            ? {
                detailModuleCounts: taskToRetry.failedItems.reduce(
                  (counts, item) => {
                    for (const [key, value] of Object.entries(
                      item.config.detailModuleCounts || {},
                    ))
                      counts[key] = (counts[key] || 0) + (value || 0);
                    return counts;
                  },
                  {} as Record<string, number>,
                ),
              }
            : {}),
        }
      : taskToRetry.config;
    const processingTask = markProcessing(
      createTask({
        product: taskToRetry.productInput,
        config: retryConfig,
        now: new Date().toISOString(),
      }),
    );

    setTasks((currentTasks) => moveTaskToTop(currentTasks, processingTask));
    setActivePreviewTaskId(processingTask.id);
    setMobilePanel("results");
    void runProcessingTask(processingTask, startTaskRun(processingTask.id));
  };

  useEffect(() => {
    if (hasLoadedTasksRef.current) {
      void saveGenerationTasks(tasks);
    }
  }, [tasks]);

  useEffect(() => {
    let disposed = false;
    void listGenerationTasks().then((storedTasks) => {
      if (disposed) return;
      hasLoadedTasksRef.current = true;
      setTasks((currentTasks) =>
        mergeLoadedTasksWithCurrent(
          currentTasks,
          storedTasks,
          new Set(Object.keys(taskRunTokensRef.current)),
        ),
      );
      storedTasks
        .filter(
          (task) =>
            task.status === "processing" &&
            Boolean(
              task.backendTaskId ||
              (task.backendTaskIds && task.backendTaskIds.length > 0),
            ),
        )
        .forEach((task) => {
          if (taskRunTokensRef.current[task.id]) {
            return;
          }

          void runProcessingTask(task, startTaskRun(task.id), "resume");
        });
    });
    return () => {
      disposed = true;
    };
  }, [runProcessingTask]);

  useEffect(() => {
    if (isVisible) {
      void getCurrentAccount().then((account) => {
        setAccountBalance(account.balance);
      });
    }
  }, [isVisible]);

  if (
    activeModule === "white_background" &&
    ["watermark_remove", "remove_object"].includes(
      config.whiteBackgroundMode || "",
    )
  )
    return (
      <>
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            setConfig((current) => ({
              ...current,
              whiteBackgroundMode: "white_background",
            }))
          }
        >
          返回 AI 工具
        </button>
        <ImageCleanupPage
          initialProduct={product}
          initialMode={
            config.whiteBackgroundMode as "watermark_remove" | "remove_object"
          }
          isAuthenticated={isAuthenticated}
          onRequireLogin={onRequireLogin || (() => {})}
          onOpenPricing={onOpenPricing || (() => {})}
        />
      </>
    );
  return (
    <main className="workspace" data-mobile-panel={mobilePanel}>
      <div className="workspace-mobile-tabs" aria-label="工作台视图">
        <button
          type="button"
          aria-pressed={mobilePanel === "settings"}
          onClick={() => setMobilePanel("settings")}
        >
          设置
        </button>
        <button
          type="button"
          aria-pressed={mobilePanel === "results"}
          onClick={() => setMobilePanel("results")}
        >
          结果{runningTaskCount ? `（${runningTaskCount} 进行中）` : ""}
        </button>
      </div>
      {draftSaveFailed ? (
        <p role="alert">草稿暂未保存，浏览器存储空间不足，请先保留当前页面。</p>
      ) : null}
      <div className="studio-split">
        <section className="studio-settings" aria-label="生成设置">
          <div className="studio-settings-scroll">
            {activeModule === "lifestyle" ? (
              <InspirationUploadPanel
                inspiration={product}
                replacement={replacementAsset}
                onInspirationChange={handleProductChange}
                onReplacementChange={handleReplacementChange}
              />
            ) : (
              <UploadPanel
                product={product}
                onProductChange={handleProductChange}
              />
            )}
            <ParameterPanel
              footerTarget={footerTarget}
              activeModule={activeModule}
              config={config}
              onChange={setConfig}
              onGenerate={handleGenerate}
              onBuyCredits={onOpenPricing}
              hasProduct={Boolean(product)}
              isGenerateDisabled={!product || estimatedCreditCost === 0}
              runningTaskCount={runningTaskCount}
              isOutOfCredits={isAuthenticated && isOutOfCredits}
            />
          </div>
          <div className="studio-settings-footer" ref={setFooterTarget} />
        </section>
        <section className="studio-preview" aria-label="生成预览">
          <ResultPreview
            product={product}
            inputLabel={activeModule === "lifestyle" ? "灵感原图" : "商品图"}
            latestTask={
              activePreviewTaskId
                ? tasks.find((task) => task.id === activePreviewTaskId)
                : latestTask
            }
            tasks={previewTasks}
            onCancelTask={handleCancelTask}
            onRetryTask={handleRetryTask}
            onOpenMotion={onOpenMotion}
          />
        </section>
      </div>
      <NoticeDialog
        open={showLoginRequiredNotice}
        title="请先登录"
        message="登录后才能提交生成任务，生成进度、结果和积分记录也会保存到账户中。"
        primaryLabel="去登录"
        onPrimary={onRequireLogin}
        onClose={() => setShowLoginRequiredNotice(false)}
      />
      <NoticeDialog
        open={showReplacementRequiredNotice}
        title="请上传产品 / 服装图"
        message="灵感创作需要两张图片：第一张保留人物与画面，第二张作为要替换进去的产品或服装。"
        onClose={() => setShowReplacementRequiredNotice(false)}
      />
    </main>
  );
}
