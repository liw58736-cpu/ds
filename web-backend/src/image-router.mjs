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
      const validatedResult = validateProviderImageResult(result);
      releaseProviderKey(key, hasProviderImage(validatedResult));

      if (hasProviderImage(validatedResult)) {
        return { ...validatedResult, provider: key.provider };
      }

      attempts.push({ ...step, reason: validatedResult.error ?? "invalid_result" });
      if (shouldStopFallback(validatedResult.error)) {
        return { error: validatedResult.error };
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
      { provider: "wuyinkeji", tier: "hd", progress: "正在生成高清图片" },
      { provider: "rightcode", tier: "hd", progress: "正在生成高清图片" },
      { provider: "gptsapi", tier: "standard", progress: "正在生成高清图片" },
      { provider: "packyapi", tier: "hd", progress: "正在生成高清图片" },
    ];
  }

  if (isEditToolRequest(requestBody)) {
    return [{ provider: "packyapi", tier: "standard", progress: "正在处理图片" }];
  }

  const standardPlan = [
    { provider: "rightcode", tier: "standard", progress: "正在生成图片" },
    { provider: "wuyinkeji", tier: "standard", progress: "正在生成图片" },
    { provider: "packyapi", tier: "standard", progress: "正在生成图片" },
    { provider: "gptsapi", tier: "standard", progress: "正在生成图片" },
  ];

  return standardPlan;
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
  if (key.provider === "gptsapi") {
    return requestGptsapi({ key, requestBody, fetchImpl });
  }

  if (key.provider === "wuyinkeji") {
    return requestWuyinkeji({ key, requestBody, fetchImpl });
  }

  return requestOpenAICompatible({ key, requestBody, env, fetchImpl });
}

async function requestOpenAICompatible({ key, requestBody, env, fetchImpl }) {
  if (shouldUsePackyTemplateEdit(key.provider, requestBody)) {
    return requestPackyTemplateEdit({ key, requestBody, env, fetchImpl });
  }

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

async function requestPackyTemplateEdit({ key, requestBody, env, fetchImpl }) {
  const model = env.PACKYAPI_IMAGE_MODEL?.trim() || defaultModel;
  const form = new FormData();
  const imageInputs = [
    sourceImageInputFromRequest(requestBody),
    ...templateImageInputsFromRequest(requestBody),
  ].filter(Boolean);

  form.set("model", model);
  form.set("prompt", String(requestBody.prompt ?? ""));
  form.set("n", "1");
  form.set("size", packyApiEditSize(requestBody.size));
  form.set("quality", isHdRequest(requestBody) ? "high" : "medium");
  form.set("output_format", "png");
  if (supportsResponseFormat(key.provider, model)) {
    form.set("response_format", "url");
  }

  for (const [index, input] of imageInputs.entries()) {
    const file = await imageInputToBlob(String(input), fetchImpl);
    if (!file) {
      return {
        error: `input_image_upload_failed: image ${index + 1} could not be prepared for PackyAPI`,
      };
    }
    form.append("image", file, `image_${index + 1}.${extensionFromContentType(file.type)}`);
  }

  const response = await fetchImpl(`${key.baseUrl}/images/edits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key.apiKey}`,
      Accept: "*/*",
    },
    body: form,
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    return {
      error: providerError(response.status, data),
    };
  }

  return imageResultFromOpenAI(data);
}

function shouldUsePackyTemplateEdit(provider, requestBody) {
  return (
    provider === "packyapi" &&
    Boolean(requestBody.use_template_mode) &&
    Boolean(sourceImageInputFromRequest(requestBody)) &&
    templateImageInputsFromRequest(requestBody).length > 0
  );
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
  };
  if (supportsResponseFormat(provider, model)) {
    payload.response_format = "url";
  }
  const images = imageInputsFromRequest(requestBody);
  if (images.length > 0) {
    payload.image = images;
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

function supportsResponseFormat(provider, model) {
  return !(provider === "packyapi" && model === "gpt-image-2");
}

function imageInputsFromRequest(requestBody) {
  return [
    sourceImageInputFromRequest(requestBody),
    ...templateImageInputsFromRequest(requestBody),
  ]
    .filter(Boolean)
    .map(String)
    .filter((image, index, images) => images.indexOf(image) === index);
}

function sourceImageInputFromRequest(requestBody) {
  return requestBody.image_url || requestBody.image_base64 || "";
}

function templateImageInputsFromRequest(requestBody) {
  return [
    requestBody.template_image_base64,
    ...(Array.isArray(requestBody.template_image_base64s)
      ? requestBody.template_image_base64s
      : []),
  ]
    .filter(Boolean)
    .map(String)
    .filter((image, index, images) => images.indexOf(image) === index);
}

async function imageInputToBlob(input, fetchImpl) {
  const value = String(input ?? "").trim();

  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const response = await fetchImpl(value, { method: "GET" });
      if (!response.ok) {
        return null;
      }
      const contentType = normalizeImageContentType(
        response.headers?.get?.("Content-Type"),
      );
      const buffer = await response.arrayBuffer();
      return new Blob([buffer], { type: contentType });
    } catch {
      return null;
    }
  }

  const dataUrlMatch = value.match(/^data:([^;,]+)?;base64,(.*)$/is);
  const contentType = normalizeImageContentType(dataUrlMatch?.[1]);
  const rawBase64 = (dataUrlMatch?.[2] ?? value).replace(/\s/g, "");

  try {
    const bytes = Buffer.from(rawBase64, "base64");
    if (bytes.length === 0) {
      return null;
    }
    return new Blob([bytes], { type: contentType });
  } catch {
    return null;
  }
}

