import { useEffect, useRef, useState } from "react";
import { Brush, Download, Eraser, RotateCcw, Sparkles } from "lucide-react";
import { consumeCredits, getCurrentAccountSnapshot } from "../api/accountApi";
import { runImageCleanup, type CleanupMode } from "../api/cleanupApi";
import { saveGenerationTaskHistory, saveGenerationTasks, getGenerationTaskSnapshot } from "../api/generationApi";
import { completeTask, createTask, failTask, markProcessing } from "../domain/taskState";
import type { GenerationConfig, ProductInput } from "../domain/types";
import type { MaterialLibraryAsset } from "../api/materialLibraryApi";
import { NoticeDialog } from "./NoticeDialog";
import { MaterialPickerDialog } from "./MaterialPickerDialog";

interface CleanupNotice {
  title: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
}

interface ImageCleanupPageProps {
  isAuthenticated: boolean;
  onRequireLogin: () => void;
  onOpenPricing: () => void;
  initialProduct?: ProductInput | null;
  onInitialProductConsumed?: () => void;
}

export interface MaskPath { size: number; points: Array<{ x: number; y: number }> }

export function drawTransparentCleanupMask(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  paths: MaskPath[],
): void {
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "destination-out";
  context.strokeStyle = "#000000";
  context.fillStyle = "#000000";
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const path of paths) {
    if (path.points.length === 0) continue;
    context.lineWidth = path.size;
    if (path.points.length === 1) {
      context.beginPath();
      context.arc(path.points[0].x, path.points[0].y, path.size / 2, 0, Math.PI * 2);
      context.fill();
      continue;
    }
    context.beginPath();
    context.moveTo(path.points[0].x, path.points[0].y);
    for (const point of path.points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
  }

  context.globalCompositeOperation = "source-over";
}

function cleanupConfig(mode: CleanupMode): GenerationConfig {
  return {
    module: "white_background",
    platform: "independent_store",
    aspectRatio: "original",
    style: "minimal",
    outputFormat: "png",
    sellingPoints: "仅清理用户画笔标记区域，未标记区域保持不变。",
    specifications: "",
    outputLanguage: "中文",
    resolution: "1K",
    generationVersion: "standard",
    whiteBackgroundMode: mode,
    shadowMode: "none",
  };
}

