import { type ChangeEvent, useEffect, useState } from "react";
import {
  Download,
  ImagePlus,
  Link2,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import {
  importPublicMaterial,
  saveImportedMaterial,
  uploadLocalMaterial,
} from "../api/materialImportApi";
import {
  listMaterialLibraryAssets,
  type MaterialLibraryAsset,
} from "../api/materialLibraryApi";
import { NoticeDialog } from "./NoticeDialog";

interface MaterialLibraryPageProps {
  isAuthenticated: boolean;
  onReturn?: () => void;
  onRequireLogin: () => void;
}

interface PageNotice {
  title: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
}

export function MaterialLibraryPage({
  isAuthenticated,
  onRequireLogin,
  onReturn,
}: MaterialLibraryPageProps) {
  const [importMode, setImportMode] = useState<"upload" | "link" | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [lightbox, setLightbox] = useState<MaterialLibraryAsset | null>(null);
  const [extractedPreview, setExtractedPreview] = useState<{
    imageUrl: string;
    index: number;
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [remoteOffset, setRemoteOffset] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [pageLimit, setPageLimit] = useState(40);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [sourcePageUrl, setSourcePageUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [assets, setAssets] = useState<MaterialLibraryAsset[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [failedUploads, setFailedUploads] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(
    "可一次选择多张图片，每张不超过 20MB。",
  );
  const [libraryStatus, setLibraryStatus] = useState("");
  const [message, setMessage] = useState(
    "粘贴小红书分享文案或公开链接，提取后只保存需要的照片。",
  );
  const [notice, setNotice] = useState<PageNotice | null>(null);

  const loadLibrary = async () => {
    if (!isAuthenticated) {
      setAssets([]);
      setLibraryStatus("登录后查看并复用保存图片与生成结果。");
      return;
    }
    setLibraryStatus("正在同步图片库…");
    try {
      const nextAssets = await listMaterialLibraryAssets();
      setAssets(nextAssets);
      setLibraryStatus(
        nextAssets.length > 0 ? "" : "图片库还是空的，先提取、上传或生成图片。",
      );
    } catch {
      setLibraryStatus("图片库暂时无法同步，已保留上次图片。请重新读取。");
    }
  };

  useEffect(() => {
    void loadLibrary();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!extractedPreview) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExtractedPreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [extractedPreview]);

  const requireLogin = () => {
    if (isAuthenticated) return false;
    setNotice({
      title: "请先登录",
      message: "登录后才能提取并保存图片，照片也会保留在个人图片库中。",
      primaryLabel: "去登录",
      onPrimary: onRequireLogin,
    });
    return true;
  };

  const handleExtract = async () => {
    if (!url.trim()) {
      setNotice({
        title: "还没有链接",
        message: "请粘贴小红书分享文案或公开笔记链接。",
      });
      return;
    }
    if (requireLogin()) return;

    setIsExtracting(true);
    setMessage("正在提取公开笔记图片…");
    try {
      const result = await importPublicMaterial(url.trim(), true);
      setTitle(result.title);
      setSourcePageUrl(result.sourceUrl);
      setImages(result.images);
      setSelectedImages(new Set());
      setMessage(
        `已提取 ${result.images.length} 张图片，请勾选需要保存的照片。`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "图片提取失败。";
      setMessage(errorMessage);
      setNotice({ title: "图片提取失败", message: errorMessage });
    } finally {
      setIsExtracting(false);
    }
  };

  const runUploads = async (files: File[]) => {
    if (files.length === 0 || requireLogin()) return;
    if (files.length > 30) {
      setNotice({
        title: "本次最多上传 30 张",
        message: "请分批上传，本次没有忽略任何图片。",
      });
      return;
    }
    setIsUploading(true);
    setFailedUploads([]);
    let succeeded = 0;
    const failures: File[] = [];
    const errors: string[] = [];
    for (const [index, file] of files.entries()) {
      setUploadStatus(`正在上传 ${index + 1} / ${files.length}：${file.name}`);
      try {
        await uploadLocalMaterial(file);
        succeeded++;
      } catch (error) {
        failures.push(file);
        errors.push(
          `${file.name}：${error instanceof Error ? error.message : "上传失败"}`,
        );
      }
    }
    setIsUploading(false);
    setFailedUploads(failures);
    setUploadStatus(
      failures.length
        ? `已上传 ${succeeded} 张，${failures.length} 张失败。`
        : `已上传 ${succeeded} 张图片。`,
    );
    await loadLibrary();
    if (errors.length)
      setNotice({ title: "部分图片上传失败", message: errors.join("；") });
  };
  const handleLocalUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    await runUploads(files);
  };

  const toggleImage = (imageUrl: string) => {
    setSelectedImages((current) => {
      const next = new Set(current);
      if (next.has(imageUrl)) next.delete(imageUrl);
      else next.add(imageUrl);
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedImages.size === 0) {
      setNotice({
        title: "还没有选择照片",
        message: "请勾选需要保存到图片库的照片。",
      });
      return;
    }
    if (requireLogin()) return;

    setIsSaving(true);
    const selected = images.filter((imageUrl) => selectedImages.has(imageUrl));
    const results = await Promise.allSettled(
      selected.map((imageUrl, index) =>
          saveImportedMaterial(
            imageUrl,
            true,
            `${title.replace(/\s+-\s+小红书$/u, "") || "小红书素材"}-${index + 1}`,
            sourcePageUrl,
          ),
      ),
    );
    const failedUrls = selected.filter(
      (_, index) => results[index].status === "rejected",
    );
    const succeeded = selected.length - failedUrls.length;
    try {
      setSelectedImages(new Set(failedUrls));
      setMessage(
        failedUrls.length
          ? `已保存 ${succeeded} 张，${failedUrls.length} 张未保存，可直接重试。`
          : `已保存 ${succeeded} 张照片。`,
      );
      await loadLibrary();
      if (failedUrls.length) {
        const reasons = results.flatMap((result) =>
          result.status === "rejected"
            ? [result.reason instanceof Error ? result.reason.message : "保存失败"]
            : [],
        );
        setNotice({
          title: succeeded ? "部分照片保存失败" : "保存失败",
          message: `${reasons.slice(0, 3).join("；")} 失败照片仍保持选中，可再次点击保存。`,
        });
      }
    } catch (error) {
      setNotice({
        title: "保存失败",
        message: error instanceof Error ? error.message : "暂时无法保存照片。",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = assets.filter(
    (asset) =>
      (source === "all" || asset.source === source) &&
      asset.fileName.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <main className="page-surface material-library-page">
      <section className="page-heading">
        <p className="eyebrow">Image Library</p>
        <h1>图片库</h1>
        <p>统一管理小红书提取图片、手动保存图片和所有生成结果。</p>
        <div className="library-toolbar">
          <button
            type="button"
            className={`primary-button${importMode === "upload" ? " is-active" : ""}`}
            aria-expanded={importMode === "upload"}
            aria-controls="material-local-upload"
            disabled={isUploading}
            onClick={() =>
              setImportMode(importMode === "upload" ? null : "upload")
            }
          >
            {importMode === "upload" ? "收起批量上传" : "批量上传"}
          </button>
          <button
            type="button"
            className={`secondary-button${importMode === "link" ? " is-active" : ""}`}
            aria-expanded={importMode === "link"}
            aria-controls="material-link-import"
            disabled={isExtracting || isSaving}
            onClick={() => setImportMode(importMode === "link" ? null : "link")}
          >
            {importMode === "link" ? "收起链接提取" : "链接提取"}
          </button>
          {onReturn ? (
            <button
              type="button"
              className="secondary-button"
              disabled={isUploading || isSaving}
              onClick={onReturn}
            >
              返回创作并选图
            </button>
          ) : null}
        </div>
      </section>

      <section
        id="material-local-upload"
        hidden={importMode !== "upload"}
        className="panel material-local-upload-panel"
        aria-labelledby="material-local-upload-title"
      >
        <div className="panel-heading">
          <p className="eyebrow">Local Upload</p>
          <h2 id="material-local-upload-title">从本地批量上传</h2>
          <p>本地照片先统一保存到图片库，再到各个工具中选择使用。</p>
        </div>
        <label
          className={`material-local-upload${isUploading ? " is-uploading" : ""}`}
        >
          {isUploading ? (
            <LoaderCircle className="is-spinning" aria-hidden="true" />
          ) : (
            <ImagePlus aria-hidden="true" />
          )}
          <strong>{isUploading ? "正在上传图片" : "选择本地图片"}</strong>
          <span>支持 JPG、PNG、WebP，可一次选择多张</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            disabled={isUploading}
            aria-label="从本地批量上传图片"
            onChange={(event) => void handleLocalUpload(event)}
          />
        </label>
        <p className="material-library-inline-status" role="status">
          {uploadStatus}
        </p>
        {failedUploads.length > 0 ? (
          <button
            type="button"
            className="secondary-button"
            disabled={isUploading}
            onClick={() => void runUploads(failedUploads)}
          >
            重试失败的 {failedUploads.length} 张
          </button>
        ) : null}
      </section>

      <section
        id="material-link-import"
        hidden={importMode !== "link"}
        className="panel material-extract-panel"
        aria-labelledby="material-extract-title"
      >
        <div className="panel-heading">
          <p className="eyebrow">Xiaohongshu Extractor</p>
          <h2 id="material-extract-title">链接提取</h2>
          <p>提取后先多选照片，再保存到个人图片库。</p>
        </div>
        <div className="material-extract-workbench">
          <div className="material-extract-source">
            <div className="material-import-form">
              <label className="field">
                <span>分享文案或公开链接</span>
                <div className="material-import-url-row">
                  <Link2 aria-hidden="true" />
                  <input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    aria-label="小红书素材链接"
                    placeholder="粘贴整段分享文案，或 https://…"
                  />
                </div>
              </label>
              <button
                type="button"
                className="primary-button"
                disabled={isExtracting}
                onClick={() => void handleExtract()}
              >
                {isExtracting ? (
                  <LoaderCircle className="is-spinning" aria-hidden="true" />
                ) : (
                  <Link2 aria-hidden="true" />
                )}
                {isExtracting ? "正在提取" : "提取图片"}
              </button>
              <p className="material-import-message" role="status">
                {message}
              </p>
            </div>
          </div>

          <section className="material-pick-section" aria-label="提取结果">
            <div className="material-section-heading">
              <div>
                <strong>提取照片</strong>
                <span>
                  已选 {selectedImages.size} / {images.length}
                </span>
              </div>
              {images.length > 0 ? (
                <button
                  type="button"
                  className="primary-button"
                  disabled={isSaving}
                  onClick={() => void handleSave()}
                >
                  {isSaving
                    ? "保存中…"
                    : `保存选中照片（${selectedImages.size}）`}
                </button>
              ) : null}
            </div>
            {images.length > 0 ? (
              <div className="material-import-grid">
                {images.map((imageUrl, index) => (
                  <article
                    className={`material-pick-card${selectedImages.has(imageUrl) ? " is-selected" : ""}`}
                    key={imageUrl}
                  >
                    <button
                      type="button"
                      className="material-extracted-thumbnail"
                      aria-label={`全屏预览提取照片 ${index + 1}`}
                      onClick={() => setExtractedPreview({ imageUrl, index })}
                    >
                      <img
                        src={imageUrl}
                        alt={`提取照片 ${index + 1}`}
                        referrerPolicy="no-referrer"
                      />
                    </button>
                    <label className="material-pick-check">
                      <input
                        type="checkbox"
                        checked={selectedImages.has(imageUrl)}
                        onChange={() => toggleImage(imageUrl)}
                        aria-label={`选择照片 ${index + 1}`}
                      />
                      保存第 {index + 1} 张
                    </label>
                  </article>
                ))}
              </div>
            ) : (
              <div className="material-extract-empty">
                <ImagePlus aria-hidden="true" />
                <strong>等待提取照片</strong>
                <span>左侧粘贴链接并提取，结果会以缩略图显示在这里。</span>
              </div>
            )}
          </section>
        </div>
      </section>

      <section
        className="panel material-assets-panel"
        aria-labelledby="material-assets-title"
      >
        <div className="material-section-heading">
          <div>
            <p className="eyebrow">All Images</p>
            <h2 id="material-assets-title">全部图片</h2>
            <span>保存图片与生成结果都会显示在这里</span>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadLibrary()}
          >
            <RefreshCw aria-hidden="true" />
            重新读取
          </button>
        </div>
        <div className="library-toolbar">
          <input
            aria-label="搜索图片名称"
            placeholder="搜索图片名称"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageLimit(40);
            }}
          />
          <select
            aria-label="图片来源"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">全部图片</option>
            <option value="saved">已上传 / 已提取</option>
            <option value="generated">生成结果</option>
          </select>
          <button
            type="button"
            className="secondary-button"
            disabled={!selected.size}
            onClick={async () => {
              try {
                for (const asset of assets.filter((a) => selected.has(a.id)))
                  await downloadLibraryImage(asset);
              } catch (error) {
                setNotice({
                  title: "下载未完成",
                  message:
                    error instanceof Error ? error.message : "下载失败，请重试",
                });
              }
            }}
          >
            下载已选（{selected.size}）
          </button>
        </div>
        {libraryStatus && assets.length > 0 ? (
          <p role="status">{libraryStatus}</p>
        ) : null}
        {assets.length > 0 ? (
          <div className="material-library-grid">
            {filtered.slice(0, pageLimit).map((asset) => (
              <MaterialAssetCard
                key={asset.id}
                asset={asset}
                onPreview={() => setLightbox(asset)}
                selected={selected.has(asset.id)}
                onToggle={() =>
                  setSelected((current) => {
                    const next = new Set(current);
                    next.has(asset.id)
                      ? next.delete(asset.id)
                      : next.add(asset.id);
                    return next;
                  })
                }
              />
            ))}
          </div>
        ) : (
          <div className="material-library-empty">
            <ImagePlus aria-hidden="true" />
            <p>{libraryStatus}</p>
          </div>
        )}
      </section>

      {hasOlder ? (
        <button
          type="button"
          disabled={loadingOlder}
          className="secondary-button"
          onClick={async () => {
            setLoadingOlder(true);
            try {
              const next = await listMaterialLibraryAssets(remoteOffset + 100);
              setRemoteOffset(remoteOffset + 100);
              setHasOlder(next.length > 0);
              setAssets((current) => [
                ...new Map(
                  [...current, ...next].map((asset) => [asset.id, asset]),
                ).values(),
              ]);
              setPageLimit((current) => current + 100);
            } catch {
              setLibraryStatus("较早图片暂未读取成功，请重试。");
            } finally {
              setLoadingOlder(false);
            }
          }}
        >
          {loadingOlder ? "正在读取" : "读取更早图片"}
        </button>
      ) : null}
      {filtered.length > pageLimit ? (
        <button
          type="button"
          className="secondary-button"
          onClick={() => setPageLimit((current) => current + 40)}
        >
          显示更多图片
        </button>
      ) : null}
      {lightbox ? (
        <div
          className="preview-lightbox"
          role="dialog"
          aria-label="图片预览"
          onClick={() => setLightbox(null)}
        >
          <div className="preview-lightbox-content">
            <button type="button" onClick={() => setLightbox(null)}>
              关闭
            </button>
            <img src={lightbox.imageUrl} alt={lightbox.fileName} />
          </div>
        </div>
      ) : null}
      {extractedPreview ? (
        <div
          className="preview-lightbox extracted-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`提取照片 ${extractedPreview.index + 1} 大图预览`}
          onClick={() => setExtractedPreview(null)}
        >
          <div
            className="preview-lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="preview-lightbox-header">
              <strong>提取照片 {extractedPreview.index + 1}</strong>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setExtractedPreview(null)}
              >
                关闭
              </button>
            </div>
            <img
              src={extractedPreview.imageUrl}
              alt={`提取照片 ${extractedPreview.index + 1} 大图`}
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      ) : null}
      <NoticeDialog
        open={Boolean(notice)}
        title={notice?.title ?? "提示"}
        message={notice?.message ?? ""}
        primaryLabel={notice?.primaryLabel}
        onPrimary={notice?.onPrimary}
        onClose={() => setNotice(null)}
      />
    </main>
  );
}

export async function downloadLibraryImage(asset: MaterialLibraryAsset) {
  const response = await fetch(asset.imageUrl);
  if (!response.ok) throw new Error("下载失败，请重试");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const ext = blob.type.includes("jpeg")
    ? "jpg"
    : blob.type.includes("webp")
      ? "webp"
      : blob.type.includes("png")
        ? "png"
        : "img";
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${asset.fileName.replace(/\.[^.]+$/, "")}.${ext}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function MaterialAssetCard({
  asset,
  onPreview,
  selected,
  onToggle,
}: {
  asset: MaterialLibraryAsset;
  onPreview: () => void;
  selected: boolean;
  onToggle: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <article>
      <button
        type="button"
        onClick={onPreview}
        aria-label={`预览 ${asset.fileName}`}
        className="library-image-preview"
      >
        <img
          src={asset.imageUrl}
          alt={asset.fileName}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </button>
      <label>
        <input type="checkbox" checked={selected} onChange={onToggle} />
        {asset.fileName}
      </label>
      <span>{asset.sourceLabel}</span>
      <button
        type="button"
        className="ghost-action-button"
        onClick={() =>
          void downloadLibraryImage(asset).catch(() =>
            setError("下载失败，请稍后重试。"),
          )
        }
      >
        <Download aria-hidden="true" />
        下载
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </article>
  );
}
