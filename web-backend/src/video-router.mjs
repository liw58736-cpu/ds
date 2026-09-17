import { randomUUID } from "node:crypto";

const defaultWuyinCreateUrl =
  "https://api.wuyinkeji.com/api/async/video_veo3.1_fast";
const defaultModelHubCreateUrl = "https://api.lk888.ai/v1/media/generate";
const defaultModelHubStatusUrl = "https://api.lk888.ai/v1/media/status";
const pollIntervalMs = 5000;
const maxPolls = 120;

export function createVideoRouter({
  env = process.env,
  fetch: fetchImpl = globalThis.fetch,
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
    const provider = resolveVideoProvider(env);
    if (!provider) throw new Error("Live 图视频服务尚未配置。");
    if (provider === "model_hub") {
      await runModelHubVideoTask({ task, payload, env, fetchImpl });
    } else {
      await runWuyinVideoTask({ task, payload, env, fetchImpl });
    }
  } catch (error) {
    task.status = "error";
    task.error = error instanceof Error ? error.message : "Live 图生成失败。";
    task.progress = "生成失败";
  }
}

async function runWuyinVideoTask({ task, payload, env, fetchImpl }) {
  const response = await fetchImpl(wuyinCreateUrl(env), {
    method: "POST",
    headers: {
      Authorization: wuyinVideoApiKey(env),
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
      completeVideoTask(task, result);
      return;
    }
    if (status === 3) {
      throw new Error(String(data.message ?? data.msg ?? "Live 图生成失败。"));
    }
    await wait(pollIntervalMs);
  }

  throw new Error("Live 图生成超时，请稍后重试。");
}

async function runModelHubVideoTask({ task, payload, env, fetchImpl }) {
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
      completeVideoTask(task, result);
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

function completeVideoTask(task, result) {
  if (!result) throw new Error("视频任务已完成，但没有返回视频地址。");
  task.status = "done";
  task.video_url = result;
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
    lastFrameUrl: requestedLastFrameUrl || firstFrameUrl,
    aspectRatio: "16:9",
    size,
  };
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
      duration: "4",
      aspect_ratio: "adaptive",
      resolution: payload.size === "1080p" ? "1080P" : "768P",
    },
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
  };
}
