import { useState } from "react";
import { Link2, LoaderCircle } from "lucide-react";
import {
  importPublicMaterial,
  storeImportedMaterial,
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
  onUseForCleanup?: (imageUrl: string, title: string) => void;
  isAuthenticated?: boolean;
  onRequireLogin?: () => void;
}

export function MaterialImportPanel({
  onUseAsProduct,
  onUseAsReference,
  onUseForCleanup,
  isAuthenticated = true,
  onRequireLogin,
}: MaterialImportPanelProps) {
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [message, setMessage] = useState("支持粘贴整段小红书分享文案、公开笔记链接和直接图片链接。");
  const [notice, setNotice] = useState<MaterialNotice | null>(null);

  const showNotice = (nextNotice: MaterialNotice) => {
    setMessage(nextNotice.message);
    setNotice(nextNotice);
  };

  const handleImport = async () => {
    if (!url.trim()) {
      showNotice({ title: "还没有链接", message: "请先粘贴小红书分享文案或公开图片链接。" });
      return;
    }
    if (!authorized) {
      showNotice({ title: "请确认素材授权", message: "勾选授权确认后，才能提取、下载或编辑链接中的图片。" });
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
    setMessage("正在读取公开页面中的图片…");
    try {
      const result = await importPublicMaterial(url.trim(), authorized);
      setTitle(result.title);
      setImages(result.images);
      setMessage(
        result.images.length > 0
          ? `${result.sourcePlatform === "xiaohongshu" ? "小红书笔记" : "公开页面"}已提取 ${result.images.length} 张图片，可下载、去水印或用于创作。`
          : "没有找到可用图片，请改用手动上传。",
      );
    } catch (error) {
      setImages([]);
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

  const handleUseImage = async (
    imageUrl: string,
    index: number,
    role: "product" | "reference" | "cleanup" | "download",
  ) => {
    if (!isAuthenticated) {
      showNotice({
        title: "请先登录",
        message: "登录后才能保存、下载或编辑提取到的图片。",
        primaryLabel: "去登录",
        onPrimary: onRequireLogin,
      });
      return;
    }
    setActiveAction(`${role}:${imageUrl}`);
    setMessage("正在把所选图片保存到 kroma 素材库…");
    try {
      const storedUrl = await storeImportedMaterial(imageUrl, authorized);
      const imageTitle = title || `提取素材 ${index + 1}`;
      if (role === "product") onUseAsProduct(storedUrl, imageTitle);
      if (role === "reference") onUseAsReference(storedUrl, imageTitle);
      if (role === "cleanup") onUseForCleanup?.(storedUrl, imageTitle);
      if (role === "download") await downloadStoredMaterial(storedUrl, imageTitle, index);
      setMessage(
        role === "product"
          ? "已保存并设为商品图，后续任务不会依赖原平台链接。"
          : role === "reference"
            ? "已保存并设为灵感图，后续任务不会依赖原平台链接。"
            : role === "cleanup"
              ? "图片已保存，正在打开去水印画笔。"
              : "原图已保存并开始下载。",
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "素材保存失败。";
      showNotice({
        title: role === "download" ? "图片下载失败" : "素材处理失败",
        message: errorMessage,
      });
    } finally {
      setActiveAction("");
    }
  };

  return (
    <section className="panel material-import-panel" aria-labelledby="material-import-title">
      <div className="panel-heading">
        <p className="eyebrow">PUBLIC MATERIAL IMPORT</p>
        <h2 id="material-import-title">小红书图片提取</h2>
        <p>粘贴整段分享文案或公开笔记链接，提取原图后可下载、去水印或作为创作素材。</p>
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
        <button
          type="button"
          className="primary-button"
          onClick={handleImport}
          disabled={isLoading}
        >
          {isLoading ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
          <span>{isLoading ? "正在提取" : "提取笔记图片"}</span>
        </button>
        <p className="material-import-message" role="status">{message}</p>
      </div>
      {images.length > 0 ? (
        <div className="material-import-grid" aria-label="提取到的图片">
          {images.map((imageUrl, index) => (
            <article key={imageUrl}>
              <img src={imageUrl} alt={`提取素材 ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" />
              <div>
                <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleUseImage(imageUrl, index, "download")}>
                  {activeAction === `download:${imageUrl}` ? "保存中" : "下载原图"}
                </button>
                {onUseForCleanup ? (
                  <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleUseImage(imageUrl, index, "cleanup")}>
                    {activeAction === `cleanup:${imageUrl}` ? "保存中" : "去水印/文字"}
                  </button>
                ) : null}
                <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleUseImage(imageUrl, index, "product")}>
                  {activeAction === `product:${imageUrl}` ? "保存中" : "设为商品图"}
                </button>
                <button type="button" disabled={Boolean(activeAction)} onClick={() => void handleUseImage(imageUrl, index, "reference")}>
                  {activeAction === `reference:${imageUrl}` ? "保存中" : "设为灵感图"}
                </button>
              </div>
            </article>
          ))}
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
    </section>
  );
}

async function downloadStoredMaterial(
  imageUrl: string,
  title: string,
  index: number,
): Promise<void> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`图片下载失败（HTTP ${response.status}）`);
  const blob = await response.blob();
  const extension = blob.type.includes("webp")
    ? "webp"
    : blob.type.includes("png")
      ? "png"
      : "jpg";
  const fileStem = title
    .replace(/\s+-\s+小红书$/u, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim()
    .slice(0, 60) || "kroma-material";
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${fileStem}-${index + 1}.${extension}`;
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
