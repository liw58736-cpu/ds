import { moduleLabels } from "../domain/defaults";
import type { GenerationTask, TaskStatus } from "../domain/types";

interface TaskHistoryProps {
  tasks: GenerationTask[];
  onReuseTask: (task: GenerationTask) => void;
  onRetryTask: (task: GenerationTask) => void;
  isRetryDisabled: boolean;
}

const statusLabels = {
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
} as const satisfies Record<TaskStatus, string>;

function hasUnavailableUploadSource(task: GenerationTask): boolean {
  return task.errorCode === "upload_source_unavailable";
}

export function TaskHistory({
  tasks,
  onReuseTask,
  onRetryTask,
  isRetryDisabled,
}: TaskHistoryProps) {
  return (
    <section className="panel task-history" aria-labelledby="task-history-title">
      <div className="panel-heading">
        <p className="eyebrow">History</p>
        <h2 id="task-history-title">最近任务</h2>
      </div>

      {tasks.length === 0 ? (
        <p className="task-history-empty">暂无任务</p>
      ) : (
        <div className="task-history-list">
          {tasks.map((task) => (
            <article className="task-history-item" key={task.id}>
              <div className="task-history-summary">
                <span className="task-module">{moduleLabels[task.config.module]}</span>
                <span className={`task-status task-status-${task.status}`}>
                  {statusLabels[task.status]}
                </span>
              </div>
              {task.errorMessage ? <p className="task-error">{task.errorMessage}</p> : null}
              <div className="task-history-actions">
                <button
                  type="button"
                  onClick={() => onReuseTask(task)}
                  disabled={hasUnavailableUploadSource(task)}
                >
                  复用参数
                </button>
                {task.status === "failed" ? (
                  <button
                    type="button"
                    onClick={() => onRetryTask(task)}
                    disabled={isRetryDisabled || hasUnavailableUploadSource(task)}
                  >
                    重试
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
