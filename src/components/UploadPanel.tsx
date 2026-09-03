import { useState } from "react";
import type { MaterialLibraryAsset } from "../api/materialLibraryApi";
import type { ProductInput } from "../domain/types";
import { MaterialPickerDialog } from "./MaterialPickerDialog";

interface UploadPanelProps {
  product: ProductInput | null;
  onProductChange: (product: ProductInput) => void;
}

const sampleImageSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900">
  <rect width="900" height="900" fill="#fbfbf5"/>
  <rect x="170" y="130" width="560" height="640" rx="42" fill="#ffffff" stroke="#e4e4e7" stroke-width="8"/>
  <rect x="250" y="225" width="400" height="430" rx="30" fill="#eaf8ef"/>
  <path d="M338 622h224c20 0 32-22 21-39l-68-106c-10-16-34-16-44 0l-38 58-24-36c-10-15-32-15-42 0l-52 84c-11 17 2 39 23 39z" fill="#111111"/>
  <circle cx="552" cy="328" r="48" fill="#c1fbd4"/>
  <rect x="300" y="696" width="300" height="34" rx="17" fill="#111111"/>
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
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleLibraryPick = (asset: MaterialLibraryAsset) => {
    onProductChange({
      id: `library-product-${asset.id}`,
      imageUrl: asset.imageUrl,
      fileName: asset.fileName,
      createdAt: new Date().toISOString(),
      source: "upload",
    });
  };

  return (
    <section className="panel upload-panel" aria-labelledby="upload-title">
      <div className="panel-heading">
        <p className="eyebrow">Product Material</p>
        <h2 id="upload-title">产品素材</h2>
        <p>从图片库选择清晰、干净、光线稳定的商品图。</p>
      </div>

      <div className="upload-actions">
        <button
          type="button"
          className="upload-dropzone"
          aria-label="从图片库选择商品图"
          onClick={() => setPickerOpen(true)}
        >
          <span>从图片库选择商品图</span>
          <small>本地图片请先到图片库批量上传</small>
        </button>
        {import.meta.env.MODE === "test" ? (
          <button
            type="button"
            className="secondary-button test-sample-product-button"
            onClick={() => onProductChange(createSampleProduct())}
          >
            使用示例商品
          </button>
        ) : null}
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
          <span>先从图片库选择产品图，再填写生成设置。</span>
        </div>
      )}
      <MaterialPickerDialog
        open={pickerOpen}
        title="从图片库选择商品图"
        onPick={handleLibraryPick}
        onClose={() => setPickerOpen(false)}
      />
    </section>
  );
}
