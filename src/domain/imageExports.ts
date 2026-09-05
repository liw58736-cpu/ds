import { getTaskResultAssets } from "./resultAssets";
import type { GenerationTask } from "./types";

export async function exportDetailLongImage(
  task: GenerationTask,
): Promise<void> {
  const assets = getTaskResultAssets(task);
  if (!assets.length) throw new Error("没有可导出的图片");
  const images = await Promise.all(
    assets.map(
      (asset) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = "anonymous";
          image.onload = () => resolve(image);
          image.onerror = () =>
            reject(new Error("有图片暂时无法读取，请稍后再导出。"));
          image.src = asset.url;
        }),
    ),
  );
  const width = Math.min(
    1200,
    Math.min(...images.map((image) => image.naturalWidth)),
  );
  const heights = images.map((image) =>
    Math.round((width * image.naturalHeight) / image.naturalWidth),
  );
  const height = heights.reduce((a, b) => a + b, 0);
  if (height > 30000 || width * height > 32000000)
    throw new Error("长图尺寸过大，请分段导出或下载原图。");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器无法创建长图");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  let top = 0;
  images.forEach((image, index) => {
    ctx.drawImage(image, 0, top, width, heights[index]);
    top += heights[index];
  });
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("长图导出失败"))),
      "image/jpeg",
      0.93,
    ),
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kroma-detail-${task.id}.jpg`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
