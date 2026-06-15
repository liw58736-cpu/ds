import { useState } from "react";
import type { GenerationTask, ProductInput } from "../domain/types";

interface ResultPreviewProps {
  product: ProductInput | null;
  latestTask?: GenerationTask;
  onGenerate: () => void;
  isGenerateDisabled: boolean;
}

function isSafeResultUrl(url: string): boolean {
  return (
    url.startsWith("data:image/") ||
    url.startsWith("blob:") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    (url.startsWith("/") && !url.startsWith("//"))
  );
}

export function ResultPreview({
  product,
  latestTask,
  onGenerate,
  isGenerateDisabled,
}: ResultPreviewProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const isTaskRunning =
    latestTask?.status === "queued" || latestTask?.status === "processing";
  const resultUrl =
    latestTask?.status === "completed" ? latestTask.resultUrls[0] : undefined;
  const hasResult = Boolean(resultUrl);
  const hasDownloadableResult =
    resultUrl !== undefined && isSafeResultUrl(resultUrl);
  const resultFileName =
    latestTask?.status === "completed"
      ? `${latestTask.config.module}.${latestTask.config.outputFormat}`
      : "generated-result.png";

  const handleDownload = () => {
    if (!resultUrl || !latestTask || !isSafeResultUrl(resultUrl)) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = resultUrl;
    anchor.download = resultFileName;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleCopyParameters = () => {
    if (!latestTask || latestTask.status !== "completed") {
      return;
    }

    const clipboard = navigator.clipboard;

    if (clipboard?.writeText === undefined) {
      setCopyStatus("当前浏览器不支持复制参数。");
      return;
    }

    void clipboard
      .writeText(JSON.stringify(latestTask.config))
      .then(() => setCopyStatus("参数已复制。"))
      .catch(() => setCopyStatus("复制失败，请手动复制参数。"));
  };

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
          <button
            type="button"
            onClick={handleDownload}
            disabled={!hasDownloadableResult}
          >
            下载结果
          </button>
          <button
            type="button"
            onClick={handleCopyParameters}
            disabled={!hasResult}
          >
            复制参数
          </button>
        </div>
      </div>
      {copyStatus ? (
        <p className="sr-only" role="status">
          {copyStatus}
        </p>
      ) : null}

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
            <div className="preview-placeholder" role="status">
              处理中
            </div>
          ) : latestTask?.status === "failed" ? (
            <div className="preview-placeholder preview-error" role="alert">
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
