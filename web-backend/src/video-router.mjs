import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

const defaultWuyinCreateUrl =
  "https://api.wuyinkeji.com/api/async/video_veo3.1_fast";
const defaultModelHubCreateUrl = "https://api.lk888.ai/v1/media/generate";
const defaultModelHubStatusUrl = "https://api.lk888.ai/v1/media/status";
const pollIntervalMs = 5000;
const maxPolls = 120;
const providerDurationSeconds = 4;
const deliveredDurationSeconds = 3;
const maxVideoBytes = 100 * 1024 * 1024;

export function createVideoRouter({
  env = process.env,
  fetch: fetchImpl = globalThis.fetch,
  deliverVideo = deliverProcessedLiveVideo,
} = {}) {
  const tasks = new Map();

  return {
    configured: () => Boolean(resolveVideoProvider(env)),
    submit: async (requestBody, authUser = {}) => {
      if (!resolveVideoProvider(env)) {
        return {
          task_id: `web-video-${randomUUID()}`,
          status: "error",
          video_url: null,
          error: "Live 图视频服务尚未配置。",
          progress: "生成失败",
        };
      }

      const task = {
        task_id: `web-video-${randomUUID()}`,
        user_id: String(authUser.id ?? ""),
        status: "processing",
        provider_task_id: null,
        video_url: null,
        error: null,
        progress: "正在生成 Live 图",
        created_at: new Date().toISOString(),
      };
      tasks.set(task.task_id, task);
      void runVideoTask({ task, requestBody, env, fetchImpl, deliverVideo });
      return toVideoTaskResponse(task);
    },
    get: (taskId) => tasks.get(taskId) ?? null,
    response: toVideoTaskResponse,
  };
}

async function runVideoTask({
  task,
  requestBody,
  env,
  fetchImpl,
  deliverVideo,
}) {
  try {
    const payload = buildVideoPayload(requestBody);
    const provider = resolveVideoProvider(env);
    if (!provider) throw new Error("Live 图视频服务尚未配置。");
    if (provider === "model_hub") {
      await runModelHubVideoTask({
        task,
        payload,
        env,
        fetchImpl,
        deliverVideo,
      });
    } else {
      await runWuyinVideoTask({
        task,
        payload,
        env,
        fetchImpl,
        deliverVideo,
      });
    }
  } catch (error) {
    task.status = "error";
    task.error = error instanceof Error ? error.message : "Live 图生成失败。";
    task.progress = "生成失败";
  }
}

async function runWuyinVideoTask({
  task,
  payload,
  env,
  fetchImpl,
  deliverVideo,
}) {
  const response = await fetchImpl(wuyinCreateUrl(env), {
    method: "POST",
    headers: {
      Authorization: wuyinVideoApiKey(env),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildWuyinVideoPayload(payload)),
  });
  const created = await parseJson(response);
  if (!response.ok || Number(created?.code) !== 200) {
    throw new Error(providerError(response.status, created));
  }

  const providerTaskId = String(created?.data?.id ?? "").trim();
  if (!providerTaskId) throw new Error("视频服务没有返回任务编号。");
  task.provider_task_id = providerTaskId;

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const poll = await fetchImpl(
      `${wuyinDetailUrl(env)}?id=${encodeURIComponent(providerTaskId)}`,
      { method: "GET", headers: { Authorization: wuyinVideoApiKey(env) } },
    );
    const polled = await parseJson(poll);
    if (!poll.ok) {
      if (attempt < maxPolls - 1) {
        await wait(pollIntervalMs);
        continue;
      }
      throw new Error(providerError(poll.status, polled));
    }
    const data = polled?.data ?? {};
    const status = Number(data.status);
    const result = extractVideoUrl(data.result ?? data.url ?? data.video_url);
    if (status === 2 || result) {
      await completeVideoTask({
        task,
        result,
        env,
        fetchImpl,
        deliverVideo,
      });
      return;
    }
    if (status === 3) {
      throw new Error(String(data.message ?? data.msg ?? "Live 图生成失败。"));
    }
    await wait(pollIntervalMs);
  }

  throw new Error("Live 图生成超时，请稍后重试。");
}

