import { randomUUID } from "node:crypto";

const defaultCreateUrl =
  "https://api.wuyinkeji.com/api/async/video_veo3.1_fast";
const pollIntervalMs = 5000;
const maxPolls = 120;

export function createVideoRouter({
  env = process.env,
  fetch: fetchImpl = globalThis.fetch,
} = {}) {
  const tasks = new Map();

  return {
    configured: () => Boolean(videoApiKey(env)),
    submit: async (requestBody, authUser = {}) => {
      if (!videoApiKey(env)) {
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
      void runVideoTask({ task, requestBody, env, fetchImpl });
      return toVideoTaskResponse(task);
    },
    get: (taskId) => tasks.get(taskId) ?? null,
    response: toVideoTaskResponse,
  };
}

async function runVideoTask({ task, requestBody, env, fetchImpl }) {
  try {
    const payload = buildVideoPayload(requestBody);
    const response = await fetchImpl(videoCreateUrl(env), {
      method: "POST",
      headers: {
        Authorization: videoApiKey(env),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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
        `${videoDetailUrl(env)}?id=${encodeURIComponent(providerTaskId)}`,
        { method: "GET", headers: { Authorization: videoApiKey(env) } },
      );
      const polled = await parseJson(poll);
      if (!poll.ok) {
        if (attempt < maxPolls - 1) continue;
        throw new Error(providerError(poll.status, polled));
      }
      const data = polled?.data ?? {};
      const status = Number(data.status);
      const result = extractVideoUrl(data.result ?? data.url ?? data.video_url);

      if (status === 2 || result) {
        if (!result) throw new Error("视频任务已完成，但没有返回视频地址。");
        task.status = "done";
        task.video_url = result;
        task.progress = "Live 图生成完成";
        return;
      }
      if (status === 3) {
        throw new Error(String(data.message ?? data.msg ?? "Live 图生成失败。"));
      }
      await wait(pollIntervalMs);
    }

    throw new Error("Live 图生成超时，请稍后重试。");
  } catch (error) {
    task.status = "error";
    task.error = error instanceof Error ? error.message : "Live 图生成失败。";
    task.progress = "生成失败";
  }
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
    lastFrameUrl: requestedLastFrameUrl || firstFrameUrl,
    aspectRatio: "16:9",
    size,
  };
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

function videoApiKey(env) {
  return String(env.WUYINKEJI_VIDEO_KEY ?? "").trim();
}

function videoCreateUrl(env) {
  return String(env.WUYINKEJI_VIDEO_URL ?? defaultCreateUrl)
    .trim()
    .replace(/\/+$/, "");
}

function videoDetailUrl(env) {
  const configured = String(env.WUYINKEJI_VIDEO_DETAIL_URL ?? "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  return videoCreateUrl(env).replace(
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
  };
}
