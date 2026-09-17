import { getAccountAccessToken } from "../storage/accountStore";
import { refreshKromaSession } from "./accountApi";
import { fetchWithTimeout } from "./requestTimeout";

export type LiveVideoClarity = "720p" | "1080p";

interface LiveVideoTask {
  task_id: string;
  status: "queued" | "pending" | "processing" | "done" | "error";
  video_url?: string | null;
  error?: string | null;
  progress?: string | null;
}

interface GenerateLiveVideoInput {
  firstFrameUrl: string;
  prompt: string;
  size: LiveVideoClarity;
}

interface GenerateLiveVideoOptions {
  onProgress?: (progress: string) => void;
  pollIntervalMs?: number;
  maxPolls?: number;
  prepareFrame?: (sourceUrl: string) => Promise<string>;
}

export function getLiveVideoCreditCost(clarity: LiveVideoClarity): number {
  return clarity === "1080p" ? 40 : 30;
}

export async function generateLiveVideo(
  input: GenerateLiveVideoInput,
  options: GenerateLiveVideoOptions = {},
): Promise<{ taskId: string; videoUrl: string }> {
  const baseUrl = getConfiguredApiBaseUrl();
  if (!baseUrl) throw new Error("Live 图后端尚未配置。");

  options.onProgress?.("正在准备 105% 固定首帧");
  const preparedFrameUrl = await (
    options.prepareFrame ?? prepareLiveVideoFrame
  )(input.firstFrameUrl);

  const created = await requestVideoTask(`${baseUrl}/video/generate`, {
    method: "POST",
    body: JSON.stringify({
      prompt: buildLiveVideoPrompt(input.prompt),
      firstFrameUrl: preparedFrameUrl,
      lastFrameUrl: preparedFrameUrl,
      aspectRatio: "16:9",
      size: input.size,
    }),
  });
  if (!created.task_id) throw new Error("视频服务没有返回任务编号。");

  let task = created;
  const maxPolls = options.maxPolls ?? 120;
  const interval = options.pollIntervalMs ?? 5000;
  for (let index = 0; index <= maxPolls; index += 1) {
    options.onProgress?.(task.progress || "正在生成 Live 图");
    if (task.status === "done") {
      if (!task.video_url) throw new Error("视频生成完成，但没有返回视频地址。");
      return { taskId: task.task_id, videoUrl: task.video_url };
    }
    if (task.status === "error") {
      throw new Error(task.error || "Live 图生成失败，请重试。");
    }
    if (index === maxPolls) throw new Error("Live 图仍在生成，请稍后重试。");
    if (interval > 0) await wait(interval);
    task = await requestVideoTask(
      `${baseUrl}/video/task/${encodeURIComponent(task.task_id)}`,
      { method: "GET" },
    );
  }

  throw new Error("Live 图生成失败，请重试。");
}

export async function downloadLiveVideo(taskId: string): Promise<Blob> {
  const baseUrl = getConfiguredApiBaseUrl();
  if (!baseUrl) throw new Error("Live 图后端尚未配置。");

  let response = await fetchWithTimeout(
    `${baseUrl}/video/task/${encodeURIComponent(taskId)}/download`,
    buildRequestInit({ method: "GET" }, getAccountAccessToken()),
    120000,
  );
  if (response.status === 401 || response.status === 403) {
    await response.text();
    const token = await refreshKromaSession();
    if (!token) throw new Error("登录已过期，请重新登录。");
    response = await fetchWithTimeout(
      `${baseUrl}/video/task/${encodeURIComponent(taskId)}/download`,
      buildRequestInit({ method: "GET" }, token),
      120000,
    );
  }
  if (!response.ok) throw new Error("Live 图下载失败，请稍后重试。");
  return response.blob();
}

