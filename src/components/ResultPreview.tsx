import type { ProductInput } from "../domain/types";

interface ResultPreviewProps {
  product: ProductInput | null;
}

export function ResultPreview({ product }: ResultPreviewProps) {
  return (
    <section className="panel result-panel" aria-labelledby="result-title">
      <div className="panel-heading result-heading">
        <div>
          <p className="eyebrow">Preview</p>
          <h2 id="result-title">预览</h2>
        </div>
        <div className="result-actions">
          <button type="button" disabled>
            下载结果
          </button>
          <button type="button" disabled>
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
          <div className="preview-placeholder">等待生成结果</div>
        </div>
      </div>
    </section>
  );
}
