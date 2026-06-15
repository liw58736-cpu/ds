import type { GenerationTask, ProductInput } from "../domain/types";

interface ResultPreviewProps {
  product: ProductInput | null;
  latestTask?: GenerationTask;
  onGenerate: () => void;
  isGenerateDisabled: boolean;
}

export function ResultPreview({
  product,
  latestTask,
  onGenerate,
  isGenerateDisabled,
}: ResultPreviewProps) {
  const isTaskRunning =
    latestTask?.status === "queued" || latestTask?.status === "processing";
  const resultUrl =
    latestTask?.status === "completed" ? latestTask.resultUrls[0] : undefined;
  const hasResult = Boolean(resultUrl);

  return (
    <section className="panel result-panel" aria-labelledby="result-title">
      <div className="panel-heading result-heading">
        <div>
          <p className="eyebrow">Preview</p>
          <h2 id="result-title">预览</h2>
        </div>
        <div className="result-actions">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerateDisabled}
          >
            生成素材
          </button>
          <button type="button" disabled={!hasResult}>
            下载结果
          </button>
          <button type="button" disabled={!hasResult}>
            复制参数
          </button>
        </div>
      </div>

      <div className="preview-grid">
        <div className="preview-slot">
          <p className="preview-title">原图</p>
          {product ? (
            <img src={product.imageUrl} alt="原始商品图" />
          ) : (
            <div className="preview-placeholder">未选择商品图</div>
          )}
        </div>
        <div className="preview-slot">
          <p className="preview-title">结果</p>
          {resultUrl ? (
            <img src={resultUrl} alt="生成结果" />
          ) : isTaskRunning ? (
            <div className="preview-placeholder">处理中</div>
          ) : latestTask?.status === "failed" ? (
            <div className="preview-placeholder preview-error">
              {latestTask.errorMessage ?? "生成失败，请重试。"}
            </div>
          ) : (
            <div className="preview-placeholder">等待生成结果</div>
          )}
        </div>
      </div>
    </section>
  );
}
