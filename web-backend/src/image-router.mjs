import { randomUUID } from "node:crypto";

const defaultModel = "gpt-image-2";
const defaultMaxAttempts = 3;
const defaultTaskTtlMs = 30 * 60 * 1000;

const terminalStatuses = new Set(["done", "error"]);

export function hasConfiguredImageProviders(env) {
  return buildProviderPool(env).providers.length > 0;
}

export function createImageRouter({
  env = process.env,
  fetch: fetchImpl = globalThis.fetch,
} = {}) {
  const tasks = new Map();
  const pool = buildProviderPool(env);

  return {
    hasProviders: () => pool.providers.length > 0,
    submit: async (requestBody, authUser = {}) => {
      cleanupTasks(tasks);
      const task = {
        task_id: `web-img-${randomUUID().replaceAll("-", "").slice(0, 12)}`,
        status: "processing",
        image_url: null,
        image_base64: null,
        channel_used: null,
        error: null,
        progress: "准备中",
        created_at: Date.now(),
        user_id: authUser.id ?? "",
        cancel_requested: false,
      };
      tasks.set(task.task_id, task);

      runTask({
        task,
        requestBody,
        pool,
        env,
        fetchImpl,
      });

      return toTaskResponse(task);
    },
    get: (taskId) => {
      cleanupTasks(tasks);
      return tasks.get(taskId) ?? null;
    },
    cancel: (taskId) => {
      const task = tasks.get(taskId);
      if (!task || terminalStatuses.has(task.status)) {
        return false;
      }
      task.cancel_requested = true;
      task.status = "error";
      task.error = "Task canceled";
      task.progress = "已取消";
      return true;
    },
    response: toTaskResponse,
    status: () => poolStatus(pool),
  };
}

function runTask({ task, requestBody, pool, env, fetchImpl }) {
  Promise.resolve()
    .then(async () => {
      const result = await routeGeneration({
        requestBody,
        pool,
        env,
        fetchImpl,
        updateProgress: (progress) => {
          if (!task.cancel_requested) {
            task.progress = progress;
          }
        },
      });

      if (task.cancel_requested) {
        return;
      }

      if (result.image_url || result.image_base64) {
        task.status = "done";
        task.image_url = result.image_url ?? null;
        task.image_base64 = result.image_base64 ?? null;
        task.channel_used = result.provider;
        task.error = null;
        task.progress = "完成";
        return;
      }

      task.status = "error";
      task.error = result.error ?? "All providers failed.";
      task.progress = "生成失败";
    })
    .catch((error) => {
      if (task.cancel_requested) {
        return;
      }
      task.status = "error";
      task.error = error?.message ?? "Generation failed.";
      task.progress = "生成失败";
    });
}

async function routeGeneration({
  requestBody,
  pool,
  env,
  fetchImpl,
  updateProgress,
}) {
  const attempts = [];
  const plan = planForRequest(requestBody);

  for (const step of plan) {
    const key = acquireProviderKey(pool, step.provider, step.tier);
    updateProgress(step.progress);

    if (!key) {
      attempts.push({ ...step, reason: "no_available_key" });
      continue;
    }

    try {
      const result = await tryProvider({
        key,
        requestBody,
        env,
        fetchImpl,
      });
      releaseProviderKey(key, Boolean(result.image_url || result.image_base64));

      if (result.image_url || result.image_base64) {
        return { ...result, provider: key.provider };
      }

      attempts.push({ ...step, reason: result.error ?? "invalid_result" });
      if (shouldStopFallback(result.error)) {
        return { error: result.error };
      }
    } catch (error) {
      releaseProviderKey(key, false);
      attempts.push({ ...step, reason: error?.message ?? "provider_exception" });
    }
  }

  return {
    error: `All providers failed: ${attempts.map((attempt) => `${attempt.provider}/${attempt.tier}:${attempt.reason}`).join(", ")}`,
  };
}

function planForRequest(requestBody) {
  if (isHdRequest(requestBody)) {
    return [
      { provider: "wuyinkeji", tier: "hd", progress: "正在尝试高清通道" },
      { provider: "rightcode", tier: "hd", progress: "正在尝试备用高清通道" },
      { provider: "gptsapi", tier: "standard", progress: "正在尝试快速通道" },
      { provider: "packyapi", tier: "hd", progress: "正在尝试第四通道" },
    ];
  }

  if (isEditToolRequest(requestBody)) {
    return [{ provider: "packyapi", tier: "standard", progress: "正在处理编辑任务" }];
  }

  return [
    { provider: "rightcode", tier: "standard", progress: "正在尝试主通道" },
    { provider: "wuyinkeji", tier: "standard", progress: "正在尝试第二通道" },
    { provider: "packyapi", tier: "standard", progress: "正在尝试第三通道" },
    { provider: "gptsapi", tier: "standard", progress: "正在尝试备用通道" },
  ];
}