function normalizeImageContentType(value) {
  const contentType = String(value ?? "").split(";")[0].trim().toLowerCase();
  return contentType.startsWith("image/") ? contentType : "image/png";
}

function extensionFromContentType(contentType) {
  const normalized = normalizeImageContentType(contentType);
  if (normalized === "image/jpeg" || normalized === "image/jpg") {
    return "jpg";
  }
  if (normalized === "image/webp") {
    return "webp";
  }
  return "png";
}

function packyApiEditSize(size) {
  const value = normalizeSize(size);
  const [rawWidth, rawHeight] = value
    .split("x")
    .map((part) => Number.parseInt(part, 10));

  if (!rawWidth || !rawHeight) {
    return value;
  }

  const shortEdge = Math.min(rawWidth, rawHeight);
  const scale = Math.max(1, 768 / shortEdge);
  const width = Math.ceil((rawWidth * scale) / 16) * 16;
  const height = Math.ceil((rawHeight * scale) / 16) * 16;

  return clampImageSize(`${width}x${height}`);
}

function clampImageSize(size) {
  const [rawWidth, rawHeight] = normalizeSize(size)
    .split("x")
    .map((part) => Number.parseInt(part, 10));
  const maxEdge = Math.max(rawWidth, rawHeight);
  const maxPixels = 3840 * 2160;

  if (!rawWidth || !rawHeight || (maxEdge <= 3840 && rawWidth * rawHeight <= maxPixels)) {
    return `${rawWidth}x${rawHeight}`;
  }

  const scale = Math.min(
    3840 / maxEdge,
    Math.sqrt(maxPixels / (rawWidth * rawHeight)),
  );

  return `${Math.floor(rawWidth * scale)}x${Math.floor(rawHeight * scale)}`;
}

async function requestGptsapi({ key, requestBody, fetchImpl }) {
  const baseUrl = gptsapiBaseUrl(key.baseUrl);
  const response = await fetchImpl(`${baseUrl}/gpt-image-2/text-to-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildGptsapiPayload(requestBody)),
  });
  const created = await parseJsonResponse(response);

  if (!response.ok) {
    return { error: providerError(response.status, created) };
  }

  const pollUrl = created?.data?.urls?.get ?? created?.urls?.get ?? "";
  if (!pollUrl) {
    return { error: "gptsapi_missing_poll_url" };
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const poll = await fetchImpl(pollUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key.apiKey}`,
        "Content-Type": "application/json",
      },
    });
    const pollData = await parseJsonResponse(poll);

    if (!poll.ok) {
      if (attempt < 59) {
        await wait(5000);
        continue;
      }
      return { error: providerError(poll.status, pollData) };
    }

    const status = pollData?.data?.status ?? pollData?.status ?? "";
    if (status === "completed") {
      const outputs = pollData?.data?.outputs ?? pollData?.outputs ?? [];
      const image = Array.isArray(outputs) ? outputs[0] : outputs;
      return normalizeGptsapiResult(image);
    }

    if (status === "failed" || status === "canceled") {
      return { error: `gptsapi_status_${status}` };
    }

    await wait(5000);
  }

  return { error: "gptsapi_timeout" };
}

function buildGptsapiPayload(requestBody) {
  const images = imageInputsFromRequest(requestBody);
  const payload = {
    prompt: String(requestBody.prompt ?? ""),
    aspect_ratio: sizeToSupportedGptsapiRatio(requestBody.size),
    output_format: "png",
  };

  if (images.length === 1) {
    payload.image = images[0];
  } else if (images.length > 1) {
    payload.image = images;
  }

  return payload;
}

function normalizeGptsapiResult(image) {
  if (!image) {
    return { error: "gptsapi_missing_image_result" };
  }

  return String(image).startsWith("http")
    ? { image_url: String(image) }
    : { image_base64: String(image).startsWith("data:") ? String(image) : `data:image/png;base64,${image}` };
}

