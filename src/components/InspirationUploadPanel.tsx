import { useState } from "react";
import type { ReactNode } from "react";
import { ImagePlus, Library, Trash2 } from "lucide-react";
import type { ProductInput } from "../domain/types";
import type { MaterialLibraryAsset } from "../api/materialLibraryApi";
import { MaterialPickerDialog } from "./MaterialPickerDialog";

interface InspirationUploadPanelProps {
  inspiration: ProductInput | null;
  onInspirationChange: (product: ProductInput) => void;
  onInspirationRemove: () => void;
}

export function InspirationUploadPanel({
  inspiration,
  onInspirationChange,
  onInspirationRemove,
}: InspirationUploadPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleLibraryPick = (asset: MaterialLibraryAsset) => {
    onInspirationChange({
      id: `library-inspiration-${Date.now().toString(36)}`,
      imageUrl: asset.imageUrl,
      fileName: asset.fileName,
      createdAt: new Date().toISOString(),
      source: "upload",
    });
  };

  return (
    <section className="panel inspiration-input-panel" aria-labelledby="inspiration-input-title">
      <div className="panel-heading">
        <p className="eyebrow">Base inspiration</p>
        <h2 id="inspiration-input-title">创作图片</h2>
        <p>先选择作为画面基础的灵感原图；替换姿势、模特或产品的照片在下方“创作控制”中按需选择。</p>
      </div>
      <div className="inspiration-input-grid">
        <InspirationImageSlot
          number="BASE"
          icon={<ImagePlus aria-hidden="true" />}
          title="灵感原图"
          description="人物、姿势、构图和场景默认以这张图为基础"
          imageUrl={inspiration?.imageUrl}
          fileName={inspiration?.fileName}
          imageAlt="灵感原图"
          selectLabel="从图片库选择灵感原图"
          onOpenLibrary={() => setPickerOpen(true)}
          onRemove={onInspirationRemove}
        />
      </div>
      <MaterialPickerDialog
        open={pickerOpen}
        title="从图片库选择灵感原图"
        onPick={handleLibraryPick}
        onClose={() => setPickerOpen(false)}
      />
    </section>
  );
}

function InspirationImageSlot({
  number,
  icon,
  title,
  description,
  imageUrl,
  fileName,
  imageAlt,
  selectLabel,
  onOpenLibrary,
  onRemove,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
  imageUrl?: string;
  fileName?: string;
  imageAlt: string;
  selectLabel: string;
  onOpenLibrary: () => void;
  onRemove: () => void;
}) {
  return (
    <article className={`inspiration-image-slot${imageUrl ? " has-image" : ""}`}>
      <div className="inspiration-image-slot-heading">
        <span>{number}</span>
        <div><strong>{title}</strong><small>{description}</small></div>
      </div>
      {imageUrl ? (
        <img src={imageUrl} alt={imageAlt} referrerPolicy="no-referrer" />
      ) : (
        <div className="inspiration-image-placeholder">{icon}<span>等待图片</span></div>
      )}
      {fileName ? <p title={fileName}>{fileName}</p> : null}
      <div className="inspiration-slot-actions">
        <button type="button" className="secondary-button" onClick={onOpenLibrary}><Library aria-hidden="true" />{selectLabel}</button>
        {imageUrl ? (
          <button
            type="button"
            className="secondary-button inspiration-base-remove"
            aria-label="删除当前灵感原图"
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" />
            删除素材
          </button>
        ) : null}
      </div>
    </article>
  );
}