async function runModelHubVideoTask({
  task,
  payload,
  env,
  fetchImpl,
  deliverVideo,
}) {
  const response = await fetchImpl(modelHubCreateUrl(env), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${modelHubVideoApiKey(env)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildModelHubVideoPayload(payload, env)),
  });
  const created = await parseJson(response);
  const providerTaskId = String(
    created?.data?.task_id ??
      created?.data?.id ??
      created?.task_id ??
      created?.id ??
      "",
  ).trim();
  if (!response.ok || (Number(created?.code) !== 200 && !providerTaskId)) {
    throw new Error(providerError(response.status, created));
  }
  if (!providerTaskId) throw new Error("视频服务没有返回任务编号。");
  task.provider_task_id = providerTaskId;

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const pollUrl = new URL(modelHubStatusUrl(env));
    pollUrl.searchParams.set("task_id", providerTaskId);
    const poll = await fetchImpl(pollUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${modelHubVideoApiKey(env)}` },
    });
    const polled = await parseJson(poll);
    if (!poll.ok) {
      if (attempt < maxPolls - 1) {
        await wait(pollIntervalMs);
        continue;
      }
      throw new Error(providerError(poll.status, polled));
    }

    const state = String(polled?.state ?? "").toLowerCase();
    const isFinal = polled?.is_final === true;
    const result = extractVideoUrl(
      polled?.result_url ?? polled?.result ?? polled?.video_url,
    );
    task.progress = String(polled?.progress || "正在生成 Live 图");
    if (state === "success" || (isFinal && result)) {
      await completeVideoTask({
        task,
        result,
        env,
        fetchImpl,
        deliverVideo,
      });
      return;
    }
    if (isFinal || ["error", "failed", "failure"].includes(state)) {
      throw new Error(
        String(
          polled?.error || polled?.msg || polled?.status || "Live 图生成失败。",
        ),
      );
    }
    await wait(pollIntervalMs);
  }

  throw new Error("Live 图生成超时，请稍后重试。");
}

async function completeVideoTask({
  task,
  result,
  env,
  fetchImpl,
  deliverVideo,
}) {
  if (!result) throw new Error("视频任务已完成，但没有返回视频地址。");
  task.progress = "正在处理 3 秒无声 Live 图";
  const delivered = await deliverVideo({
    task,
    sourceUrl: result,
    env,
    fetchImpl,
  });
  if (!delivered?.url) throw new Error("Live 图无声成片处理失败。");
  task.status = "done";
  task.provider_video_url = result;
  task.video_url = delivered.url;
  task.duration_seconds = delivered.durationSeconds;
  task.has_audio = delivered.hasAudio;
  task.progress = "Live 图生成完成";
}

export function buildVideoPayload(requestBody) {
  const prompt = String(requestBody?.prompt ?? "").trim();
  const firstFrameUrl = parsePublicImageUrl(requestBody?.firstFrameUrl);
  const requestedLastFrameUrl = parsePublicImageUrl(requestBody?.lastFrameUrl);
  const size = normalizeVideoSize(requestBody?.size);

  if (!prompt) throw new Error("请填写动态提示词。");
  if (!firstFrameUrl) throw new Error("请先选择可访问的首帧图片。");

  return {
    prompt,
    firstFrameUrl,
    ...(requestedLastFrameUrl ? { lastFrameUrl: requestedLastFrameUrl } : {}),
    aspectRatio:
      String(requestBody?.aspectRatio ?? "").toLowerCase() === "adaptive"
        ? "adaptive"
        : "16:9",
    size,
  };
}

function buildWuyinVideoPayload(payload) {
  return { ...payload, aspectRatio: "16:9" };
}

export function buildModelHubVideoPayload(payload, env = process.env) {
  const images = [payload.firstFrameUrl];
  if (payload.lastFrameUrl) images.push(payload.lastFrameUrl);
  return {
    model: String(env.AI_MODEL_HUB_VIDEO_MODEL || "minimax-h3").trim(),
    prompt: payload.prompt,
    params: {
      mode: "shouweizhen",
      images,
      // MiniMax H3 accepts a minimum of four seconds. The delivery pipeline
      // trims this source to the product's three-second silent Live clip.
      duration: String(providerDurationSeconds),
      aspect_ratio: "adaptive",
      resolution: payload.size === "1080p" ? "1080P" : "768P",
    },
  };
}

export function buildLiveVideoFfmpegArgs(inputPath, outputPath) {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    inputPath,
    "-t",
    String(deliveredDurationSeconds),
    "-map",
    "0:v:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    outputPath,
  ];
}

async function deliverProcessedLiveVideo({ task, sourceUrl, env, fetchImpl }) {
  if (!hasVideoDeliveryStorage(env)) {
    return { url: sourceUrl, durationSeconds: null, hasAudio: null };
  }
  if (!ffmpegPath) throw new Error("Live 图无声处理程序不可用。");

  const directory = await mkdtemp(join(tmpdir(), "kroma-live-"));
  const inputPath = join(directory, "provider.mp4");
  const outputPath = join(directory, "live-3s-silent.mp4");
  try {
    const source = await fetchImpl(sourceUrl);
    if (!source.ok) throw new Error("视频结果下载失败，无法制作无声 Live 图。");
    const contentType = String(source.headers.get("content-type") || "");
    if (
      contentType &&
      !contentType.toLowerCase().startsWith("video/") &&
      !contentType.toLowerCase().startsWith("application/octet-stream")
    ) {
      await source.body?.cancel();
      throw new Error("视频服务返回了无效文件，无法制作无声 Live 图。");
    }
    const declaredBytes = Number(source.headers.get("content-length") || 0);
    if (declaredBytes > maxVideoBytes) {
      await source.body?.cancel();
      throw new Error("视频文件过大，无法制作无声 Live 图。");
    }
    const sourceBuffer = Buffer.from(await source.arrayBuffer());
    if (!sourceBuffer.length || sourceBuffer.length > maxVideoBytes) {
      throw new Error("视频文件无效或过大，无法制作无声 Live 图。");
    }
    await writeFile(inputPath, sourceBuffer);
    await runFfmpeg(buildLiveVideoFfmpegArgs(inputPath, outputPath));
    const deliveredBuffer = await readFile(outputPath);
    if (!deliveredBuffer.length || deliveredBuffer.length > maxVideoBytes) {
      throw new Error("无声 Live 图输出无效或过大。");
    }
    const url = await uploadDeliveredLiveVideo({
      task,
      buffer: deliveredBuffer,
      env,
      fetchImpl,
    });
    return {
      url,
      durationSeconds: deliveredDurationSeconds,
      hasAudio: false,
    };
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4000);
    });
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Live 图无声处理超时。"));
    }, 120000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || "Live 图无声处理失败。"));
    });
  });
}

async function uploadDeliveredLiveVideo({ task, buffer, env, fetchImpl }) {
  const baseUrl = String(env.WEB_SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey = String(env.WEB_SUPABASE_SERVICE_ROLE_KEY || "");
  const bucket = String(env.WEB_VIDEO_STORAGE_BUCKET || "web-live-videos");
  await ensureVideoStorageBucket({ baseUrl, serviceKey, bucket, fetchImpl });
  const objectPath = [
    sanitizeStorageSegment(task.user_id),
    "live-videos",
    `${sanitizeStorageSegment(task.task_id)}.mp4`,
  ].join("/");
  const upload = await fetchImpl(
    `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`,
    {
      method: "PUT",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "video/mp4",
        "x-upsert": "true",
      },
      body: buffer,
    },
  );
  if (!upload.ok) {
    const detail = await upload.text();
    throw new Error(detail || "无声 Live 图保存失败。");
  }
  await upload.body?.cancel();
  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath}`;
}

