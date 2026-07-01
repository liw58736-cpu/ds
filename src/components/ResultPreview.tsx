import { useEffect, useMemo, useRef, useState } from "react";
import {
  downloadTaskAsset,
  downloadTaskAssets,
  getTaskResultAssets,
} from "../domain/resultAssets";
import { describeTaskFunction } from "../domain/taskDisplay";
import type { GenerationResultAsset, GenerationTask, ProductInput } from "../domain/types";

interface ResultPreviewProps {
  product: ProductInput | null;
  latestTask?: GenerationTask;
  tasks?: GenerationTask[];
  onCancelTask?: (task: GenerationTask) => void;
  onRetryTask?: (task: GenerationTask) => void;
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
  const sourceTasks = tasks && tasks.length > 0 ? tasks : latestTask ? [latestTask] : [];

  return [...sourceTasks].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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
  latestTask,
  tasks,
  onCancelTask,
  onRetryTask,
}: ResultPreviewProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const newestTaskRef = useRef<HTMLDivElement | null>(null);
  const displayTasks = useMemo(
    () => getDisplayTasks(tasks, latestTask),
    [latestTask, tasks],
  );
  const hasTasks = displayTasks.length > 0;
  const newestTaskId = displayTasks[displayTasks.length - 1]?.id;

  useEffect(() => {
    if (!newestTaskId) {
      return;
    }

    if (typeof newestTaskRef.current?.scrollIntoView !== "function") {
      return;
    }

    newestTaskRef.current.scrollIntoView({
      block: "end",
      behavior: "smooth",
    });
  }, [newestTaskId]);

  return (
    <section className="panel result-panel" aria-labelledby="result-title">
      {!product && !hasTasks ? (
        <div className="preview-empty-state">
          <h3>先上传商品图并填写生成设置</h3>
          <p>左侧完成设置后，这里会显示生成预览和最终结果。</p>
        </div>
      ) : null}

      <div className="preview-title-row preview-feed-heading">
        <p className="preview-title" id="result-title">生成预览</p>
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
              onOpenImage={(asset, index) => setLightbox({ asset, task, index })}
            />
          ))}
          <div ref={newestTaskRef} aria-hidden="true" />
        </div>
      ) : (
        <div className="preview-grid preview-grid-single">
          <div className="preview-slot">
            <div className="preview-placeholder">
              {product ? "等待生成结果" : "未选择商品图"}
            </div>
          </div>
        </div>
      )}

      {lightbox ? (
        <div
          className="preview-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.asset.label}
          onClick={() => setLightbox(null)}
        >
          <div className="preview-lightbox-content" onClick={(event) => event.stopPropagation()}>
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
              onClick={() => downloadTaskAsset(lightbox.task, lightbox.asset, lightbox.index)}
            >
              下载
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PreviewTaskCard({
  task,
  onCancelTask,
  onRetryTask,
  onOpenImage,
}: {
  task: GenerationTask;
  onCancelTask?: (task: GenerationTask) => void;
  onRetryTask?: (task: GenerationTask) => void;
  onOpenImage: (asset: GenerationResultAsset, index: number) => void;
}) {
  const isTaskRunning = task.status === "queued" || task.status === "processing";
  const resultAssets = task.status === "completed" ? getTaskResultAssets(task) : [];
  const canRetryFailedTask =
    task.status === "failed" && task.errorCode !== "upload_source_unavailable";
  const runningProgress = isTaskRunning ? getRunningProgress(task) : "正在生成图片";

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

      {resultAssets.length > 0 ? (
        <>
          <div className="preview-task-actions">
            <span>{resultAssets.length} 张图片</span>
            {task.channelUsed ? <span>Channel: {task.channelUsed}</span> : null}
            {resultAssets.length > 1 ? (
              <button
                type="button"
                className="ghost-action-button"
                onClick={() => downloadTaskAssets(task)}
              >
                下载本次任务全部图片
              </button>
            ) : null}
          </div>
          <div className="preview-result-list preview-thumbnail-list">
            {resultAssets.map((asset, index) => (
              <figure className="preview-result-item" key={`${asset.url}-${index}`}>
                <button
                  type="button"
                  className="preview-thumbnail-button"
                  aria-label={`放大查看 ${asset.label}`}
                  onClick={() => onOpenImage(asset, index)}
                >
                  <img src={asset.url} alt="生成结果" />
                </button>
                <figcaption>{asset.label}</figcaption>
                <button
                  type="button"
                  className="ghost-action-button"
                  onClick={() => downloadTaskAsset(task, asset, index)}
                >
                  下载
                </button>
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