function isHdRequest(requestBody) {
  return ["hd", "2k", "4k"].includes(String(requestBody.quality ?? "").toLowerCase());
}

function isEditToolRequest(requestBody) {
  const taskType = String(requestBody.task_type ?? "").toLowerCase();
  const style = String(requestBody.style ?? "").toLowerCase();
  if (taskType === "image_edit") {
    return true;
  }
  return [
    "remove_object",
    "watermark_remove",
    "background_remove",
    "retouch",
    "restoration",
    "image_edit",
  ].some((mode) => style.includes(mode));
}

async function tryProvider({ key, requestBody, env, fetchImpl }) {
  if (key.provider === "wuyinkeji") {
    return requestWuyinkeji({ key, requestBody, fetchImpl });
  }

  return requestOpenAICompatible({ key, requestBody, env, fetchImpl });
}

async function requestOpenAICompatible({ key, requestBody, env, fetchImpl }) {
  const payload = buildOpenAICompatiblePayload(key.provider, requestBody, env);
  const endpoint = `${key.baseUrl}/images/generations`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    return {
      error: providerError(response.status, data),
    };
  }

  return imageResultFromOpenAI(data);
}

function buildOpenAICompatiblePayload(provider, requestBody, env) {
  const model = provider === "packyapi"
    ? env.PACKYAPI_IMAGE_MODEL?.trim() || defaultModel
    : defaultModel;
  const payload = {
    model,
    prompt: String(requestBody.prompt ?? ""),
    n: 1,
    size: normalizeSize(requestBody.size),
    quality: isHdRequest(requestBody) ? "high" : "medium",
    response_format: "url",
  };
  const imageInput = requestBody.image_url || requestBody.image_base64;
  if (imageInput) {
    payload.image = imageInput;
  }
  if (requestBody.template_image_base64) {
    payload.image2 = requestBody.template_image_base64;
    payload.reference_image2 = requestBody.template_image_base64;
  }
  if (requestBody.mask_base64) {
    payload.mask = requestBody.mask_base64;
  }
  return payload;
}

async function requestWuyinkeji({ key, requestBody, fetchImpl }) {
  const createUrl = wuyinkejiCreateUrl(key.baseUrl);
  const detailUrl = wuyinkejiDetailUrl(key.baseUrl);
  const response = await fetchImpl(createUrl, {
    method: "POST",
    headers: {
      Authorization: key.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: String(requestBody.prompt ?? ""),
      size: sizeToRatio(requestBody.size),
      urls: [requestBody.image_url, requestBody.image_base64, requestBody.template_image_base64]
        .filter(Boolean),
    }),
  });
  const created = await parseJsonResponse(response);

  if (!response.ok || created?.code !== 200) {
    return { error: providerError(response.status, created) };
  }

  const providerTaskId = created?.data?.id;
  if (!providerTaskId) {
    return { error: "wuyinkeji_missing_task_id" };
  }

  for (let attempt = 0; attempt < 36; attempt += 1) {
    await wait(5000);
    const poll = await fetchImpl(`${detailUrl}?id=${encodeURIComponent(providerTaskId)}`, {
      method: "GET",
      headers: { Authorization: key.apiKey },
    });
    const pollData = await parseJsonResponse(poll);
    const taskData = pollData?.data ?? {};

    if (taskData.status === 2) {
      return normalizeWuyinkejiResult(taskData.result);
    }

    if (taskData.status === 3) {
      return { error: taskData.message || "wuyinkeji_failed" };
    }
  }

  return { error: "wuyinkeji_timeout" };
}

function imageResultFromOpenAI(data) {
  const first = Array.isArray(data?.data) ? data.data[0] : null;
  const image = first?.url ?? first?.b64_json ?? "";

  if (!image) {
    return { error: "missing_image_result" };
  }

  if (String(image).startsWith("http")) {
    return { image_url: image };
  }

  if (String(image).startsWith("data:")) {
    return { image_base64: image };
  }

  return { image_base64: `data:image/png;base64,${image}` };
}

