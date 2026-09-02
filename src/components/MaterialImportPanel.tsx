import { useState } from "react";
import { Link2, LoaderCircle } from "lucide-react";
import {
  importPublicMaterial,
  storeImportedMaterial,
} from "../api/materialImportApi";

interface MaterialImportPanelProps {
  onUseAsProduct: (imageUrl: string, title: string) => void;
  onUseAsReference: (imageUrl: string, title: string) => void;
}

export function MaterialImportPanel({
  onUseAsProduct,
  onUseAsReference,
}: MaterialImportPanelProps) {
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectingImage, setSelectingImage] = useState("");
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [message, setMessage] = useState("支持公开分享页和直接图片链接；平台要求登录时请改用手动上传。");

  const handleImport = async () => {
    if (!url.trim()) {
      setMessage("请先粘贴公开素材链接。");
      return;
    }
    if (!authorized) {
      setMessage("请确认你拥有或已获授权使用该素材。");
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
          ? `已找到 ${result.images.length} 张公开图片。请选择作为商品图或灵感图。`
          : "没有找到可用图片，请改用手动上传。",
      );
    } catch (error) {
      setImages([]);
      setMessage(error instanceof Error ? error.message : "素材链接导入失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseImage = async (
    imageUrl: string,
    index: number,
    role: "product" | "reference",
  ) => {
    setSelectingImage(`${role}:${imageUrl}`);
    setMessage("正在把所选图片保存到 kroma 素材库…");
    try {
      const storedUrl = await storeImportedMaterial(imageUrl, authorized);
      const imageTitle = title || `提取素材 ${index + 1}`;
      if (role === "product") onUseAsProduct(storedUrl, imageTitle);
      else onUseAsReference(storedUrl, imageTitle);
      setMessage(
        role === "product"
          ? "已保存并设为商品图，后续任务不会依赖原平台链接。"
          : "已保存并设为灵感图，后续任务不会依赖原平台链接。",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "素材保存失败。");
    } finally {
      setSelectingImage("");
    }
  };

  return (
    <section className="panel material-import-panel" aria-labelledby="material-import-title">
      <div className="panel-heading">
        <p className="eyebrow">PUBLIC MATERIAL IMPORT</p>
        <h2 id="material-import-title">从链接提取素材</h2>
        <p>粘贴你有权使用的公开分享链接，提取图片后再决定它是商品图还是灵感参考。</p>
      </div>
      <div className="material-import-form">
        <label className="field">
          <span>公开素材链接</span>
          <div className="material-import-url-row">
            <Link2 aria-hidden="true" />
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
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
          <span>我确认拥有或已获授权使用该链接中的素材</span>
        </label>
        <button
          type="button"
          className="primary-button"
          onClick={handleImport}
          disabled={isLoading}
        >
          {isLoading ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
          <span>{isLoading ? "正在提取" : "提取图片"}</span>
        </button>
        <p className="material-import-message" role="status">{message}</p>
      </div>
      {images.length > 0 ? (
        <div className="material-import-grid" aria-label="提取到的图片">
          {images.map((imageUrl, index) => (
            <article key={imageUrl}>
              <img src={imageUrl} alt={`提取素材 ${index + 1}`} loading="lazy" />
              <div>
                <button type="button" disabled={Boolean(selectingImage)} onClick={() => void handleUseImage(imageUrl, index, "product")}>
                  {selectingImage === `product:${imageUrl}` ? "保存中" : "设为商品图"}
                </button>
                <button type="button" disabled={Boolean(selectingImage)} onClick={() => void handleUseImage(imageUrl, index, "reference")}>
                  {selectingImage === `reference:${imageUrl}` ? "保存中" : "设为灵感图"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