export function buildLiveVideoPrompt(userPrompt: string): string {
  const request = userPrompt.trim();
  return [
    "Create a short, silent, natural smartphone Live Photo video from the supplied source image.",
    "The supplied first and last frames are identical and have already been center-cropped to the final 105% composition.",
    "Frame 1 must match the supplied frame exactly. From frame 1 onward, lock the exact scale, crop, framing, focal length, subject size, camera position and camera distance for the entire clip.",
    "Preserve the exact person identity, facial features, body proportions, clothing category, solid colors, patterns, seams, buttons, logos, product design, background, lighting, object count and spatial relationships in every frame.",
    request ? `Optional subject-motion direction: ${request}` : "",
    "If a person is visible, allow only tiny lifelike subject motion such as one natural blink, slight breathing, a minimal gaze or facial-expression change, and gentle hair or fabric movement. Keep the feet planted and torso orientation unchanged; do not walk, turn around, change pose or make large arm movements.",
    "If no person is visible, keep every product and every background element completely still.",
    "The camera is completely locked after the 105% crop. No handheld drift, pan, tilt, roll, shake, translation, parallax, zoom, push in, pull out, dolly, reframe, orbit, perspective change or accumulated movement is allowed at any time.",
    "Camera lock and composition lock override any conflicting user direction.",
    "Place any permitted subject-only motion within the first 1.8 seconds, then settle nearly still and finish on the identical supplied last frame.",
    "Keep the clip silent with no generated speech, music or sound effects.",
    "No speaking, lip-sync, exaggerated gestures, scene cut, morphing, identity drift, extra limbs, changed hands, changed clothing color or pattern, changed product, new print, new object, text, captions or watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function prepareLiveVideoFrame(sourceUrl: string): Promise<string> {
  const baseUrl = getConfiguredApiBaseUrl();
  if (!baseUrl) throw new Error("Live 图后端尚未配置。");

  const sourceResponse = await fetchWithTimeout(
    sourceUrl,
    { method: "GET", cache: "force-cache" },
    30000,
  );
  if (!sourceResponse.ok) throw new Error("首帧图片读取失败，请重新选择图片。");
  const sourceBlob = await sourceResponse.blob();
  if (!sourceBlob.type.startsWith("image/")) {
    throw new Error("首帧文件不是有效图片，请重新选择。");
  }

  const decoded = await decodeImage(sourceBlob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法处理首帧图片。");

    const sourceWidth = decoded.width / 1.05;
    const sourceHeight = decoded.height / 1.05;
    context.drawImage(
      decoded.source,
      (decoded.width - sourceWidth) / 2,
      (decoded.height - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
      0,
      0,
      decoded.width,
      decoded.height,
    );
    const croppedBlob = await canvasToBlob(canvas);
    return await uploadPreparedFrame(baseUrl, croppedBlob);
  } finally {
    decoded.close?.();
  }
}

async function decodeImage(blob: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("105% 首帧裁切失败，请重新选择图片。")),
      "image/webp",
      0.95,
    );
  });
}

async function uploadPreparedFrame(baseUrl: string, frame: Blob): Promise<string> {
  let token = getAccountAccessToken();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const form = new FormData();
    form.append("image", frame, `kroma-live-frame-${Date.now()}.webp`);
    const response = await fetchWithTimeout(
      `${baseUrl}/video/frame`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      },
      30000,
    );
    if ((response.status === 401 || response.status === 403) && attempt === 0) {
      token = await refreshKromaSession();
      if (token) continue;
    }
    if (!response.ok) throw new Error("105% 首帧上传失败，请稍后重试。");
    const payload = (await response.json()) as { frame_url?: string };
    if (!payload.frame_url) throw new Error("首帧服务没有返回图片地址。");
    return payload.frame_url;
  }
  throw new Error("登录已过期，请重新登录。");
}

function getConfiguredApiBaseUrl(): string | null {
  const value =
    import.meta.env.VITE_WEB_API_BASE_URL?.trim() ||
    import.meta.env.VITE_KROMA_API_BASE_URL?.trim();
  if (value) return value.replace(/\/+$/, "");
  return import.meta.env.MODE === "test"
    ? `${window.location.origin}/api/v1`
    : null;
}

async function requestVideoTask(
  url: string,
  init: Omit<RequestInit, "headers">,
): Promise<LiveVideoTask> {
  let response = await fetchWithTimeout(
    url,
    buildRequestInit(init, getAccountAccessToken()),
    30000,
  );
  if (response.status === 401 || response.status === 403) {
    await response.text();
    const token = await refreshKromaSession();
    if (!token) throw new Error("登录已过期，请重新登录。");
    response = await fetchWithTimeout(url, buildRequestInit(init, token), 30000);
  }
  if (!response.ok) {
    const text = await response.text();
    let detail = text;
    try {
      detail = JSON.parse(text)?.detail || text;
    } catch {}
    throw new Error(`Live 图请求失败：${detail}`);
  }
  return response.json() as Promise<LiveVideoTask>;
}

function buildRequestInit(
  init: Omit<RequestInit, "headers">,
  token: string | null,
): RequestInit {
  return {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Kroma-Client": "web",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
