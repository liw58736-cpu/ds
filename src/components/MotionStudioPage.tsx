import { useEffect, useMemo, useState } from "react";
import { Download, Film, ImagePlus, Play } from "lucide-react";
import { NoticeDialog } from "./NoticeDialog";
import { consumeCredits, getCurrentAccountSnapshot } from "../api/accountApi";
import type { ProductInput } from "../domain/types";

type MotionStyle = "zoom_in" | "zoom_out" | "pan_left" | "float";
type MotionRatio = "9:16" | "4:5" | "1:1";
type MotionClarity = "720p" | "1080p" | "2k";

const motionStyles: Array<{ value: MotionStyle; label: string; description: string }> = [
  { value: "zoom_in", label: "缓慢推进", description: "适合商品特写和氛围图" },
  { value: "zoom_out", label: "缓慢拉远", description: "逐步展示完整画面" },
  { value: "pan_left", label: "横向运镜", description: "适合宽场景和陈列图" },
  { value: "float", label: "轻微漂移", description: "适合社媒内容和封面" },
];

const clarityScale: Record<MotionClarity, number> = {
  "720p": 720,
  "1080p": 1080,
  "2k": 1440,
};

const clarityCredits: Record<MotionClarity, number> = {
  "720p": 1,
  "1080p": 2,
  "2k": 4,
};

function motionSize(ratio: MotionRatio, clarity: MotionClarity) {
  const width = clarityScale[clarity];
  if (ratio === "9:16") return { width, height: Math.round(width * 16 / 9) };
  if (ratio === "4:5") return { width, height: Math.round(width * 5 / 4) };
  return { width, height: width };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("图片读取失败"));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = src;
  });
}

function drawMotionFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  progress: number,
  style: MotionStyle,
) {
  const baseScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const motionScale = style === "zoom_out" ? 1.12 - progress * 0.12 : 1 + progress * 0.12;
  const scale = baseScale * motionScale;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  let x = (width - drawWidth) / 2;
  let y = (height - drawHeight) / 2;

  if (style === "pan_left") x += (progress - 0.5) * Math.min(drawWidth - width, width * 0.18);
  if (style === "float") {
    x += Math.sin(progress * Math.PI * 2) * width * 0.018;
    y += Math.cos(progress * Math.PI * 2) * height * 0.012;
  }

  context.fillStyle = "#111322";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, x, y, drawWidth, drawHeight);
}

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
  const [imageUrl, setImageUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [style, setStyle] = useState<MotionStyle>("zoom_in");
  const [ratio, setRatio] = useState<MotionRatio>("9:16");
  const [duration, setDuration] = useState(5);
  const [clarity, setClarity] = useState<MotionClarity>("720p");
  const [status, setStatus] = useState("上传静图或从生成结果进入，选择清晰度后生成 Live 图。失败不扣积分。");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");
  const activeStyle = useMemo(() => motionStyles.find((item) => item.value === style)!, [style]);
  const creditCost = clarityCredits[clarity];

  useEffect(() => {
    if (!initialProduct) return;
    setImageUrl(initialProduct.imageUrl);
    setFileName(initialProduct.fileName);
    setStatus("已载入生成结果，请选择清晰度和动效后生成 Live 图。");
    onInitialProductConsumed?.();
  }, [initialProduct, onInitialProductConsumed]);

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setImageUrl(await readFileAsDataUrl(file));
    setFileName(file.name);
    setStatus("已选择静图。可先预览运镜，再生成 WebM 视频。");
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl("");
    }
  };

  const renderVideo = async () => {
    if (!isAuthenticated) {
      setErrorNotice("登录后才能生成 Live 图并记录积分消耗。");
      return;
    }
    if (getCurrentAccountSnapshot().balance < creditCost) {
      setErrorNotice(`当前积分不足，${clarity} Live 图需要 ${creditCost} 积分。`);
      return;
    }
    if (!imageUrl || typeof MediaRecorder === "undefined") {
      const errorMessage = imageUrl ? "当前浏览器不支持本地视频生成，请使用最新版 Chrome。" : "请先上传静图。";
      setStatus(errorMessage);
      setErrorNotice(errorMessage);
      return;
    }

    setIsRendering(true);
    setStatus("正在本地生成轻动态视频，请保持页面打开…");
    try {
      const image = await loadImage(imageUrl);
      const canvas = document.createElement("canvas");
      const size = motionSize(ratio, clarity);
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("无法创建视频画布");
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const videoBitsPerSecond = clarity === "2k" ? 12_000_000 : clarity === "1080p" ? 8_000_000 : 5_000_000;
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onerror = () => reject(new Error("视频编码失败"));
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      });
      recorder.start(250);
      const startedAt = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          const progress = Math.min(1, (now - startedAt) / (duration * 1000));
          drawMotionFrame(context, image, size.width, size.height, progress, style);
          if (progress < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      const blob = await finished;
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const nextUrl = URL.createObjectURL(blob);
      setDownloadUrl(nextUrl);
      try {
        await consumeCredits({ amount: creditCost, label: `${clarity} Live 图` });
        setStatus(`已生成 ${duration} 秒 ${ratio} ${clarity} Live 图，已扣除 ${creditCost} 积分。`);
      } catch {
        setStatus("Live 图已生成，但积分同步暂时失败；结果仍可下载。");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "视频生成失败，请重试。";
      setStatus(errorMessage);
      setErrorNotice(errorMessage);
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <main className="motion-page page-surface">
      <section className="page-heading motion-page-heading">
        <p className="eyebrow">STILL TO MOTION</p>
        <h1>Live 图生成</h1>
        <p>把静态图片转为适合商品展示和社媒发布的轻动态 WebM；当前为本地运镜效果，不冒充人物动作型 AI 视频。</p>
      </section>
      <div className="motion-workbench">
        <section className="panel motion-settings" aria-label="动态设置">
          <label className="motion-upload">
            <ImagePlus aria-hidden="true" />
            <span>上传静态图片</span>
            <small>支持 JPG、PNG、WebP</small>
            <input type="file" accept="image/*" aria-label="上传动态源图" onChange={(event) => void handleFile(event.target.files?.[0])} />
          </label>
          {fileName ? <p className="motion-file-name">当前图片：{fileName}</p> : null}
          <div className="motion-style-grid" aria-label="运镜方式">
            {motionStyles.map((item) => (
              <button type="button" key={item.value} className={style === item.value ? "is-active" : undefined} aria-pressed={style === item.value} onClick={() => setStyle(item.value)}>
                <strong>{item.label}</strong><span>{item.description}</span>
              </button>
            ))}
          </div>
          <div className="compact-fields">
            <label className="field"><span>比例</span><select value={ratio} onChange={(event) => setRatio(event.target.value as MotionRatio)}><option>9:16</option><option>4:5</option><option>1:1</option></select></label>
            <label className="field"><span>时长</span><select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={3}>3 秒</option><option value={5}>5 秒</option><option value={8}>8 秒</option></select></label>
            <label className="field"><span>清晰度</span><select value={clarity} onChange={(event) => setClarity(event.target.value as MotionClarity)}><option value="720p">720P · 1 积分</option><option value="1080p">1080P · 2 积分</option><option value="2k">2K · 4 积分</option></select></label>
          </div>
          <button type="button" className="primary-button motion-render-button" disabled={!imageUrl || isRendering} onClick={renderVideo}><Film aria-hidden="true" /><span>{isRendering ? "正在生成" : `生成 Live 图（${creditCost} 积分）`}</span></button>
          <p className="motion-credit-hint">720P 1 积分 · 1080P 2 积分 · 2K 4 积分；成功后扣点，失败不扣点。</p>
          {downloadUrl ? <a className="secondary-button motion-download-button" href={downloadUrl} download={`${fileName.replace(/\.[^.]+$/, "") || "kroma-motion"}.webm`}><Download aria-hidden="true" />下载 WebM</a> : null}
          <p className="motion-status" role="status">{status}</p>
        </section>
        <section className="panel motion-preview-panel" aria-label="动态预览">
          <div className={`motion-preview-frame is-${style}`} data-ratio={ratio}>
            {imageUrl ? <img src={imageUrl} alt="动态源图预览" /> : <div><Play aria-hidden="true" /><strong>等待静图</strong><span>上传后这里会循环预览 {activeStyle.label}</span></div>}
          </div>
        </section>
      </div>
      <NoticeDialog
        open={Boolean(errorNotice)}
        title="Live 图生成失败"
        message={errorNotice}
        primaryLabel={errorNotice.includes("登录") ? "去登录" : errorNotice.includes("积分") ? "查看价格" : undefined}
        onPrimary={errorNotice.includes("登录") ? onRequireLogin : errorNotice.includes("积分") ? onOpenPricing : undefined}
        onClose={() => setErrorNotice("")}
      />
    </main>
  );
}
