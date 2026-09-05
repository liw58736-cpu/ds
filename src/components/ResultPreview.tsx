import { exportDetailLongImage } from "../domain/imageExports";
import { useMemo, useState } from "react";
import { Image, Sparkles } from "lucide-react";
import { LightboxFrame } from "./LightboxFrame";
import {
  downloadTaskAsset,
  downloadTaskAssets,
  getTaskResultAssets,
} from "../domain/resultAssets";
import { describeTaskFunction } from "../domain/taskDisplay";
import type {
  GenerationResultAsset,
  GenerationTask,
  ProductInput,
} from "../domain/types";

interface ResultPreviewProps {
  product: ProductInput | null;
  inputLabel?: string;
  latestTask?: GenerationTask;
  tasks?: GenerationTask[];
  onCancelTask?: (task: GenerationTask) => void;
  onRetryTask?: (task: GenerationTask) => void;
  onOpenMotion?: (imageUrl: string, title: string) => void;
}

interface LightboxState {
  asset: GenerationResultAsset;
  task: GenerationTask;
  index: number;
}

const statusLabels = {
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  partial: "部分完成",
  failed: "失败",
} as const;

function formatTaskTime(createdAt: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function getDisplayTasks(
  tasks: GenerationTask[] | undefined,
  latestTask: GenerationTask | undefined,
): GenerationTask[] {
  const sourceTasks =
    tasks && tasks.length > 0 ? tasks : latestTask ? [latestTask] : [];

  return [...sourceTasks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

const internalProgressPattern =
  /通道|主通道|备用|第一|第二|第三|第四|尝试|channel|provider|route/i;

function getRunningProgress(task: GenerationTask): string {
  if (!task.progress || internalProgressPattern.test(task.progress)) {
    return "正在生成图片";
  }

  return task.progress;
}

export function ResultPreview({
  product,
  inputLabel = "商品图",
  latestTask,
  tasks,
  onCancelTask,
  onRetryTask,
  onOpenMotion,
}: ResultPreviewProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const displayTasks = useMemo(
    () => getDisplayTasks(tasks, latestTask),
    [latestTask, tasks],
  );
  const hasTasks = displayTasks.length > 0;

  return (
    <section className="panel result-panel" aria-label="生成预览">
      {!product && !hasTasks ? (
        <div className="preview-empty-state">
          <div className="preview-empty-art" aria-hidden="true"><Image /><Sparkles /></div>
          <h3>先从图片库选择{inputLabel}</h3>
          <p>完成左侧设置并提交后，图片会显示在这里。</p>
        </div>
      ) : null}
      {product && !hasTasks ? (
        <div className="preview-ready-state">
          <div className="preview-empty-art" aria-hidden="true"><Image /><Sparkles /></div>
          <h3>素材已就位，开始创作吧</h3>
          <p>选择模块与画面要求，生成结果会保存在这里。</p>
        </div>
      ) : null}

      <div className="preview-title-row preview-feed-heading">
        <p className="preview-title" id="result-title">
          生成预览
        </p>
        <span>{hasTasks ? "Recent" : "Draft"}</span>
      </div>

      {hasTasks ? (
        <div className="preview-task-feed">
          {displayTasks.map((task) => (
            <PreviewTaskCard
              key={task.id}
              task={task}
              onCancelTask={onCancelTask}
              onRetryTask={onRetryTask}
              onOpenImage={(asset, index) =>
                { setDownloadError(""); setLightbox({ asset, task, index }); }
              }
              onOpenMotion={onOpenMotion}
            />
          ))}
        </div>
      ) : (
        <div className="preview-grid preview-grid-single">
          <div className="preview-slot">
            <div className="preview-placeholder">
              {product ? "等待生成结果" : `未选择${inputLabel}`}
            </div>
          </div>
        </div>
      )}

      {lightbox ? (
        <LightboxFrame label={lightbox.asset.label} onClose={() => setLightbox(null)}>
          <div
            className="preview-lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="preview-lightbox-header">
              <strong>{lightbox.asset.label}</strong>
              <button
                type="button"
                className="ghost-action-button"
                onClick={() => setLightbox(null)}
              >
                关闭
              </button>
            </div>
            <img src={lightbox.asset.url} alt={lightbox.asset.label} />
            <button
              type="button"
              className="ghost-action-button"
              onClick={() =>
                void downloadTaskAsset(lightbox.task, lightbox.asset, lightbox.index).catch(() => setDownloadError("下载未完成，请稍后重试。"))
              }
            >
              下载
            </button>
            {downloadError ? <p role="alert">{downloadError}</p> : null}
          </div>
        </LightboxFrame>
      ) : null}
    </section>
  );
}

function PreviewTaskCard({
  task,
  onCancelTask,
  onRetryTask,
  onOpenImage,
  onOpenMotion,
}: {
  task: GenerationTask;
  onCancelTask?: (task: GenerationTask) => void;
  onRetryTask?: (task: GenerationTask) => void;
  onOpenImage: (asset: GenerationResultAsset, index: number) => void;
  onOpenMotion?: (imageUrl: string, title: string) => void;
}) {
  const [exportError, setExportError] = useState("");
  const isTaskRunning =
    task.status === "queued" || task.status === "processing";
  const resultAssets =
    task.status === "completed" || task.status === "partial"
      ? getTaskResultAssets(task)
      : [];
  const canRetryFailedTask =
    (task.status === "failed" || task.status === "partial") &&
    task.errorCode !== "upload_source_unavailable";
  const runningProgress = isTaskRunning
    ? getRunningProgress(task)
    : "正在生成图片";

  return (
    <article className={`preview-task-card preview-task-${task.status}`}>
      <div className="preview-task-meta">
        <div>
          <time>{formatTaskTime(task.createdAt)}</time>
          <strong>{describeTaskFunction(task)}</strong>
        </div>
        <span className={`task-status task-status-${task.status}`}>
          {statusLabels[task.status]}
        </span>
      </div>

      {task.failedItems?.length ? (
        <div className="task-partial-status">
          <p>{task.failedItems.length} 张未完成，已完成图片已保留。</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onRetryTask?.(task)}
          >
            只重试未完成图片
          </button>
        </div>
      ) : null}
      {resultAssets.length > 0 ? (
        <>
          <div className="preview-task-actions">
            <span>{resultAssets.length} 张图片</span>
            {task.config.module === "detail_page" ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  void exportDetailLongImage(task).catch((error) =>
                    setExportError(error.message),
                  )
                }
              >
                导出详情长图
              </button>
            ) : null}
            {exportError ? <span role="alert">{exportError}</span> : null}

            {resultAssets.length > 1 ? (
              <button
                type="button"
                className="ghost-action-button"
                onClick={() => void downloadTaskAssets(task).catch(() => setExportError("下载未完成，请重试。已下载图片会保留。"))}
              >
                下载本次任务全部图片
              </button>
            ) : null}
          </div>
          <div
            className={`preview-result-list preview-thumbnail-list${task.config.module === "lifestyle" ? " is-comparison-list" : ""}`}
          >
            {resultAssets.map((asset, index) => (
              <figure
                className="preview-result-item"
                key={`${asset.url}-${index}`}
              >
                {task.config.module === "lifestyle" ? (
                  <div className="inspiration-before-after">
                    <button
                      type="button"
                      className="preview-thumbnail-button"
                      aria-label="放大查看原图"
                      onClick={() =>
                        onOpenImage(
                          { url: task.productInput.imageUrl, label: "原图" },
                          index,
                        )
                      }
                    >
                      <span>原图</span>
                      <img src={task.productInput.imageUrl} alt="创作原图" />
                    </button>
                    <button
                      type="button"
                      className="preview-thumbnail-button"
                      aria-label={`放大查看 ${asset.label}`}
                      onClick={() => onOpenImage(asset, index)}
                    >
                      <span>生成图</span>
                      <img src={asset.url} alt="生成结果" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="preview-thumbnail-button"
                    aria-label={`放大查看 ${asset.label}`}
                    onClick={() => onOpenImage(asset, index)}
                  >
                    <img src={asset.url} alt="生成结果" />
                  </button>
                )}
                <figcaption>{asset.label}</figcaption>
                <div className="preview-result-actions">
                  <button
                    type="button"
                    className="ghost-action-button"
                    onClick={() => void downloadTaskAsset(task, asset, index).catch(() => setExportError("这张图片下载失败，请稍后重试。"))}
                  >
                    下载
                  </button>
                  {task.config.module === "lifestyle" && onOpenMotion ? (
                    <button
                      type="button"
                      className="ghost-action-button"
                      onClick={() => onOpenMotion(asset.url, asset.label)}
                    >
                      生成 Live 图
                    </button>
                  ) : null}
                </div>
              </figure>
            ))}
          </div>
        </>
      ) : isTaskRunning ? (
        <div className="preview-placeholder" role="status">
          <strong>{runningProgress}</strong>
          <span>请保持页面打开，生成完成后会自动显示结果。</span>
          <button
            type="button"
            className="ghost-action-button"
            onClick={() => onCancelTask?.(task)}
            disabled={!onCancelTask}
          >
            取消生成
          </button>
        </div>
      ) : task.status === "failed" ? (
        <div className="preview-placeholder preview-error" role="alert">
          <strong>{task.errorMessage ?? "生成失败，请重试。"}</strong>
          <span>失败任务不会计入成功消耗。</span>
          {canRetryFailedTask ? (
            <button
              type="button"
              className="ghost-action-button"
              onClick={() => onRetryTask?.(task)}
              disabled={!onRetryTask}
            >
              重新生成
            </button>
          ) : null}
        </div>
      ) : (
        <div className="preview-placeholder">等待生成结果</div>
      )}
    </article>
  );
}