async function ensureVideoStorageBucket({
  baseUrl,
  serviceKey,
  bucket,
  fetchImpl,
}) {
  const response = await fetchImpl(`${baseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: true,
      file_size_limit: maxVideoBytes,
      allowed_mime_types: ["video/mp4"],
    }),
  });
  if (response.status === 409) {
    await response.text();
    return;
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Live 图存储空间创建失败。");
  }
  await response.body?.cancel();
}

function hasVideoDeliveryStorage(env) {
  return Boolean(env.WEB_SUPABASE_URL && env.WEB_SUPABASE_SERVICE_ROLE_KEY);
}

function sanitizeStorageSegment(value) {
  return String(value ?? "unknown")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown";
}

function normalizeVideoSize(value) {
  return String(value ?? "720p").toLowerCase() === "1080p"
    ? "1080p"
    : "720p";
}

function parsePublicImageUrl(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function extractVideoUrl(value) {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return value;
    try {
      return extractVideoUrl(JSON.parse(value));
    } catch {
      return "";
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractVideoUrl(item);
      if (found) return found;
    }
    return "";
  }
  if (value && typeof value === "object") {
    for (const key of ["url", "video_url", "videoUrl", "output", "result"]) {
      const found = extractVideoUrl(value[key]);
      if (found) return found;
    }
  }
  return "";
}

function resolveVideoProvider(env) {
  if (modelHubVideoApiKey(env)) return "model_hub";
  if (wuyinVideoApiKey(env)) return "wuyin";
  return null;
}

function modelHubVideoApiKey(env) {
  return String(env.AI_MODEL_HUB_VIDEO_KEY ?? "").trim();
}

function wuyinVideoApiKey(env) {
  return String(env.WUYINKEJI_VIDEO_KEY ?? "").trim();
}

function modelHubCreateUrl(env) {
  return String(env.AI_MODEL_HUB_VIDEO_URL ?? defaultModelHubCreateUrl)
    .trim()
    .replace(/\/+$/, "");
}

function modelHubStatusUrl(env) {
  return String(env.AI_MODEL_HUB_VIDEO_STATUS_URL ?? defaultModelHubStatusUrl)
    .trim()
    .replace(/\/+$/, "");
}

function wuyinCreateUrl(env) {
  return String(env.WUYINKEJI_VIDEO_URL ?? defaultWuyinCreateUrl)
    .trim()
    .replace(/\/+$/, "");
}

function wuyinDetailUrl(env) {
  const configured = String(env.WUYINKEJI_VIDEO_DETAIL_URL ?? "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  return wuyinCreateUrl(env).replace(
    /\/api\/async\/video_veo3\.1_fast$/i,
    "/api/async/detail",
  );
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function providerError(status, payload) {
  return String(
    payload?.msg ??
      payload?.message ??
      payload?.detail ??
      `视频服务请求失败（HTTP ${status}）。`,
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toVideoTaskResponse(task) {
  return {
    task_id: task.task_id,
    status: task.status,
    video_url: task.video_url,
    error: task.error,
    progress: task.progress,
    duration_seconds: task.duration_seconds ?? null,
    has_audio: task.has_audio ?? null,
  };
}
