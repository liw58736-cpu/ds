import { getStorageOwner } from "../storage/workspaceDraftStore";
import { useEffect, useState } from "react";
import { Download, Film, ImagePlus, Play, Trash2 } from "lucide-react";
import { NoticeDialog } from "./NoticeDialog";
import {
  consumeCredits,
  getCurrentAccountSnapshot,
} from "../api/accountApi";
import {
  downloadLiveVideo,
  generateLiveVideo,
  getLiveVideoCreditCost,
  type LiveVideoClarity,
} from "../api/liveVideoApi";
import type { ProductInput } from "../domain/types";
import type { MaterialLibraryAsset } from "../api/materialLibraryApi";
import { MaterialPickerDialog } from "./MaterialPickerDialog";

const defaultMotionPrompt =
  "人物自然呼吸并轻微转移重心，头发和衣料随动作自然微动；保持原姿势、表情、商品和背景一致。";

interface MotionStudioPageProps {
  initialProduct?: ProductInput | null;
  onInitialProductConsumed?: () => void;
  isAuthenticated?: boolean;
  onRequireLogin?: () => void;
  onOpenPricing?: () => void;
}

export function MotionStudioPage({
  initialProduct,
  onInitialProductConsumed,
  isAuthenticated = true,
  onRequireLogin,
  onOpenPricing,
}: MotionStudioPageProps = {}) {
  const [draftKey] = useState(() => `kroma-motion-draft:${getStorageOwner()}`);
  const [savedDraft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey) || "{}");
    } catch {
      return {};
    }
  });
  const [imageUrl, setImageUrl] = useState<string>(savedDraft.imageUrl || "");
  const [fileName, setFileName] = useState<string>(savedDraft.fileName || "");
  const [motionPrompt, setMotionPrompt] = useState<string>(
    savedDraft.motionPrompt || defaultMotionPrompt,
  );
  const [clarity, setClarity] = useState<LiveVideoClarity>("720p");
  const [status, setStatus] = useState(
    "从图片库选择照片并描述人物动作，即可生成真实 AI Live 视频。失败不扣积分。",
  );
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTaskId, setVideoTaskId] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const creditCost = getLiveVideoCreditCost(clarity);
  const clarityLabel = clarity === "1080p" ? "1080P" : "768P";
  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ imageUrl, fileName, motionPrompt }),
      );
    } catch {}
  }, [draftKey, imageUrl, fileName, motionPrompt]);

  useEffect(() => {
    if (!initialProduct) return;
    setImageUrl(initialProduct.imageUrl);
    setFileName(initialProduct.fileName);
    setVideoUrl("");
    setVideoTaskId("");
    setStatus("已载入生成结果，可以填写动态提示词并生成 Live 图。");
    onInitialProductConsumed?.();
  }, [initialProduct, onInitialProductConsumed]);

  const handleLibraryPick = (asset: MaterialLibraryAsset) => {
    setImageUrl(asset.imageUrl);
    setFileName(asset.fileName);
    setVideoUrl("");
    setVideoTaskId("");
    setStatus("已从图片库选择首帧照片，可以开始生成真实 AI Live 视频。");
  };

  const removeImage = () => {
    setImageUrl("");
    setFileName("");
    setVideoUrl("");
    setVideoTaskId("");
    setStatus("请先从图片库选择一张首帧照片。");
  };

  const renderVideo = async () => {
    if (!isAuthenticated) {
      setErrorNotice("登录后才能生成 Live 图并记录积分消耗。");
      return;
    }
    if (!imageUrl) {
      setErrorNotice("请先从图片库选择一张首帧照片。");
      return;
    }
    if (!/^https:\/\//i.test(imageUrl)) {
      setErrorNotice("当前照片不是可访问的图片库地址，请重新从图片库选择。");
      return;
    }
    if (getCurrentAccountSnapshot().balance < creditCost) {
      setErrorNotice(
        `当前积分不足，${clarityLabel} Live 图需要 ${creditCost} 积分。`,
      );
      return;
    }

    setIsRendering(true);
    setVideoUrl("");
    setVideoTaskId("");
    setStatus("正在裁切 105% 固定首帧并生成 Live 视频…");
    try {
      const result = await generateLiveVideo(
        { firstFrameUrl: imageUrl, prompt: motionPrompt, size: clarity },
        { onProgress: setStatus },
      );
      setVideoUrl(result.videoUrl);
      setVideoTaskId(result.taskId);
      try {
        await consumeCredits({
          amount: creditCost,
          label: "生成 Live 图",
          referenceId: result.taskId,
        });
        setStatus(
          `Live 图生成完成：原图比例 · ${clarityLabel}，已消耗 ${creditCost} 积分。`,
        );
      } catch {
        setStatus("Live 图已生成，但积分同步暂时失败；视频仍可播放和下载。");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Live 图生成失败，请重试。";
      setStatus(`${message} 失败任务不会扣除积分。`);
      setErrorNotice(message);
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownload = async () => {
    if (!videoTaskId || isDownloading) return;
    setIsDownloading(true);
    try {
      const blob = await downloadLiveVideo(videoTaskId);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${fileName.replace(/\.[^.]+$/, "") || "kroma-live"}.mp4`;
      anchor.click();
      globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      setErrorNotice(
        error instanceof Error ? error.message : "Live 图下载失败，请稍后重试。",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="motion-page page-surface">
      <section className="page-heading motion-page-heading">
        <p className="eyebrow">AI LIVE VIDEO</p>
        <h1>Live 图生成</h1>
        <p>
          首帧直接采用 103%–105% 构图，不展示放大过程；随后保持该尺度，加入克制的手持漂移、轻微倾斜与自然主体微动作。
        </p>
        <p className="motion-provider-limit">
          输出保持原图比例；成片固定为 3 秒无声视频，支持 768P 或 1080P。建议选择单张清晰照片，避免拼图。
        </p>
      </section>
      <div className="motion-workbench">
        <section className="panel motion-settings" aria-label="动态设置">
          <button
            type="button"
            className="motion-upload"
            aria-label="从图片库选择动态源图"
            onClick={() => setPickerOpen(true)}
          >
            <ImagePlus aria-hidden="true" />
            <span>从图片库选择首帧照片</span>
            <small>需要使用图片库中的公网图片地址</small>
          </button>
          {fileName ? (
            <div className="motion-selected-file">
              <p className="motion-file-name">当前图片：{fileName}</p>
              <button
                type="button"
                className="motion-remove-image"
                aria-label="删除当前动态源图"
                onClick={removeImage}
              >
                <Trash2 aria-hidden="true" />
                删除
              </button>
            </div>
          ) : null}
          <label className="field motion-prompt-field">
            <span>动态提示词</span>
            <textarea
              rows={5}
              value={motionPrompt}
              aria-label="动态提示词"
              onChange={(event) => setMotionPrompt(event.target.value)}
              placeholder="例如：人物自然眨眼，轻微转动视线，头发和衣角随微风轻动。"
            />
            <small>
              系统已内置自然手持漂移、一致性保护和禁止项；这里只需补充希望人物或商品如何轻微运动。
            </small>
          </label>
          <div className="compact-fields motion-video-specs">
            <label className="field">
              <span>比例</span>
              <select value="adaptive" disabled aria-label="视频比例">
                <option value="adaptive">原图比例</option>
              </select>
            </label>
            <label className="field">
              <span>清晰度</span>
              <select
                value={clarity}
                onChange={(event) =>
                  setClarity(event.target.value as LiveVideoClarity)
                }
              >
                <option value="720p">H3 768P · 30 积分</option>
                <option value="1080p">1080P · 40 积分</option>
              </select>
            </label>
          </div>
          <p className="motion-fixed-duration">
            <span>时长</span>
            <strong>3 秒</strong>
          </p>
          <button
            type="button"
            className="primary-button motion-render-button"
            disabled={!imageUrl || isRendering}
            onClick={renderVideo}
          >
            <Film aria-hidden="true" />
            <span>
              {isRendering
                ? "正在生成 Live 图"
                : `生成 Live 图（${creditCost} 积分）`}
            </span>
          </button>
          <p className="motion-credit-hint">
            真实 AI 图生视频，仅成功后消耗积分；失败任务不扣积分。
          </p>
          {videoUrl && videoTaskId ? (
            <button
              type="button"
              className="secondary-button motion-download-button"
              disabled={isDownloading}
              onClick={handleDownload}
            >
              <Download aria-hidden="true" />
              {isDownloading ? "正在下载" : "下载 MP4"}
            </button>
          ) : null}
          <p className="motion-status" role="status">
            {status}
          </p>
        </section>
        <section className="panel motion-preview-panel" aria-label="动态预览">
          <div className="motion-preview-frame" data-ratio="adaptive">
            {videoUrl ? (
              <video src={videoUrl} controls autoPlay loop muted playsInline>
                你的浏览器不支持视频播放。
              </video>
            ) : imageUrl ? (
              <img src={imageUrl} alt="动态源图预览" />
            ) : (
              <div>
                <Play aria-hidden="true" />
                <strong>等待首帧照片</strong>
                <span>从图片库选择后，生成结果会在这里播放</span>
              </div>
            )}
          </div>
        </section>
      </div>
      <NoticeDialog
        open={Boolean(errorNotice)}
        title="Live 图生成失败"
        message={errorNotice}
        primaryLabel={
          errorNotice.includes("登录")
            ? "去登录"
            : errorNotice.includes("积分")
              ? "查看价格"
              : undefined
        }
        onPrimary={
          errorNotice.includes("登录")
            ? onRequireLogin
            : errorNotice.includes("积分")
              ? onOpenPricing
              : undefined
        }
        onClose={() => setErrorNotice("")}
      />
      <MaterialPickerDialog
        open={pickerOpen}
        title="从图片库选择动态源图"
        onPick={handleLibraryPick}
        onClose={() => setPickerOpen(false)}
      />
    </main>
  );
}