async function downloadCleanupResult(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = "kroma-cleanup.png";
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function ImageCleanupPage({ isAuthenticated, onRequireLogin, onOpenPricing, initialProduct, onInitialProductConsumed }: ImageCleanupPageProps) {
  const [product, setProduct] = useState<ProductInput | null>(null);
  const [mode, setMode] = useState<CleanupMode>("watermark_remove");
  const [brushSize, setBrushSize] = useState(36);
  const [status, setStatus] = useState("从图片库选择图片后，用画笔涂抹需要清理的区域。");
  const [resultUrl, setResultUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState<CleanupNotice | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pathsRef = useRef<MaskPath[]>([]);
  const drawingRef = useRef<MaskPath | null>(null);

  useEffect(() => {
    if (!initialProduct) return;
    setProduct(initialProduct);
    setResultUrl("");
    pathsRef.current = [];
    setStatus("已载入提取图片，请用画笔涂抹需要去除的水印或文字区域。");
    onInitialProductConsumed?.();
  }, [initialProduct, onInitialProductConsumed]);

  const redrawMask = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(255, 58, 92, 0.62)";
    context.fillStyle = "rgba(255, 58, 92, 0.62)";
    for (const path of pathsRef.current) {
      if (path.points.length === 0) continue;
      context.lineWidth = path.size;
      if (path.points.length === 1) {
        context.beginPath();
        context.arc(path.points[0].x, path.points[0].y, path.size / 2, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.beginPath();
      context.moveTo(path.points[0].x, path.points[0].y);
      for (const point of path.points.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }
  };

  const pointerPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const exportMask = (): string => {
    const source = canvasRef.current;
    if (!source || pathsRef.current.length === 0) return "";
    const mask = document.createElement("canvas");
    mask.width = source.width;
    mask.height = source.height;
    const context = mask.getContext("2d");
    if (!context) return "";
    drawTransparentCleanupMask(context, mask.width, mask.height, pathsRef.current);
    return mask.toDataURL("image/png");
  };

  const handleLibraryPick = (asset: MaterialLibraryAsset) => {
    setProduct({ id: `cleanup-${asset.id}`, imageUrl: asset.imageUrl, fileName: asset.fileName, createdAt: new Date().toISOString(), source: "upload" });
    pathsRef.current = [];
    setResultUrl("");
    setStatus("图片已载入，请涂抹需要清理的区域。");
  };

  const handleGenerate = async () => {
    if (!isAuthenticated) {
      setNotice({
        title: "请先登录",
        message: "登录后才能使用图片清理，任务结果和积分记录会保存到账户中。",
        primaryLabel: "去登录",
        onPrimary: onRequireLogin,
      });
      return;
    }
    if (getCurrentAccountSnapshot().balance < 1) {
      setNotice({
        title: "积分不足",
        message: "图片清理需要 1 积分，失败任务不会扣除积分。",
        primaryLabel: "查看价格",
        onPrimary: onOpenPricing,
      });
      return;
    }
    if (!product) {
      setNotice({ title: "请先选择图片", message: "从图片库选择需要处理的图片后，再涂抹清理区域。" });
      return;
    }
    const maskBase64 = exportMask();
    if (!maskBase64) {
      setNotice({ title: "还没有涂抹区域", message: "请先用红色画笔覆盖需要去除的水印、文字或物体。" });
      return;
    }

    const processingTask = markProcessing(createTask({ product, config: cleanupConfig(mode), now: new Date().toISOString() }));
    let currentProcessingTask = processingTask;
    void saveGenerationTasks([
      processingTask,
      ...getGenerationTaskSnapshot().filter((task) => task.id !== processingTask.id),
    ]);
    setIsGenerating(true);
    setStatus("正在清理标记区域…");
    try {
      const canvas = canvasRef.current;
      const result = await runImageCleanup({
        imageBase64: product.imageUrl,
        maskBase64,
        mode,
        size: canvas?.width && canvas?.height
          ? `${canvas.width}x${canvas.height}`
          : undefined,
        onProgress: setStatus,
        onTaskStarted: (backendTaskId) => {
          currentProcessingTask = { ...currentProcessingTask, backendTaskId };
          void saveGenerationTasks([
            currentProcessingTask,
            ...getGenerationTaskSnapshot().filter((task) => task.id !== currentProcessingTask.id),
          ]);
        },
      });
      const completed = completeTask(currentProcessingTask, {
        resultUrls: [result.imageUrl],
        resultAssets: [{ url: result.imageUrl, label: mode === "watermark_remove" ? "去除水印或文字" : "移除物体", ...(result.channelUsed ? { channelUsed: result.channelUsed } : {}) }],
        ...(result.channelUsed ? { channelUsed: result.channelUsed, channelUsedByAsset: [result.channelUsed] } : {}),
        creditCost: 1,
        completedAt: new Date().toISOString(),
      });
      setResultUrl(result.imageUrl);
      await saveGenerationTaskHistory(completed);
      await saveGenerationTasks([completed, ...getGenerationTaskSnapshot().filter((task) => task.id !== completed.id)]);
      try {
        await consumeCredits({ amount: 1, label: "图片清理" });
        setStatus("清理完成，已扣除 1 积分并保存到历史任务。");
      } catch {
        setStatus("清理完成并已保存结果，但积分同步暂时失败；结果不会被标记为失败。");
      }
    } catch (error) {
      const failed = failTask(currentProcessingTask, { errorCode: "image_cleanup_failed", errorMessage: error instanceof Error ? error.message : "图片清理失败", completedAt: new Date().toISOString() });
      await saveGenerationTaskHistory(failed);
      await saveGenerationTasks([failed, ...getGenerationTaskSnapshot().filter((task) => task.id !== failed.id)]);
      setStatus(failed.errorMessage ?? "图片清理失败，未扣除积分。");
      setNotice({
        title: "图片清理失败",
        message: failed.errorMessage ?? "本次任务未扣除积分，请稍后重试。",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="cleanup-page page-surface">
      <section className="page-heading"><p className="eyebrow">MASKED IMAGE CLEANUP</p><h1>图片清理</h1><p>涂抹水印、文字、标记或不需要的物体，只修改画笔覆盖区域。仅处理你拥有或获授权的图片。</p></section>
      <div className="cleanup-workbench">
        <section className="panel cleanup-settings" aria-label="图片清理设置">
          <button type="button" className="cleanup-upload" aria-label="从图片库选择待清理图片" onClick={() => setPickerOpen(true)}><Brush aria-hidden="true" /><span>从图片库选择待清理图片</span><small>本地图片请先到图片库批量上传</small></button>
          <div className="segmented-control" aria-label="清理类型">
            <button type="button" className={mode === "watermark_remove" ? "is-active" : undefined} aria-pressed={mode === "watermark_remove"} onClick={() => setMode("watermark_remove")}>去除水印或文字</button>
            <button type="button" className={mode === "remove_object" ? "is-active" : undefined} aria-pressed={mode === "remove_object"} onClick={() => setMode("remove_object")}>移除物体</button>
          </div>
          <label className="cleanup-brush-size"><span>画笔大小</span><input type="range" min={12} max={120} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>
          <div className="cleanup-actions"><button type="button" className="secondary-button" onClick={() => { pathsRef.current.pop(); redrawMask(); }}><RotateCcw aria-hidden="true" />撤销</button><button type="button" className="secondary-button" onClick={() => { pathsRef.current = []; redrawMask(); }}><Eraser aria-hidden="true" />清空蒙版</button></div>
          <button type="button" className="primary-button cleanup-generate" disabled={!product || isGenerating} onClick={handleGenerate}><Sparkles aria-hidden="true" />{isGenerating ? "正在清理" : "开始清理（1 积分）"}</button>
          <p className="cleanup-status" role="status">{status}</p>
        </section>
        <section className="panel cleanup-canvas-panel" aria-label="涂抹区域">
          {product ? <div className="cleanup-canvas-wrap"><img src={product.imageUrl} alt="待清理图片" referrerPolicy="no-referrer" onLoad={(event) => { const canvas = canvasRef.current; if (!canvas) return; canvas.width = event.currentTarget.naturalWidth; canvas.height = event.currentTarget.naturalHeight; redrawMask(); }} onError={() => { const errorMessage = "图片加载失败，请返回图片库重新选择。"; setStatus(errorMessage); setNotice({ title: "图片加载失败", message: errorMessage }); }} /><canvas ref={canvasRef} aria-label="清理蒙版画布" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const path = { size: brushSize * (event.currentTarget.width / event.currentTarget.getBoundingClientRect().width), points: [pointerPoint(event)] }; drawingRef.current = path; pathsRef.current.push(path); redrawMask(); }} onPointerMove={(event) => { if (!drawingRef.current) return; drawingRef.current.points.push(pointerPoint(event)); redrawMask(); }} onPointerUp={() => { drawingRef.current = null; }} onPointerCancel={() => { drawingRef.current = null; }} /></div> : <div className="cleanup-empty"><Brush aria-hidden="true" /><strong>等待图片</strong><span>从图片库选择后，用红色画笔涂抹清理区域</span></div>}
          {resultUrl ? <div className="cleanup-result"><img src={resultUrl} alt="图片清理结果" /><button type="button" className="primary-button" onClick={() => void downloadCleanupResult(resultUrl).catch((error) => { const errorMessage = error instanceof Error ? error.message : "下载失败"; setStatus(errorMessage); setNotice({ title: "结果下载失败", message: errorMessage }); })}><Download aria-hidden="true" />下载结果</button></div> : null}
        </section>
      </div>
      <NoticeDialog
        open={Boolean(notice)}
        title={notice?.title ?? "提示"}
        message={notice?.message ?? ""}
        primaryLabel={notice?.primaryLabel}
        onPrimary={notice?.onPrimary}
        onClose={() => setNotice(null)}
      />
      <MaterialPickerDialog
        open={pickerOpen}
        title="从图片库选择待清理图片"
        onPick={handleLibraryPick}
        onClose={() => setPickerOpen(false)}
      />
    </main>
  );
}
