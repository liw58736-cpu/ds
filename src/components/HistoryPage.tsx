import { useEffect, useMemo, useState } from "react";
import {
  getGenerationTaskSnapshot,
  listGenerationTasks,
} from "../api/generationApi";
import {
  downloadTaskAsset,
  downloadTaskAssets,
  getTaskResultAssets,
} from "../domain/resultAssets";
import { describeTaskFunction } from "../domain/taskDisplay";
import type { GenerationResultAsset, GenerationTask, TaskStatus } from "../domain/types";

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
} as const satisfies Record<TaskStatus, string>;

function formatTaskTime(createdAt: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function isThisMonth(dateValue: string): boolean {
  const date = new Date(dateValue);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export function HistoryPage() {
  const [tasks, setTasks] = useState<GenerationTask[]>(
    () => getGenerationTaskSnapshot(),
  );
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  useEffect(() => {
    void listGenerationTasks().then(setTasks);
  }, []);

  const stats = useMemo(() => {
    const completedCount = tasks.filter((task) => task.status === "completed").length;
    const failedCount = tasks.filter((task) => task.status === "failed").length;
    const monthlyCredits = tasks
      .filter((task) => task.status === "completed" && isThisMonth(task.createdAt))
      .reduce((sum, task) => sum + task.creditCost, 0);

    return [
      { label: "全部任务", value: String(tasks.length), note: "本机保存的生成记录" },
      { label: "完成素材", value: String(completedCount), note: "可继续下载或复用" },
      { label: "失败任务", value: String(failedCount), note: "失败不计入成功消耗" },
      { label: "本月消耗", value: `${monthlyCredits} credits`, note: "仅统计成功任务" },
    ];
  }, [tasks]);

  return (
    <main className="page-surface history-page">
      <section className="page-heading history-page-heading" aria-labelledby="history-page-title">
        <p className="eyebrow">History</p>
        <h1 id="history-page-title">历史任务</h1>
        <p>集中查看已生成、失败和中断的任务，不再混入任一生成页面的设置面板。</p>
      </section>

      <section className="history-stats" aria-label="历史任务统计">
        {stats.map((stat) => (
          <article className="summary-card" key={stat.label}>
            <p className="summary-label">{stat.label}</p>
            <p className="summary-value">{stat.value}</p>
            <p className="summary-note">{stat.note}</p>
          </article>
        ))}
      </section>

      <section className="history-table-panel" aria-labelledby="history-list-title">
        <div className="panel-heading">
          <p className="eyebrow">Recent Tasks</p>
          <h2 id="history-list-title">最近任务</h2>
          <p>这里仅展示任务记录。需要继续生成时，从顶部导航进入对应工作台。</p>
        </div>

        {tasks.length === 0 ? (
          <div className="history-empty">
            <h3>暂无历史任务</h3>
            <p>完成一次生成后，任务记录会出现在这里。</p>
          </div>
        ) : (
          <div className="history-task-list">
            {tasks.map((task) => (
              <article className="history-task-row" key={task.id}>
                <div>
                  <small>功能</small>
                  <strong>{describeTaskFunction(task)}</strong>
                  <span>{task.productInput.fileName}</span>
                </div>
                <div>
                  <small>时间</small>
                  <span>{formatTaskTime(task.createdAt)}</span>
                </div>
                <div>
                  <small>规格</small>
                  <span>
                    {task.config.resolution ?? "2K"} / {task.config.aspectRatio}
                  </span>
                </div>
                <div>
                  <small>消耗</small>
                  <span>{task.creditCost} credits</span>
                </div>
                <span className={`task-status task-status-${task.status}`}>
                  {statusLabels[task.status]}
                </span>
                {task.status === "completed" && getTaskResultAssets(task).length > 0 ? (
                  <div className="history-result-strip">
                    <div className="history-result-actions">
                      <span>{getTaskResultAssets(task).length} 张图片</span>
                      {getTaskResultAssets(task).length > 1 ? (
                        <button
                          type="button"
                          className="ghost-action-button"
                          onClick={() => downloadTaskAssets(task)}
                        >
                          下载本次任务全部图片
                        </button>
                      ) : null}
                    </div>
                    <div className="history-result-grid">
                      {getTaskResultAssets(task).map((asset, index) => (
                        <figure
                          className="history-result-item"
                          key={`${asset.url}-${index}`}
                          role="button"
                          tabIndex={0}
                          aria-label={`放大查看 ${asset.label}`}
                          onClick={() => setLightbox({ asset, task, index })}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") {
                              return;
                            }
                            event.preventDefault();
                            setLightbox({ asset, task, index });
                          }}
                        >
                          <img src={asset.url} alt="生成结果缩略图" />
                          <figcaption>{asset.label}</figcaption>
                          <button
                            type="button"
                            className="ghost-action-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              downloadTaskAsset(task, asset, index);
                            }}
                          >
                            下载
                          </button>
                        </figure>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
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
    </main>
  );
}
