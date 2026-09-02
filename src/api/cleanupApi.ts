import { refreshKromaSession } from "./accountApi";
import { getAccountAccessToken } from "../storage/accountStore";
import { getConfiguredKromaApiBaseUrl } from "./kromaGenerationAdapter";

export type CleanupMode = "watermark_remove" | "remove_object";

interface CleanupTaskResponse {
  task_id: string;
  status: "pending" | "processing" | "done" | "error";
  image_url?: string | null;
  image_base64?: string | null;
  channel_used?: string | null;
  error?: string | null;
}

export interface CleanupResult {
  imageUrl: string;
  channelUsed?: string;
}

async function fetchWithAuthRefresh(url: string, init: RequestInit): Promise<Response> {
  let token = getAccountAccessToken();
  if (!token) throw new Error("请先登录后再使用图片清理。");

  let response = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (response.status !== 401) return response;

  token = await refreshKromaSession();
  if (!token) return response;
  response = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  return response;
}

function normalizeResult(task: CleanupTaskResponse): CleanupResult {
  const imageUrl = task.image_url
    ? task.image_url
    : task.image_base64
      ? task.image_base64.startsWith("data:")
        ? task.image_base64
        : `data:image/png;base64,${task.image_base64}`
      : "";
  if (!imageUrl) throw new Error(task.error || "图片清理没有返回结果。");
  return { imageUrl, ...(task.channel_used ? { channelUsed: task.channel_used } : {}) };
}

export async function runImageCleanup(input: {
  imageBase64: string;
  maskBase64: string;
  mode: CleanupMode;
  prompt?: string;
  onProgress?: (progress: string) => void;
  onTaskStarted?: (backendTaskId: string) => void;
}): Promise<CleanupResult> {
  const baseUrl = getConfiguredKromaApiBaseUrl();
  if (!baseUrl) throw new Error("图片清理后端未配置。");

  const label = input.mode === "watermark_remove" ? "水印、文字或标记" : "不需要的物体";
  const response = await fetchWithAuthRefresh(`${baseUrl}/image/generate`, {
    method: "POST",
    body: JSON.stringify({
      prompt: input.prompt?.trim() || `仅移除画笔标记范围内的${label}，自然修复背景，未标记区域保持完全不变。`,
      task_type: input.mode,
      style: `image_cleanup:${input.mode}:standard`,
      image_base64: input.imageBase64,
      mask_base64: input.maskBase64,
      size: "1024x1024",
      quality: "standard",
      use_template_mode: false,
      keep_user_outfit_pose: false,
    }),
  });
  if (!response.ok) throw new Error(`图片清理提交失败（HTTP ${response.status}）：${await response.text()}`);
  let task = (await response.json()) as CleanupTaskResponse;
  if (task.task_id) input.onTaskStarted?.(task.task_id);

  for (let attempt = 0; attempt < 360; attempt += 1) {
    if (task.status === "done") return normalizeResult(task);
    if (task.status === "error") throw new Error(task.error || "图片清理失败，请重试。");
    input.onProgress?.("正在清理标记区域");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const poll = await fetchWithAuthRefresh(`${baseUrl}/image/task/${encodeURIComponent(task.task_id)}`, { method: "GET" });
    if (!poll.ok) throw new Error(`图片清理任务查询失败（HTTP ${poll.status}）`);
    task = (await poll.json()) as CleanupTaskResponse;
  }

  throw new Error("图片清理等待超时，请稍后在历史任务中查看。");
}
