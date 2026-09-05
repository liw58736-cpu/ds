import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, RefreshCw, X } from "lucide-react";
import {
  listMaterialLibraryAssets,
  type MaterialLibraryAsset,
} from "../api/materialLibraryApi";

import {
  openLibrary,
  OPEN_LOGIN_EVENT,
  RETURN_LIBRARY_EVENT,
} from "../domain/navigationEvents";
import { getAccountSnapshot } from "../storage/accountStore";

interface MaterialPickerDialogProps {
  open: boolean;
  title: string;
  onPick: (asset: MaterialLibraryAsset) => void;
  onClose: () => void;
}

export function MaterialPickerDialog({
  open,
  title,
  onPick,
  onClose,
}: MaterialPickerDialogProps) {
  const pickerId = useId();
  const [search, setSearch] = useState("");
  const [returned, setReturned] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [assets, setAssets] = useState<MaterialLibraryAsset[]>([]);
  const [status, setStatus] = useState("正在读取图片库…");

  const load = async () => {
    setStatus("正在读取图片库…");
    try {
      const nextAssets = await listMaterialLibraryAssets();
      setAssets(nextAssets);
      setStatus(
        nextAssets.length > 0 ? "" : "图片库还没有图片，请先保存或生成图片。",
      );
    } catch {
      setAssets([]);
      setStatus("图片库暂时无法同步，请稍后重试。");
    }
  };

  useEffect(() => {
    if (!suspended && (open || returned)) void load();
  }, [open, returned, suspended]);

  useEffect(() => {
    const handle = (event: Event) => {
      if ((event as CustomEvent).detail?.pickerId === pickerId) {
        setReturned(true);
        setSuspended(false);
      }
    };
    window.addEventListener(RETURN_LIBRARY_EVENT, handle);
    return () => window.removeEventListener(RETURN_LIBRARY_EVENT, handle);
  }, [pickerId]);

  if (suspended || (!open && !returned)) return null;
  const close = () => {
    setReturned(false);
    onClose();
  };
  const filtered = assets.filter((asset) =>
    asset.fileName.toLowerCase().includes(search.toLowerCase()),
  );

  return createPortal(
    <div
      className="module-reference-modal-backdrop material-picker-backdrop"
      role="presentation"
      onClick={close}
    >
      <section
        className="module-reference-modal material-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="module-reference-modal-heading">
          <div>
            <p className="eyebrow">Image Library</p>
            <h3>{title}</h3>
          </div>
          <button type="button" aria-label="关闭图片选择器" onClick={close}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="library-toolbar">
          <input
            aria-label="搜索图片"
            placeholder="搜索图片名称"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setSuspended(true);
              openLibrary(pickerId);
            }}
          >
            去图片库上传
          </button>
          {!getAccountSnapshot().session ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                close();
                window.dispatchEvent(new Event(OPEN_LOGIN_EVENT));
              }}
            >
              登录后查看图片
            </button>
          ) : null}
        </div>
        {assets.length > 0 ? (
          <div className="material-library-grid material-picker-grid">
            {filtered.map((asset) => (
              <button
                type="button"
                key={asset.id}
                onClick={() => {
                  onPick(asset);
                  close();
                }}
              >
                <img
                  src={asset.imageUrl}
                  alt={asset.fileName}
                  referrerPolicy="no-referrer"
                />
                <span>{asset.fileName}</span>
                <small>{asset.sourceLabel}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="material-picker-empty">
            <ImagePlus aria-hidden="true" />
            <p>{status}</p>
          </div>
        )}
        {status && assets.length > 0 ? (
          <p className="material-library-inline-status">{status}</p>
        ) : null}
        <button
          type="button"
          className="secondary-button material-picker-retry"
          onClick={() => void load()}
        >
          <RefreshCw aria-hidden="true" />
          重新读取
        </button>
      </section>
    </div>,
    document.body,
  );
}