async function requestWuyinkeji({ key, requestBody, fetchImpl }) {
  const createUrl = wuyinkejiCreateUrl(key.baseUrl, requestBody);
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
        .concat(Array.isArray(requestBody.template_image_base64s) ? requestBody.template_image_base64s : [])
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

    await wait(5000);
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

function hasProviderImage(result) {
  return Boolean(result?.image_url || result?.image_base64);
}

function validateProviderImageResult(result) {
  if (!hasProviderImage(result)) {
    return result;
  }

  if (result.image_base64 && !isValidInlineImage(result.image_base64)) {
    return { error: "invalid_image_result" };
  }

  return result;
}

function isValidInlineImage(image) {
  const decoded = decodeInlineImage(image);
  if (!decoded) {
    return false;
  }

  return (
    isValidPng(decoded) ||
    isValidJpeg(decoded) ||
    isValidWebp(decoded)
  );
}

function decodeInlineImage(image) {
  const text = String(image ?? "").trim();
  if (!text) {
    return null;
  }

  const dataUrlMatch = text.match(/^data:[^,]*;base64,(.*)$/is);
  const rawBase64 = (dataUrlMatch?.[1] ?? text).replace(/\s/g, "");
  if (!rawBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(rawBase64)) {
    return null;
  }

  try {
    const buffer = Buffer.from(rawBase64, "base64");
    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  }
}

function isValidPng(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const iend = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  return (
    startsWithBytes(buffer, signature) &&
    endsWithBytes(buffer, iend)
  );
}

function isValidJpeg(buffer) {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[buffer.length - 2] === 0xff &&
    buffer[buffer.length - 1] === 0xd9
  );
}

function isValidWebp(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function startsWithBytes(buffer, bytes) {
  if (buffer.length < bytes.length) {
    return false;
  }

  return bytes.every((byte, index) => buffer[index] === byte);
}

function endsWithBytes(buffer, bytes) {
  if (buffer.length < bytes.length) {
    return false;
  }

  const start = buffer.length - bytes.length;
  return bytes.every((byte, index) => buffer[start + index] === byte);
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

function gptsapiBaseUrl(baseUrl) {
  const normalized = String(baseUrl || "https://api.gptsapi.net/api/v3/openai")
    .trim()
    .replace(/\/+$/, "");

  if (/\/gpt-image-2\/text-to-image$/i.test(normalized)) {
    return normalized.replace(/\/gpt-image-2\/text-to-image$/i, "");
  }

  if (/\/images\/generations$/i.test(normalized)) {
    return normalized.replace(/\/images\/generations$/i, "");
  }

  return normalized;
}

function sizeToSupportedGptsapiRatio(size) {
  const supported = [
    [1, 1],
    [4, 5],
    [5, 4],
    [3, 4],
    [4, 3],
    [2, 3],
    [3, 2],
    [9, 16],
    [16, 9],
    [1, 2],
    [2, 1],
    [9, 21],
    [21, 9],
  ];
  const value = normalizeSize(size);
  const [width, height] = value.split("x").map((part) => Number.parseInt(part, 10));

  if (!width || !height) {
    return "1:1";
  }

  const ratio = width / height;
  const nearest = supported
    .map(([left, right]) => ({
      left,
      right,
      distance: Math.abs(Math.log(ratio / (left / right))),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  return `${nearest.left}:${nearest.right}`;
}

function gcd(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function wuyinkejiCreateUrl(baseUrl, requestBody) {
  const normalized = baseUrl.replace(/\/+$/, "");
  const endpoint = isHdRequest(requestBody) ? "image_nanoBanana2" : "image_gpt";

  if (/\/api\/async\/(image_gpt|image_nanoBanana2)$/i.test(normalized)) {
    return normalized.replace(/\/api\/async\/(image_gpt|image_nanoBanana2)$/i, `/api/async/${endpoint}`);
  }

  if (/\/api\/async\/detail$/i.test(normalized)) {
    return normalized.replace(/\/api\/async\/detail$/i, `/api/async/${endpoint}`);
  }

  if (/\/api\/async$/i.test(normalized)) {
    return `${normalized}/${endpoint}`;
  }

  return `${normalized}/api/async/${endpoint}`;
}

function wuyinkejiDetailUrl(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, "");

  if (/\/api\/async\/(image_gpt|image_nanoBanana2|detail)$/i.test(normalized)) {
    return normalized.replace(/\/api\/async\/(image_gpt|image_nanoBanana2|detail)$/i, "/api/async/detail");
  }

  if (/\/api\/async$/i.test(normalized)) {
    return `${normalized}/detail`;
  }

  return `${normalized}/api/async/detail`;
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
