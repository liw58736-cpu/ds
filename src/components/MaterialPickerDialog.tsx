import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, RefreshCw, X } from "lucide-react";
import {
  getCachedMaterialLibraryAssets,
  listMaterialLibraryAssets,
  type MaterialLibraryAsset,
  type MaterialLibraryProgress,
} from "../api/materialLibraryApi";

import {
  openLibrary,
  OPEN_LOGIN_EVENT,
  RETURN_LIBRARY_EVENT,
} from "../domain/navigationEvents";
import { ACCOUNT_CHANGED_EVENT, getAccountSnapshot } from "../storage/accountStore";
import { getStorageOwner } from "../storage/workspaceDraftStore";

const pageSize = 40;
function mergeAssets(...pages: MaterialLibraryAsset[][]): MaterialLibraryAsset[] {
  return [...new Map(pages.flat().map((asset) => [asset.imageUrl, asset])).values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

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
  const [visibleLimit, setVisibleLimit] = useState(16);
  const [returned, setReturned] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [owner, setOwner] = useState(getStorageOwner);
  const ownerRef = useRef(owner);
  const requestRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const activeRef = useRef(false);
  const nextOffsetRef = useRef(0);
  const [hasOlder, setHasOlder] = useState(true);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<MaterialLibraryAsset[]>(() =>
    open ? getCachedMaterialLibraryAssets(owner) : [],
  );
  const assetsRef = useRef(assets);
  activeRef.current = !suspended && (open || returned);
  const [status, setStatus] = useState(() =>
    assets.length
      ? "正在后台同步最新图片…"
      : "正在读取图片库…",
  );

  const updateAssets = (next: MaterialLibraryAsset[]) => {
    assetsRef.current = next;
    setAssets(next);
  };
  const load = async (offset = 0) => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const requestId = ++requestRef.current;
    const requestOwner = ownerRef.current;
    const isCurrent = () => activeRef.current && requestId === requestRef.current &&
      ownerRef.current === requestOwner && getStorageOwner() === requestOwner;
    const cached = offset === 0 ? getCachedMaterialLibraryAssets(requestOwner) : [];
    if (offset === 0) {
      updateAssets(mergeAssets(assetsRef.current, cached));
      setStatus(assetsRef.current.length
        ? "已显示最近图片，正在后台同步最新内容…" : "正在读取图片库…");
    } else setStatus("正在读取更早图片…");
    setLoading(true);
    let latestProgress: MaterialLibraryProgress | undefined;
    try {
      const nextAssets = await listMaterialLibraryAssets(offset, pageSize, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (!isCurrent()) return;
          latestProgress = progress;
          updateAssets(mergeAssets(assetsRef.current, progress.assets));
          if (progress.pending && progress.assets.length)
            setStatus("已显示最近图片，正在后台同步最新内容…");
        },
      });
      if (!isCurrent()) return;
      if (latestProgress?.failedSources.length) {
        updateAssets(mergeAssets(assetsRef.current, nextAssets));
        // Retry this same page before advancing either source's offset.
        nextOffsetRef.current = offset;
        setHasOlder(true);
        setStatus("部分图片暂未同步，已保留当前图片。请重新读取。");
      } else {
        updateAssets(offset === 0 ? nextAssets : mergeAssets(assetsRef.current, nextAssets));
        nextOffsetRef.current = offset + pageSize;
        setHasOlder(latestProgress?.hasMore ?? true);
        setStatus(assetsRef.current.length ? "" : latestProgress?.hasMore
          ? "本页没有可选图片，可以继续读取更早图片。"
          : "图片库还没有图片，请先保存或生成图片。");
      }
      if (offset > 0) setVisibleLimit((current) => current + pageSize);
    } catch {
      if (!isCurrent()) return;
      setStatus(
        offset > 0 ? "较早图片暂未读取成功，已保留当前图片。请重试。"
          : assetsRef.current.length ? "最新内容暂未同步，当前显示最近图片。"
            : "图片库暂时无法同步，请稍后重试。",
      );
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  useEffect(() => {
    const syncOwner = () => {
      const nextOwner = getStorageOwner();
      if (nextOwner === ownerRef.current) return;
      ++requestRef.current;
      requestControllerRef.current?.abort();
      ownerRef.current = nextOwner;
      updateAssets([]);
      nextOffsetRef.current = 0;
      setHasOlder(true);
      setSearch("");
      setOwner(nextOwner);
    };
    window.addEventListener(ACCOUNT_CHANGED_EVENT, syncOwner);
    window.addEventListener("storage", syncOwner);
    syncOwner();
    return () => {
      window.removeEventListener(ACCOUNT_CHANGED_EVENT, syncOwner);
      window.removeEventListener("storage", syncOwner);
    };
  }, []);

  useEffect(() => {
    activeRef.current = !suspended && (open || returned);
    if (activeRef.current) void load();
    return () => {
      activeRef.current = false;
      ++requestRef.current;
      requestControllerRef.current?.abort();
    };
  }, [open, returned, suspended, owner]);

  useEffect(() => setVisibleLimit(16), [open, returned, search, owner]);

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
    activeRef.current = false;
    ++requestRef.current;
    requestControllerRef.current?.abort();
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
              activeRef.current = false;
              ++requestRef.current;
              requestControllerRef.current?.abort();
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
            {filtered.slice(0, visibleLimit).map((asset) => (
              <button
                type="button"
                key={asset.id}
                onClick={() => {
                  if (!activeRef.current || getStorageOwner() !== owner) return;
                  onPick(asset);
                  close();
                }}
              >
                <img
                  src={asset.imageUrl}
                  alt={asset.fileName}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
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
        {filtered.length > visibleLimit ? (
          <button
            type="button"
            className="secondary-button material-picker-more"
            onClick={() => setVisibleLimit((current) => current + 16)}
          >
            显示更多图片（剩余 {filtered.length - visibleLimit} 张）
          </button>
        ) : null}
        {hasOlder ? (
          <button
            type="button"
            className="secondary-button material-picker-more"
            disabled={loading}
            onClick={() => void load(nextOffsetRef.current)}
          >
            {loading ? "正在读取图片…" : "读取更早图片"}
          </button>
        ) : null}
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
