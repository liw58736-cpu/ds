import { useState } from "react";
import type { ReactNode } from "react";
import { ImagePlus, Library, Shirt } from "lucide-react";
import type { ModuleReferenceAsset, ProductInput } from "../domain/types";
import type { MaterialLibraryAsset } from "../api/materialLibraryApi";
import { MaterialPickerDialog } from "./MaterialPickerDialog";

interface InspirationUploadPanelProps {
  inspiration: ProductInput | null;
  replacement?: ModuleReferenceAsset;
  onInspirationChange: (product: ProductInput) => void;
  onReplacementChange: (asset: ModuleReferenceAsset) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("图片读取失败"));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function productFromFile(file: File, imageUrl: string): ProductInput {
  return {
    id: `inspiration-${file.name}-${file.lastModified}`,
    imageUrl,
    fileName: file.name,
    createdAt: new Date().toISOString(),
    source: "upload",
  };
}

function replacementFromFile(file: File, imageUrl: string): ModuleReferenceAsset {
  return {
    id: `replacement-${file.name}-${file.lastModified}`,
    imageUrl,
    fileName: file.name,
    note: "Use Image 2 as the replacement product or clothing.",
  };
}

export function InspirationUploadPanel({
  inspiration,
  replacement,
  onInspirationChange,
  onReplacementChange,
}: InspirationUploadPanelProps) {
  const [pickerRole, setPickerRole] = useState<"inspiration" | "replacement" | null>(null);

  const handleInspirationFile = async (file: File | undefined) => {
    if (!file) return;
    onInspirationChange(productFromFile(file, await readFileAsDataUrl(file)));
  };

  const handleReplacementFile = async (file: File | undefined) => {
    if (!file) return;
    onReplacementChange(replacementFromFile(file, await readFileAsDataUrl(file)));
  };

  const handleLibraryPick = (asset: MaterialLibraryAsset) => {
    if (pickerRole === "inspiration") {
      onInspirationChange({
        id: `library-inspiration-${Date.now().toString(36)}`,
        imageUrl: asset.imageUrl,
        fileName: asset.fileName,
        createdAt: new Date().toISOString(),
        source: "upload",
      });
      return;
    }
    onReplacementChange({
      id: `library-replacement-${Date.now().toString(36)}`,
      imageUrl: asset.imageUrl,
      fileName: asset.fileName,
      note: "Use Image 2 as the replacement product or clothing.",
    });
  };

  return (
    <section className="panel inspiration-input-panel" aria-labelledby="inspiration-input-title">
      <div className="panel-heading">
        <p className="eyebrow">Two-image creation</p>
        <h2 id="inspiration-input-title">创作图片</h2>
        <p>第一张是要保留人物和画面的灵感原图；第二张是要替换进去的产品或服装。</p>
      </div>
      <div className="inspiration-input-grid">
        <InspirationImageSlot
          number="01"
          icon={<ImagePlus aria-hidden="true" />}
          title="灵感原图"
          description="人物、姿势、构图和场景以这张图为基础"
          imageUrl={inspiration?.imageUrl}
          fileName={inspiration?.fileName}
          imageAlt="灵感原图"
          uploadLabel="上传灵感原图"
          onFile={handleInspirationFile}
          onOpenLibrary={() => setPickerRole("inspiration")}
        />
        <InspirationImageSlot
          number="02"
          icon={<Shirt aria-hidden="true" />}
          title="产品 / 服装图"
          description="将这张产品或服装自然替换到灵感原图中"
          imageUrl={replacement?.imageUrl}
          fileName={replacement?.fileName}
          imageAlt="替换产品服装图"
          uploadLabel="上传产品服装图"
          onFile={handleReplacementFile}
          onOpenLibrary={() => setPickerRole("replacement")}
        />
      </div>
      <MaterialPickerDialog
        open={pickerRole !== null}
        title={pickerRole === "inspiration" ? "从素材库选择灵感原图" : "从素材库选择产品 / 服装图"}
        onPick={handleLibraryPick}
        onClose={() => setPickerRole(null)}
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
  uploadLabel,
  onFile,
  onOpenLibrary,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
  imageUrl?: string;
  fileName?: string;
  imageAlt: string;
  uploadLabel: string;
  onFile: (file?: File) => void;
  onOpenLibrary: () => void;
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
        <label className="secondary-button">
          <ImagePlus aria-hidden="true" />{uploadLabel}
          <input type="file" accept="image/*" aria-label={uploadLabel} onChange={(event) => { void onFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        </label>
        <button type="button" className="secondary-button" onClick={onOpenLibrary}><Library aria-hidden="true" />从素材库选择</button>
      </div>
    </article>
  );
}