function normalizeWuyinkejiResult(result) {
  let image = "";
  if (Array.isArray(result)) {
    image = result[0] ?? "";
  } else if (typeof result === "string") {
    image = result;
  } else if (result && typeof result === "object") {
    image = result.url ?? result.image_url ?? "";
  }

  if (!image) {
    return { error: "wuyinkeji_missing_image_result" };
  }

  return String(image).startsWith("http")
    ? { image_url: image }
    : { image_base64: String(image).startsWith("data:") ? image : `data:image/png;base64,${image}` };
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function providerError(status, data) {
  const message = data?.error?.message ?? data?.message ?? data?.msg ?? data?.detail;
  if (status === 401 || status === 403) {
    return "banned";
  }
  if (status === 429) {
    return "rate_limited";
  }
  if (message) {
    return `http_${status}: ${String(message).slice(0, 180)}`;
  }
  return `http_${status}`;
}

function shouldStopFallback(error) {
  const text = String(error ?? "").toLowerCase();
  return text.includes("input_image_upload_failed") || text.includes("result_image_upload_failed");
}

function buildProviderPool(env) {
  const providers = [
    ...buildProviderKeys(env, "rightcode", "RIGHTCODE", 10),
    ...buildProviderKeys(env, "packyapi", "PACKYAPI", 12),
    ...buildProviderKeys(env, "wuyinkeji", "WUYINKEJI", 4),
    ...buildProviderKeys(env, "gptsapi", "GPTSAPI", 5),
  ];

  return { providers };
}

function buildProviderKeys(env, provider, prefix, defaultMaxKeys) {
  const baseUrl = env[`${prefix}_BASE_URL`]?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return [];
  }

  const maxConcurrent = Math.max(
    1,
    Number.parseInt(env[`${prefix}_CONCURRENT`] ?? "10", 10) || 10,
  );
  const indices = new Set(Array.from({ length: defaultMaxKeys }, (_, index) => index + 1));
  for (const key of Object.keys(env)) {
    const match = key.match(new RegExp(`^${prefix}_KEY_(\\d+)$`));
    if (match) {
      indices.add(Number.parseInt(match[1], 10));
    }
  }

  const keys = [];
  for (const index of [...indices].sort((left, right) => left - right)) {
    const apiKey = env[`${prefix}_KEY_${index}`]?.trim();
    if (!apiKey) {
      continue;
    }
    keys.push(createProviderKey({
      id: `${provider}_${index}`,
      provider,
      tier: "standard",
      baseUrl,
      apiKey,
      maxConcurrent,
    }));
    if (provider !== "gptsapi") {
      keys.push(createProviderKey({
        id: `${provider}_hd_${index}`,
        provider,
        tier: "hd",
        baseUrl,
        apiKey,
        maxConcurrent,
      }));
    }
  }

  return keys;
}

function createProviderKey(input) {
  return {
    ...input,
    currentConcurrent: 0,
    consecutiveFails: 0,
    cooldownUntil: 0,
    cursor: 0,
  };
}

function acquireProviderKey(pool, provider, tier) {
  const candidates = pool.providers.filter((key) => (
    key.provider === provider &&
    key.tier === tier &&
    key.currentConcurrent < key.maxConcurrent &&
    key.cooldownUntil < Date.now()
  ));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => left.currentConcurrent - right.currentConcurrent);
  const key = candidates[0];
  key.currentConcurrent += 1;
  return key;
}

function releaseProviderKey(key, success) {
  key.currentConcurrent = Math.max(0, key.currentConcurrent - 1);
  if (success) {
    key.consecutiveFails = 0;
    return;
  }
  key.consecutiveFails += 1;
  if (key.consecutiveFails >= defaultMaxAttempts) {
    key.cooldownUntil = Date.now() + 5 * 60 * 1000;
  }
}

function poolStatus(pool) {
  return {
    total: pool.providers.length,
    providers: pool.providers.map((key) => ({
      id: key.id,
      provider: key.provider,
      tier: key.tier,
      concurrent: `${key.currentConcurrent}/${key.maxConcurrent}`,
      cooling: key.cooldownUntil > Date.now(),
    })),
  };
}

function normalizeSize(size) {
  const value = String(size ?? "").trim();
  return /^\d+x\d+$/i.test(value) ? value.toLowerCase() : "1024x1024";
}

function sizeToRatio(size) {
  const value = normalizeSize(size);
  const [width, height] = value.split("x").map((part) => Number.parseInt(part, 10));
  if (!width || !height) {
    return "1:1";
  }
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function gcd(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function wuyinkejiCreateUrl(baseUrl) {
  const root = baseUrl.replace(/\/api\/async\/?$/, "");
  return `${root}/api/async/image_gpt`;
}

function wuyinkejiDetailUrl(baseUrl) {
  const root = baseUrl.replace(/\/api\/async\/?$/, "");
  return `${root}/api/async/detail`;
}

function toTaskResponse(task) {
  return {
    task_id: task.task_id,
    status: task.status,
    image_url: task.image_url,
    image_base64: task.image_base64,
    channel_used: task.channel_used,
    error: task.error,
    progress: task.progress,
  };
}

function cleanupTasks(tasks) {
  const now = Date.now();
  for (const [taskId, task] of tasks.entries()) {
    if (now - task.created_at > defaultTaskTtlMs) {
      tasks.delete(taskId);
    }
  }
}

function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
