import { useEffect, useState } from "react";
import { Download, ImagePlus, Link2, LoaderCircle, Shirt, UserRound } from "lucide-react";
import {
  importPublicMaterial,
  listSavedMaterials,
  saveImportedMaterial,
  type SavedMaterial,
} from "../api/materialImportApi";
import { NoticeDialog } from "./NoticeDialog";

interface MaterialNotice {
  title: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
}

interface MaterialImportPanelProps {
  onUseAsProduct: (imageUrl: string, title: string) => void;
  onUseAsReference: (imageUrl: string, title: string) => void;
  onUseAsModelReference?: (imageUrl: string, title: string) => void;
  onUseAsGarmentReference?: (imageUrl: string, title: string) => void;
  onUseForCleanup?: (imageUrl: string, title: string) => void;
  isAuthenticated?: boolean;
  onRequireLogin?: () => void;
}

export function MaterialImportPanel({
  onUseAsProduct,
  onUseAsReference,
  onUseAsModelReference,
  onUseAsGarmentReference,
  onUseForCleanup,
  isAuthenticated = true,
  onRequireLogin,
}: MaterialImportPanelProps) {
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [savedMaterials, setSavedMaterials] = useState<SavedMaterial[]>([]);
  const [message, setMessage] = useState("支持粘贴整段小红书分享文案、公开笔记链接和直接图片链接。");
  const [notice, setNotice] = useState<MaterialNotice | null>(null);

  const showNotice = (nextNotice: MaterialNotice) => {
    setMessage(nextNotice.message);
    setNotice(nextNotice);
  };

  const refreshLibrary = async () => {
    if (!isAuthenticated) {
      setSavedMaterials([]);
      return;
    }
    try {
      setSavedMaterials(await listSavedMaterials());
    } catch (error) {
      showNotice({
        title: "素材库读取失败",
        message: error instanceof Error ? error.message : "暂时无法读取已保存素材。",
      });
    }
  };

  useEffect(() => {
    void refreshLibrary();
  }, [isAuthenticated]);

  const handleImport = async () => {
    if (!url.trim()) {
      showNotice({ title: "还没有链接", message: "请先粘贴小红书分享文案或公开图片链接。" });
      return;
    }
    if (!authorized) {
      showNotice({ title: "请确认素材授权", message: "勾选授权确认后，才能提取、保存或编辑链接中的图片。" });
      return;
    }
    if (!isAuthenticated) {
      showNotice({
        title: "请先登录",
        message: "登录后才能提取并保存小红书图片，避免刷新后素材丢失。",
        primaryLabel: "去登录",
        onPrimary: onRequireLogin,
      });
      return;
    }

    setIsLoading(true);
    setMessage("正在读取小红书公开笔记中的图片…");
    try {
      const result = await importPublicMaterial(url.trim(), authorized);
      setTitle(result.title);
      setImages(result.images);
      setSelectedImages(new Set());
      setMessage(
        result.images.length > 0
          ? `${result.sourcePlatform === "xiaohongshu" ? "小红书笔记" : "公开页面"}已提取 ${result.images.length} 张图片，请勾选需要保存的照片。`
          : "没有找到可用图片，请改用手动上传。",
      );
    } catch (error) {
      setImages([]);
      setSelectedImages(new Set());
      const errorMessage = error instanceof Error ? error.message : "素材链接导入失败。";
      showNotice({
        title: errorMessage.includes("登录") ? "登录状态已失效" : "图片提取失败",
        message: errorMessage,
        ...(errorMessage.includes("登录")
          ? { primaryLabel: "去登录", onPrimary: onRequireLogin }
          : {}),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectedImage = (imageUrl: string) => {
    setSelectedImages((current) => {
      const next = new Set(current);
      if (next.has(imageUrl)) next.delete(imageUrl);
      else next.add(imageUrl);
      return next;
    });
  };

  const handleSaveSelected = async () => {
    if (selectedImages.size === 0) {
      showNotice({ title: "还没有选择照片", message: "请勾选需要保存到素材库的照片。" });
      return;
    }
    if (!isAuthenticated) {
      showNotice({
        title: "请先登录",
        message: "登录后才能把照片保存到个人素材库。",
        primaryLabel: "去登录",
        onPrimary: onRequireLogin,
      });
      return;
    }

    setIsSaving(true);
    setMessage(`正在保存 ${selectedImages.size} 张照片…`);
    try {
      const selected = images.filter((imageUrl) => selectedImages.has(imageUrl));
      const saved = await Promise.all(
        selected.map((imageUrl, index) =>
          saveImportedMaterial(
            imageUrl,
            authorized,
            `${title.replace(/\s+-\s+小红书$/u, "") || "小红书素材"}-${index + 1}`,
          ),
        ),
      );
      setSavedMaterials((current) => [
        ...saved,
        ...current.filter((material) => !saved.some((item) => item.id === material.id)),
      ]);
      await refreshLibrary();
      setSelectedImages(new Set());
      setMessage(`已保存 ${selected.length} 张照片，可在“我的素材库”中选择使用。`);
    } catch (error) {
      showNotice({
        title: "照片保存失败",
        message: error instanceof Error ? error.message : "暂时无法保存所选照片。",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLibraryAction = async (
    material: SavedMaterial,
    role: "product" | "model" | "garment" | "cleanup" | "download",
  ) => {
    if (!isAuthenticated) {
      showNotice({
        title: "请先登录",
        message: "登录后才能使用个人素材库。",
        primaryLabel: "去登录",
        onPrimary: onRequireLogin,
      });
      return;
    }
    setActiveAction(`${role}:${material.id}`);
    try {
      if (role === "product") onUseAsProduct(material.imageUrl, material.fileName);
      if (role === "model") {
        (onUseAsModelReference ?? onUseAsReference)(material.imageUrl, material.fileName);
      }
      if (role === "garment") {
        (onUseAsGarmentReference ?? onUseAsReference)(material.imageUrl, material.fileName);
      }
      if (role === "cleanup") onUseForCleanup?.(material.imageUrl, material.fileName);
      if (role === "download") {
        await downloadStoredMaterial(material.imageUrl, material.fileName);
        setMessage("已开始下载所选原图。");
      }
    } catch (error) {
      showNotice({
        title: role === "download" ? "图片下载失败" : "素材使用失败",
        message: error instanceof Error ? error.message : "素材处理失败。",
      });
    } finally {
      setActiveAction("");
    }
  };

  return (
    <section className="panel material-import-panel" aria-labelledby="material-import-title">
      <div className="panel-heading">
        <p className="eyebrow">XIAOHONGSHU MATERIAL</p>
        <h2 id="material-import-title">小红书图片提取</h2>
        <p>提取后先勾选需要的照片并保存，再从个人素材库用于商品、模特或服装参考。</p>
      </div>

      <div className="material-import-form">
        <label className="field">
          <span>小红书分享文案或公开链接</span>
          <div className="material-import-url-row">
            <Link2 aria-hidden="true" />
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="粘贴整段分享文案，或 https://…"
              inputMode="url"
              aria-label="公开素材链接"
            />
          </div>
        </label>
        <label className="material-import-confirm">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(event) => setAuthorized(event.target.checked)}
          />
          <span>我确认拥有或已获授权下载、编辑和使用这些素材</span>
        </label>
        <button type="button" className="primary-button" onClick={handleImport} disabled={isLoading}>
          {isLoading ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
          <span>{isLoading ? "正在提取" : "提取笔记图片"}</span>
        </button>
        <p className="material-import-message" role="status">{message}</p>
      </div>

      {images.length > 0 ? (
        <section className="material-pick-section" aria-label="选择需要保存的照片">
          <div className="material-section-heading">
            <div>
              <strong>选择要保存的照片</strong>
              <span>已选 {selectedImages.size} / {images.length}</span>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={isSaving}
              onClick={() => void handleSaveSelected()}
            >
              {isSaving ? "保存中…" : `保存选中照片（${selectedImages.size}）`}
            </button>
          </div>
          <div className="material-import-grid">
            {images.map((imageUrl, index) => {
              const selected = selectedImages.has(imageUrl);
              return (
                <label className={`material-pick-card${selected ? " is-selected" : ""}`} key={imageUrl}>
                  <img src={imageUrl} alt={`提取素材 ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" />
                  <span className="material-pick-check">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelectedImage(imageUrl)}
                      aria-label={`选择提取素材 ${index + 1}`}
                    />
                    保存第 {index + 1} 张
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="saved-material-library" aria-labelledby="saved-material-title">
        <div className="material-section-heading">
          <div>
            <strong id="saved-material-title">我的素材库</strong>
            <span>{isAuthenticated ? `已保存 ${savedMaterials.length} 张` : "登录后查看历史素材"}</span>
          </div>
          {isAuthenticated ? (
            <button type="button" className="secondary-button" onClick={() => void refreshLibrary()}>
              刷新
            </button>
          ) : null}
        </div>
        {savedMaterials.length > 0 ? (
          <div className="saved-material-grid">
            {savedMaterials.map((material) => (
              <article key={material.id}>
                <img src={material.imageUrl} alt={material.fileName} loading="lazy" referrerPolicy="no-referrer" />
                <strong title={material.fileName}>{material.fileName}</strong>
                <div className="saved-material-actions">
                  <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleLibraryAction(material, "product")}><ImagePlus aria-hidden="true" />商品图</button>
                  <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleLibraryAction(material, "model")}><UserRound aria-hidden="true" />模特/姿势</button>
                  <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleLibraryAction(material, "garment")}><Shirt aria-hidden="true" />服装参考</button>
                  {onUseForCleanup ? <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleLibraryAction(material, "cleanup")}>去水印</button> : null}
                  <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleLibraryAction(material, "download")}><Download aria-hidden="true" />下载</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="saved-material-empty">
            {isAuthenticated ? "还没有保存素材。先从上方提取并勾选需要的照片。" : "登录后可以保存并重复使用以前的照片。"}
          </p>
        )}
      </section>

      <NoticeDialog
        open={Boolean(notice)}
        title={notice?.title ?? "提示"}
        message={notice?.message ?? ""}
        primaryLabel={notice?.primaryLabel}
        onPrimary={notice?.onPrimary}
        onClose={() => setNotice(null)}
      />
    </section>
  );
}

async function downloadStoredMaterial(imageUrl: string, title: string): Promise<void> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`图片下载失败（HTTP ${response.status}）`);
  const blob = await response.blob();
  const extension = blob.type.includes("webp")
    ? "webp"
    : blob.type.includes("png")
      ? "png"
      : "jpg";
  const fileStem = title
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim()
    .slice(0, 60) || "kroma-material";
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${fileStem}.${extension}`;
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
