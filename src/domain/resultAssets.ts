import { buildGenerationPrompt } from "./promptBuilder";
import type { GenerationResultAsset, GenerationTask } from "./types";

function sanitizeFilePart(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-");

  return normalized || "result";
}

function getFallbackLabels(task: GenerationTask): string[] {
  const moduleLabels = buildGenerationPrompt(task.config).modules.map(
    (module) => module.title,
  );

  if (moduleLabels.length === 0) {
    return ["生成结果"];
  }

  return moduleLabels;
}

export function getTaskResultAssets(
  task: GenerationTask,
): GenerationResultAsset[] {
  if (task.resultAssets && task.resultAssets.length > 0) {
    return task.resultAssets.filter((asset) => asset.url && asset.label);
  }

  const labels = getFallbackLabels(task);

  return task.resultUrls.map((url, index) => ({
    url,
    label:
      labels[index] ?? labels[labels.length - 1] ?? `生成结果 ${index + 1}`,
  }));
}

export function getTaskDownloadName(
  task: GenerationTask,
  asset: GenerationResultAsset,
  index: number,
): string {
  const extension = task.config.outputFormat || "png";
  const label = sanitizeFilePart(asset.label);

  return `kroma-${label}-${index + 1}.${extension}`;
}

export async function downloadTaskAsset(
  task: GenerationTask,
  asset: GenerationResultAsset,
  index: number,
): Promise<void> {
  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error("图片暂时无法下载，请稍后重试。");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  const ext = blob.type.includes("jpeg")
    ? "jpg"
    : blob.type.includes("webp")
      ? "webp"
      : blob.type.includes("png")
        ? "png"
        : task.config.outputFormat;
  anchor.download = getTaskDownloadName(task, asset, index).replace(
    /\.[^.]+$/,
    `.${ext}`,
  );
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function downloadTaskAssets(task: GenerationTask): Promise<void> {
  for (const [index, asset] of getTaskResultAssets(task).entries()) {
    await downloadTaskAsset(task, asset, index);
  }
}
