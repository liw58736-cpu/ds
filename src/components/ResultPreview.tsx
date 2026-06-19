import type { GenerationTask, ProductInput } from "../domain/types";

interface ResultPreviewProps {
  product: ProductInput | null;
  latestTask?: GenerationTask;
  onCancelTask?: (task: GenerationTask) => void;
  onRetryTask?: (task: GenerationTask) => void;
}

export function ResultPreview({
  product,
  latestTask,
  onCancelTask,
  onRetryTask,
}: ResultPreviewProps) {
  const isTaskRunning =
    latestTask?.status === "queued" || latestTask?.status === "processing";
  const resultUrl =
    latestTask?.status === "completed" ? latestTask.resultUrls[0] : undefined;
  const hasResult = Boolean(resultUrl);
  const runningProgress =
    isTaskRunning && latestTask?.progress ? latestTask.progress : "处理中";

  return (
    <section className="panel result-panel" aria-labelledby="result-title">
      {!product && !latestTask ? (
        <div className="preview-empty-state">
          <h3>先上传产品图并填写生成设置</h3>
          <p>左侧完成设置后，这里会显示生成预览和最终结果。</p>
        </div>
      ) : null}

      <div className="preview-grid preview-grid-single">
        <div className="preview-slot">
          <div className="preview-title-row">
            <p className="preview-title">生成预览</p>
            <span>{hasResult ? "Ready" : "Draft"}</span>
          </div>
          {resultUrl ? (
            <img src={resultUrl} alt="生成结果" />
          ) : isTaskRunning ? (
            <div className="preview-placeholder" role="status">
              <strong>{runningProgress}</strong>
              <span>请保持页面打开，生成完成后会自动显示结果。</span>
              {latestTask ? (
                <button
                  type="button"
                  className="ghost-action-button"
                  onClick={() => onCancelTask?.(latestTask)}
                  disabled={!onCancelTask}
                >
                  取消生成
                </button>
              ) : null}
            </div>
          ) : latestTask?.status === "failed" ? (
            <div className="preview-placeholder preview-error" role="alert">
              <strong>{latestTask.errorMessage ?? "生成失败，请重试。"}</strong>
              <span>失败任务不会计入成功消耗。</span>
              <button
                type="button"
                className="ghost-action-button"
                onClick={() => onRetryTask?.(latestTask)}
                disabled={!onRetryTask}
              >
                重新生成
              </button>
            </div>
          ) : (
            <div className="preview-placeholder">
              {product ? "等待生成结果" : "未选择商品图"}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
