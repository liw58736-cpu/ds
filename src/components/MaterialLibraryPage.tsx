import { useEffect, useState } from "react";
import { Download, ImagePlus, Link2, LoaderCircle, RefreshCw } from "lucide-react";
import {
  importPublicMaterial,
  saveImportedMaterial,
} from "../api/materialImportApi";
import { listMaterialLibraryAssets, type MaterialLibraryAsset } from "../api/materialLibraryApi";
import { NoticeDialog } from "./NoticeDialog";

interface MaterialLibraryPageProps {
  isAuthenticated: boolean;
  onRequireLogin: () => void;
}

interface PageNotice {
  title: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
}

export function MaterialLibraryPage({ isAuthenticated, onRequireLogin }: MaterialLibraryPageProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [assets, setAssets] = useState<MaterialLibraryAsset[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [libraryStatus, setLibraryStatus] = useState("");
  const [message, setMessage] = useState("粘贴小红书分享文案或公开链接，提取后只保存需要的照片。");
  const [notice, setNotice] = useState<PageNotice | null>(null);

  const loadLibrary = async () => {
    if (!isAuthenticated) {
      setAssets([]);
      setLibraryStatus("登录后查看并复用保存素材与生成结果。");
      return;
    }
    setLibraryStatus("正在同步素材库…");
    try {
      const nextAssets = await listMaterialLibraryAssets();
      setAssets(nextAssets);
      setLibraryStatus(nextAssets.length > 0 ? "" : "素材库还是空的，先提取、上传或生成图片。");
    } catch {
      setAssets([]);
      setLibraryStatus("素材库暂时无法同步。点击“重新读取”重试。");
    }
  };

  useEffect(() => {
    void loadLibrary();
  }, [isAuthenticated]);

  const requireLogin = () => {
    if (isAuthenticated) return false;
    setNotice({
      title: "请先登录",
      message: "登录后才能提取并保存图片，素材也会保留在个人素材库中。",
      primaryLabel: "去登录",
      onPrimary: onRequireLogin,
    });
    return true;
  };

  const handleExtract = async () => {
    if (!url.trim()) {
      setNotice({ title: "还没有链接", message: "请粘贴小红书分享文案或公开笔记链接。" });
      return;
    }
    if (requireLogin()) return;

    setIsExtracting(true);
    setMessage("正在提取公开笔记图片…");
    try {
      const result = await importPublicMaterial(url.trim(), true);
      setTitle(result.title);
      setImages(result.images);
      setSelectedImages(new Set());
      setMessage(`已提取 ${result.images.length} 张图片，请勾选需要保存的照片。`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "图片提取失败。";
      setMessage(errorMessage);
      setNotice({ title: "图片提取失败", message: errorMessage });
    } finally {
      setIsExtracting(false);
    }
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
      setNotice({ title: "还没有选择照片", message: "请勾选需要保存到素材库的照片。" });
      return;
    }
    if (requireLogin()) return;

    setIsSaving(true);
    const selected = images.filter((imageUrl) => selectedImages.has(imageUrl));
    try {
      await Promise.all(selected.map((imageUrl, index) =>
        saveImportedMaterial(
          imageUrl,
          true,
          `${title.replace(/\s+-\s+小红书$/u, "") || "小红书素材"}-${index + 1}`,
        ),
      ));
      setSelectedImages(new Set());
      setMessage(`已保存 ${selected.length} 张照片。`);
      await loadLibrary();
    } catch (error) {
      setNotice({
        title: "保存失败",
        message: error instanceof Error ? error.message : "暂时无法保存照片。",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="page-surface material-library-page">
      <section className="page-heading">
        <p className="eyebrow">Material Library</p>
        <h1>素材库</h1>
        <p>统一管理小红书提取图片、手动保存素材和所有生成结果。</p>
      </section>

      <section className="panel material-extract-panel" aria-labelledby="material-extract-title">
        <div className="panel-heading">
          <p className="eyebrow">Xiaohongshu Extractor</p>
          <h2 id="material-extract-title">链接提取</h2>
          <p>提取后先多选照片，再保存到个人素材库。</p>
        </div>
        <div className="material-import-form">
          <label className="field">
            <span>分享文案或公开链接</span>
            <div className="material-import-url-row">
              <Link2 aria-hidden="true" />
              <input value={url} onChange={(event) => setUrl(event.target.value)} aria-label="小红书素材链接" placeholder="粘贴整段分享文案，或 https://…" />
            </div>
          </label>
          <button type="button" className="primary-button" disabled={isExtracting} onClick={() => void handleExtract()}>
            {isExtracting ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
            {isExtracting ? "正在提取" : "提取图片"}
          </button>
          <p className="material-import-message" role="status">{message}</p>
        </div>

        {images.length > 0 ? (
          <div className="material-pick-section">
            <div className="material-section-heading">
              <div><strong>选择要保存的照片</strong><span>已选 {selectedImages.size} / {images.length}</span></div>
              <button type="button" className="primary-button" disabled={isSaving} onClick={() => void handleSave()}>
                {isSaving ? "保存中…" : `保存选中照片（${selectedImages.size}）`}
              </button>
            </div>
            <div className="material-import-grid">
              {images.map((imageUrl, index) => (
                <label className={`material-pick-card${selectedImages.has(imageUrl) ? " is-selected" : ""}`} key={imageUrl}>
                  <img src={imageUrl} alt={`提取照片 ${index + 1}`} referrerPolicy="no-referrer" />
                  <span className="material-pick-check">
                    <input type="checkbox" checked={selectedImages.has(imageUrl)} onChange={() => toggleImage(imageUrl)} aria-label={`选择照片 ${index + 1}`} />
                    保存第 {index + 1} 张
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel material-assets-panel" aria-labelledby="material-assets-title">
        <div className="material-section-heading">
          <div><p className="eyebrow">All Assets</p><h2 id="material-assets-title">全部素材</h2><span>保存素材与生成结果都会显示在这里</span></div>
          <button type="button" className="secondary-button" onClick={() => void loadLibrary()}><RefreshCw aria-hidden="true" />重新读取</button>
        </div>
        {assets.length > 0 ? (
          <div className="material-library-grid">
            {assets.map((asset) => <MaterialAssetCard key={asset.id} asset={asset} />)}
          </div>
        ) : (
          <div className="material-library-empty"><ImagePlus aria-hidden="true" /><p>{libraryStatus}</p></div>
        )}
      </section>

      <NoticeDialog open={Boolean(notice)} title={notice?.title ?? "提示"} message={notice?.message ?? ""} primaryLabel={notice?.primaryLabel} onPrimary={notice?.onPrimary} onClose={() => setNotice(null)} />
    </main>
  );
}

function MaterialAssetCard({ asset }: { asset: MaterialLibraryAsset }) {
  const [downloadError, setDownloadError] = useState("");
  const handleDownload = async () => {
    try {
      const response = await fetch(asset.imageUrl);
      if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${asset.fileName.replace(/[\\/:*?"<>|]+/g, "-") || "kroma-material"}.png`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setDownloadError("下载失败，请稍后重试。");
    }
  };

  return (
    <article>
      <img src={asset.imageUrl} alt={asset.fileName} loading="lazy" referrerPolicy="no-referrer" />
      <div><strong>{asset.fileName}</strong><span>{asset.sourceLabel}</span></div>
      <button type="button" className="ghost-action-button" onClick={() => void handleDownload()}><Download aria-hidden="true" />下载</button>
      {downloadError ? <small>{downloadError}</small> : null}
    </article>
  );
}
