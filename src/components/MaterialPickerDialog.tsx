import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, RefreshCw, X } from "lucide-react";
import { listMaterialLibraryAssets, type MaterialLibraryAsset } from "../api/materialLibraryApi";

interface MaterialPickerDialogProps {
  open: boolean;
  title: string;
  onPick: (asset: MaterialLibraryAsset) => void;
  onClose: () => void;
}

export function MaterialPickerDialog({ open, title, onPick, onClose }: MaterialPickerDialogProps) {
  const [assets, setAssets] = useState<MaterialLibraryAsset[]>([]);
  const [status, setStatus] = useState("正在读取图片库…");

  const load = async () => {
    setStatus("正在读取图片库…");
    try {
      const nextAssets = await listMaterialLibraryAssets();
      setAssets(nextAssets);
      setStatus(nextAssets.length > 0 ? "" : "图片库还没有图片，请先保存或生成图片。");
    } catch {
      setAssets([]);
      setStatus("图片库暂时无法同步，请稍后重试。");
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="module-reference-modal-backdrop material-picker-backdrop" role="presentation" onClick={onClose}>
      <section className="module-reference-modal material-picker-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="module-reference-modal-heading">
          <div><p className="eyebrow">Image Library</p><h3>{title}</h3></div>
          <button type="button" aria-label="关闭图片选择器" onClick={onClose}><X aria-hidden="true" /></button>
        </div>
        {assets.length > 0 ? (
          <div className="material-library-grid material-picker-grid">
            {assets.map((asset) => (
              <button type="button" key={asset.id} onClick={() => { onPick(asset); onClose(); }}>
                <img src={asset.imageUrl} alt={asset.fileName} referrerPolicy="no-referrer" />
                <span>{asset.fileName}</span>
                <small>{asset.sourceLabel}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="material-picker-empty"><ImagePlus aria-hidden="true" /><p>{status}</p></div>
        )}
        {status && assets.length > 0 ? <p className="material-library-inline-status">{status}</p> : null}
        <button type="button" className="secondary-button material-picker-retry" onClick={() => void load()}><RefreshCw aria-hidden="true" />重新读取</button>
      </section>
    </div>,
    document.body,
  );
}
