import type { ChangeEvent } from "react";
import type { ProductInput } from "../domain/types";

interface UploadPanelProps {
  product: ProductInput | null;
  onProductChange: (product: ProductInput) => void;
}

const sampleImageSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900">
  <rect width="900" height="900" fill="#f8fafc"/>
  <rect x="175" y="135" width="550" height="630" rx="46" fill="#ffffff" stroke="#cbd5e1" stroke-width="8"/>
  <rect x="252" y="230" width="396" height="430" rx="34" fill="#e8f1f8"/>
  <path d="M336 624h228c20 0 32-22 21-39l-70-108c-10-16-34-16-44 0l-37 57-24-35c-10-15-32-15-42 0l-53 86c-11 17 2 39 21 39z" fill="#287c72"/>
  <circle cx="553" cy="330" r="48" fill="#d99152"/>
  <rect x="300" y="696" width="300" height="34" rx="17" fill="#1f2937"/>
</svg>`;

const sampleImageUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  sampleImageSvg,
)}`;

function createSampleProduct(): ProductInput {
  return {
    id: "sample-product",
    imageUrl: sampleImageUrl,
    fileName: "sample-product.jpg",
    createdAt: "2026-06-15T00:00:00.000Z",
    source: "sample",
  };
}

export function UploadPanel({ product, onProductChange }: UploadPanelProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    onProductChange({
      id: `upload-${file.name}-${file.lastModified}`,
      imageUrl: URL.createObjectURL(file),
      fileName: file.name,
      createdAt: new Date().toISOString(),
      source: "upload",
    });
  };

  return (
    <section className="panel upload-panel" aria-labelledby="upload-title">
      <div className="panel-heading">
        <p className="eyebrow">Input</p>
        <h2 id="upload-title">商品图</h2>
      </div>

      <div className="upload-actions">
        <label className="upload-dropzone">
          <span>上传商品图</span>
          <input
            type="file"
            accept="image/*"
            aria-label="上传商品图"
            onChange={handleFileChange}
          />
        </label>
        <button type="button" className="secondary-button" onClick={() => onProductChange(createSampleProduct())}>
          使用示例商品
        </button>
      </div>

      {product ? (
        <div className="current-product">
          <img src={product.imageUrl} alt="当前商品图" />
          <div>
            <p className="file-label">当前文件</p>
            <p className="file-name">{product.fileName}</p>
          </div>
        </div>
      ) : (
        <div className="empty-upload">
          <p>等待商品图</p>
        </div>
      )}
    </section>
  );
}
