import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import {
  createImageRouter,
  hasConfiguredImageProviders,
} from "./image-router.mjs";

const defaultFreeCredits = 5;
const defaultSender = "kroma <no-reply@i18.pro>";

export function createWebBackend({
  env = process.env,
  fetch: fetchImpl = globalThis.fetch,
} = {}) {
  const imageRouter = createImageRouter({ env, fetch: fetchImpl });
  return {
    handle: (request) => handleRequest(request, env, fetchImpl, imageRouter),
  };
}

export function isAllowedAuthRedirect(value, env = process.env) {
  if (!value) return false;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return false;
  }

  const allowed = parseAllowedRedirects(env);
  return allowed.has(parsed.origin);
}

async function handleRequest(request, env, fetchImpl, imageRouter) {
  if (request.method === "OPTIONS") {
    return emptyResponse(204);
  }

  const url = new URL(request.url);

  try {
    if (url.pathname === "/api/v1/health") {
      return jsonResponse(await buildHealthResponse(env, fetchImpl));
    }

    if (url.pathname === "/api/v1/auth/signup" && request.method === "POST") {
      return await handleSignup(request, env, fetchImpl);
    }

    if (url.pathname === "/api/v1/auth/login" && request.method === "POST") {
      return await handleLogin(request, env, fetchImpl);
    }

    if (url.pathname === "/api/v1/auth/otp" && request.method === "POST") {
      return await handleOtp(request, env, fetchImpl);
    }

    if (url.pathname === "/api/v1/auth/verify-code" && request.method === "POST") {
      return await handleVerify(request, env, fetchImpl, "magiclink");
    }

    if (url.pathname === "/api/v1/auth/verify-signup" && request.method === "POST") {
      return await handleVerify(request, env, fetchImpl, "signup");
    }

    if (url.pathname === "/api/v1/auth/refresh" && request.method === "POST") {
      return await handleRefresh(request, env, fetchImpl);
    }

    if (url.pathname === "/api/v1/user/credits" && request.method === "GET") {
      return await handleGetCredits(request, env, fetchImpl);
    }

    if (url.pathname === "/api/v1/user/credits/deduct" && request.method === "POST") {
      return await handleDeductCredits(request, url, env, fetchImpl);
    }

    if (url.pathname === "/api/v1/user/credits/add" && request.method === "POST") {
      return await handleAddCredits(request, url, env, fetchImpl);
    }

    if (url.pathname === "/api/v1/generations" && request.method === "GET") {
      return await handleListGenerations(request, url, env, fetchImpl);
    }

    if (url.pathname === "/api/v1/generations" && request.method === "POST") {
      return await handleSaveGeneration(request, env, fetchImpl);
    }

    if (url.pathname === "/api/v1/billing/paddle/webhook" && request.method === "POST") {
      return await handlePaddleWebhook(request, env, fetchImpl);
    }

    if (url.pathname === "/api/v1/image/generate" && request.method === "POST") {
      if (imageRouter.hasProviders()) {
        return await handleImageGenerate(request, env, fetchImpl, imageRouter);
      }
      return await handleImageProxy(request, env, fetchImpl, "/image/generate", "POST");
    }

    if (
      url.pathname.startsWith("/api/v1/image/task/") &&
      url.pathname.endsWith("/cancel") &&
      request.method === "POST"
    ) {
      const taskId = url.pathname
        .replace("/api/v1/image/task/", "")
        .replace(/\/cancel$/, "");
      if (imageRouter.get(taskId)) {
        await requireAuthUser(request, env, fetchImpl);
        return jsonResponse({ canceled: imageRouter.cancel(taskId) });
      }
      return await handleImageProxy(
        request,
        env,
        fetchImpl,
        `/image/task/${encodeURIComponent(taskId)}/cancel`,
        "POST",
      );
    }

    if (url.pathname.startsWith("/api/v1/image/task/") && request.method === "GET") {
      const taskId = url.pathname.replace("/api/v1/image/task/", "");
      const task = imageRouter.get(taskId);
      if (task) {
        await requireAuthUser(request, env, fetchImpl);
        return jsonResponse(imageRouter.response(task));
      }
      return await handleImageProxy(
        request,
        env,
        fetchImpl,
        `/image/task/${encodeURIComponent(taskId)}`,
        "GET",
      );
    }

    return jsonResponse({ detail: "Not found" }, 404);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.body, error.status);
    }
    return jsonResponse({ detail: error?.message ?? "Internal Server Error" }, 500);
  }
}

async function handleImageGenerate(request, env, fetchImpl, imageRouter) {
  const authUser = await requireAuthUser(request, env, fetchImpl);
  const body = await readJsonBody(request);
  return jsonResponse(await imageRouter.submit(body, authUser));
}

async function handleSignup(request, env, fetchImpl) {
  const body = await readJsonBody(request);
  const redirectTo = body.redirect_to || env.WEB_AUTH_REDIRECT_URL;
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");

  if (redirectTo && !isAllowedAuthRedirect(redirectTo, env)) {
    throw new HttpError(400, { detail: "Invalid auth redirect URL" });
  }

  if (!password) {
    throw new HttpError(422, { detail: "Password is required" });
  }

  await ensureEmailIsNotRegistered(fetchImpl, env, email);

  let data;
  try {
    data = await supabaseAdmin(fetchImpl, env, "users", {
      email,
      password,
      email_confirm: false,
      user_metadata: {
        source: "kroma-web",
      },
    });
  } catch (error) {
    if (isRegisteredEmailError(error)) {
      const pendingSignupUserId = await findPendingSignupUserId(fetchImpl, env, email);
      if (pendingSignupUserId) {
        return await sendSignupVerificationCode(fetchImpl, env, {
          email,
          userId: pendingSignupUserId,
        });
      }

      throw registeredEmailError();
    }

    throw error;
  }
  const userId = data?.id ?? data?.user?.id;
  if (!userId) {
    throw new HttpError(500, { detail: "Signup user was not created" });
  }

  return await sendSignupVerificationCode(fetchImpl, env, { email, userId });
}

async function sendSignupVerificationCode(fetchImpl, env, input) {
  const code = createSixDigitCode();
  await storeAuthCode(fetchImpl, env, {
    email: input.email,
    type: "signup",
    code,
    providerToken: input.userId,
  });

  await sendAuthCodeEmail(fetchImpl, env, {
    email: input.email,
    code,
    subject: "kroma 注册验证码",
    title: "kroma 注册验证码",
    intro: "你正在注册 kroma 网页端账号。",
    action: "请在注册页面输入下面的 6 位验证码完成注册：",
  });

  return tokenResponse({});
}

async function handleLogin(request, env, fetchImpl) {
  const body = await readJsonBody(request);
  const data = await supabaseAuth(fetchImpl, env, "token?grant_type=password", {
    email: normalizeEmail(body.email),
    password: String(body.password ?? ""),
  });

  return tokenResponse(data);
}

async function handleOtp(request, env, fetchImpl) {
  const body = await readJsonBody(request);
  const redirectTo = body.redirect_to;
  const email = normalizeEmail(body.email);

  if (redirectTo && !isAllowedAuthRedirect(redirectTo, env)) {
    throw new HttpError(400, { detail: "Invalid auth redirect URL" });
  }

  const data = await supabaseAdmin(fetchImpl, env, "generate_link", {
    type: "magiclink",
    email,
    ...(redirectTo ? { redirect_to: redirectTo } : {}),
  });

  const providerToken = data?.email_otp ?? data?.properties?.email_otp;
  if (!providerToken) {
    throw new HttpError(500, { detail: "Login code was not generated" });
  }
  const code = createSixDigitCode();
  await storeAuthCode(fetchImpl, env, {
    email,
    type: "magiclink",
    code,
    providerToken,
  });

  await sendAuthCodeEmail(fetchImpl, env, {
    email,
    code,
    subject: "kroma 登录验证码",
    title: "kroma 登录验证码",
    intro: "你正在登录 kroma 网页端账号。",
    action: "请在登录页面输入下面的 6 位验证码：",
  });

  return jsonResponse({ sent: true });
}

async function handleVerify(request, env, fetchImpl, type) {
  const body = await readJsonBody(request);
  const email = normalizeEmail(body.email);
  const token = await resolveAuthToken(fetchImpl, env, {
    email,
    type,
    code: String(body.token ?? ""),
  });
  if (type === "signup") {
    const data = await confirmSignupUser(fetchImpl, env, token);
    return tokenResponse({ user: { id: data?.id ?? token } });
  }
  const data = await supabaseAuth(fetchImpl, env, "verify", {
    email,
    token,
    type,
  });

  return tokenResponse(data);
}

function createSixDigitCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashAuthCode(env, email, type, code) {
  const secret =
    env.WEB_AUTH_CODE_SECRET ||
    env.WEB_SUPABASE_SERVICE_ROLE_KEY ||
    env.WEB_RESEND_API_KEY ||
    "kroma-web-auth-code-development-secret";

  return createHmac("sha256", secret)
    .update(`${normalizeEmail(email)}:${String(type)}:${String(code)}`)
    .digest("hex");
}

async function storeAuthCode(fetchImpl, env, input) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await restFetch(fetchImpl, env, "/web_auth_codes", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      email: input.email,
      type: input.type,
      code: hashAuthCode(env, input.email, input.type, input.code),
      provider_token: input.providerToken,
      expires_at: expiresAt,
    },
  });
}

async function resolveAuthToken(fetchImpl, env, input) {
  let rows = await fetchAuthCodeRows(fetchImpl, env, {
    ...input,
    code: hashAuthCode(env, input.email, input.type, input.code),
  });

  if (
    (!Array.isArray(rows) || rows.length === 0) &&
    /^\d{6}$/.test(input.code)
  ) {
    rows = await fetchAuthCodeRows(fetchImpl, env, input);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new HttpError(422, { detail: "Invalid or expired verification code" });
  }

  const row = rows[0];
  await restFetch(fetchImpl, env, `/web_auth_codes?id=eq.${encodeURIComponent(row.id)}`, {
    method: "DELETE",
  });
  return String(row.provider_token);
}

async function fetchAuthCodeRows(fetchImpl, env, input) {
  return restFetch(
    fetchImpl,
    env,
    `/web_auth_codes?email=eq.${encodeURIComponent(input.email)}&type=eq.${encodeURIComponent(input.type)}&code=eq.${encodeURIComponent(input.code)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,provider_token&order=created_at.desc&limit=1`,
  );
}

async function findPendingSignupUserId(fetchImpl, env, email) {
  const rows = await restFetch(
    fetchImpl,
    env,
    `/web_auth_codes?email=eq.${encodeURIComponent(email)}&type=eq.signup&select=provider_token&order=created_at.desc&limit=1`,
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0]?.provider_token ? String(rows[0].provider_token) : null;
}

async function ensureEmailIsNotRegistered(fetchImpl, env, email) {
  const rows = await restFetch(
    fetchImpl,
    env,
    `/web_users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
  );

  if (Array.isArray(rows) && rows.length > 0) {
    throw registeredEmailError();
  }
}

function registeredEmailError() {
  return new HttpError(409, {
    detail: {
      code: "email_already_registered",
      message: "该邮箱已注册，请直接登录。",
    },
  });
}

function isRegisteredEmailError(error) {
  if (!(error instanceof HttpError)) {
    return false;
  }

  const detail = String(error.body?.detail ?? error.message ?? "").toLowerCase();
  return (
    error.status === 422 &&
    (detail.includes("already") ||
      detail.includes("registered") ||
      detail.includes("exists"))
  );
}

async function handleRefresh(request, env, fetchImpl) {
  const body = await readJsonBody(request);
  const data = await supabaseAuth(fetchImpl, env, "token?grant_type=refresh_token", {
    refresh_token: String(body.refresh_token ?? ""),
  });

  return tokenResponse(data);
}

async function handleGetCredits(request, env, fetchImpl) {
  const authUser = await requireAuthUser(request, env, fetchImpl);
  const user = await getOrCreateWebUser(fetchImpl, env, authUser);

  return jsonResponse({
    credits: user.credits,
    is_paid: user.plan !== "free",
    plan: user.plan,
  });
}

async function handleDeductCredits(request, url, env, fetchImpl) {
  const authUser = await requireAuthUser(request, env, fetchImpl);
  const user = await getOrCreateWebUser(fetchImpl, env, authUser);
  const amount = Math.max(0, Number.parseInt(url.searchParams.get("amount") ?? "1", 10));
  const taskStatus = (url.searchParams.get("task_status") ?? "completed").toLowerCase();
  const chargePolicy = (url.searchParams.get("charge_policy") ?? "success_only").toLowerCase();
  const successStatuses = new Set(["completed", "success", "done"]);

  if (chargePolicy === "success_only" && !successStatuses.has(taskStatus)) {
    return jsonResponse({
      success: false,
      charged: false,
      credits_remaining: user.credits,
    });
  }

  if (user.credits < amount) {
    throw new HttpError(402, {
      detail: `Insufficient credits (${user.credits} < ${amount})`,
    });
  }

  const credits = user.credits - amount;
  await updateWebUserCredits(fetchImpl, env, user.id, credits);
  await createCreditTransaction(fetchImpl, env, {
    user_id: user.id,
    amount: -amount,
    type: "generation",
    description: "Web image generation",
  });

  return jsonResponse({
    success: true,
    charged: true,
    credits_remaining: credits,
  });
}

async function handleAddCredits(request, url, env, fetchImpl) {
  requireInternalBillingAccess(request, env);
  const authUser = await requireAuthUser(request, env, fetchImpl);
  const user = await getOrCreateWebUser(fetchImpl, env, authUser);
  const amount = Math.max(0, Number.parseInt(url.searchParams.get("amount") ?? "0", 10));
  const credits = user.credits + amount;
  await updateWebUserCredits(fetchImpl, env, user.id, credits);
  await createCreditTransaction(fetchImpl, env, {
    user_id: user.id,
    amount,
    type: "purchase",
    description: "Web credit top-up",
  });

  return jsonResponse({
    success: true,
    credits_remaining: credits,
  });
}

async function handleSaveGeneration(request, env, fetchImpl) {
  const authUser = await requireAuthUser(request, env, fetchImpl);
  const user = await getOrCreateWebUser(fetchImpl, env, authUser);
  const body = await readJsonBody(request);
  const task = normalizeGenerationTaskInput(body?.task ?? body);
  const durableTask = await persistGenerationResultImages(
    fetchImpl,
    env,
    task,
    user.id,
  );
  const row = buildGenerationHistoryRow(durableTask, user.id);

  const savedRows = await restFetch(
    fetchImpl,
    env,
    "/web_generations?on_conflict=user_id,task_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: row,
    },
  );

  return jsonResponse({
    saved: true,
    task: normalizeGenerationHistoryRow(
      Array.isArray(savedRows) && savedRows[0] ? savedRows[0] : { task: durableTask },
    ),
  });
}

async function handleListGenerations(request, url, env, fetchImpl) {
  const authUser = await requireAuthUser(request, env, fetchImpl);
  const user = await getOrCreateWebUser(fetchImpl, env, authUser);
  const limit = clampHistoryLimit(url.searchParams.get("limit"));
  const rows = await restFetch(
    fetchImpl,
    env,
    `/web_generations?user_id=eq.${encodeURIComponent(user.id)}&select=task,task_id,status,product,config,result_urls,result_assets,credits_cost,error_message,created_at,completed_at,attempt,backend_task_id,backend_task_ids,input_image_url,result_image_url,module&order=created_at.desc&limit=${limit}`,
  );

  return jsonResponse(
    Array.isArray(rows) ? rows.map(normalizeGenerationHistoryRow) : [],
  );
}

function normalizeGenerationTaskInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(422, { detail: "Generation task body is required" });
  }

  if (!value.id || typeof value.id !== "string") {
    throw new HttpError(422, { detail: "Generation task id is required" });
  }

  if (!value.productInput || typeof value.productInput !== "object") {
    throw new HttpError(422, { detail: "Generation task productInput is required" });
  }

  if (!value.config || typeof value.config !== "object") {
    throw new HttpError(422, { detail: "Generation task config is required" });
  }

  return value;
}

function buildGenerationHistoryRow(task, userId) {
  const resultUrls = Array.isArray(task.resultUrls) ? task.resultUrls : [];
  const resultAssets = Array.isArray(task.resultAssets) ? task.resultAssets : [];
  const backendTaskIds = Array.isArray(task.backendTaskIds) ? task.backendTaskIds : [];

  return {
    task_id: task.id,
    user_id: userId,
    status: String(task.status ?? "completed"),
    module: stringOrNull(task.config?.module),
    input_image_url: stringOrNull(task.productInput?.imageUrl),
    result_image_url: stringOrNull(resultUrls[0]),
    credits_cost: numberOrZero(task.creditCost),
    error_message: stringOrNull(task.errorMessage),
    task,
    product: task.productInput,
    config: task.config,
    result_urls: resultUrls,
    result_assets: resultAssets,
    backend_task_id: stringOrNull(task.backendTaskId),
    backend_task_ids: backendTaskIds,
    completed_at: stringOrNull(task.completedAt),
    attempt: Number.isFinite(Number(task.attempt)) ? Number(task.attempt) : 1,
    created_at: stringOrNull(task.createdAt) ?? new Date().toISOString(),
  };
}

function normalizeGenerationHistoryRow(row) {
  if (row?.task && typeof row.task === "object" && !Array.isArray(row.task)) {
    return row.task;
  }

  const resultUrls = Array.isArray(row?.result_urls)
    ? row.result_urls.filter((url) => typeof url === "string")
    : row?.result_image_url
      ? [String(row.result_image_url)]
      : [];
  const resultAssets = Array.isArray(row?.result_assets)
    ? row.result_assets.filter(
        (asset) =>
          asset &&
          typeof asset === "object" &&
          typeof asset.url === "string" &&
          typeof asset.label === "string",
      )
    : undefined;
  const productInput =
    row?.product && typeof row.product === "object" && !Array.isArray(row.product)
      ? row.product
      : {
          id: `product-${row?.task_id ?? row?.id ?? "history"}`,
          imageUrl: String(row?.input_image_url ?? ""),
          fileName: "history-product.png",
          createdAt: row?.created_at ?? new Date().toISOString(),
          source: "upload",
        };
  const config =
    row?.config && typeof row.config === "object" && !Array.isArray(row.config)
      ? row.config
      : {
          module: String(row?.module ?? "main_image"),
          platform: "shopify",
          aspectRatio: "1:1",
          style: "premium",
          outputFormat: "png",
          sellingPoints: "",
          specifications: "",
          resolution: "1K",
        };

  return {
    id: String(row?.task_id ?? row?.id ?? `history-${Date.now()}`),
    productInput,
    config,
    status: String(row?.status ?? "completed"),
    resultUrls,
    ...(resultAssets && resultAssets.length > 0 ? { resultAssets } : {}),
    ...(row?.backend_task_id ? { backendTaskId: String(row.backend_task_id) } : {}),
    ...(Array.isArray(row?.backend_task_ids) && row.backend_task_ids.length > 0
      ? { backendTaskIds: row.backend_task_ids.filter((taskId) => typeof taskId === "string") }
      : {}),
    ...(row?.error_message ? { errorMessage: String(row.error_message) } : {}),
    creditCost: numberOrZero(row?.credits_cost),
    createdAt: String(row?.created_at ?? new Date().toISOString()),
    ...(row?.completed_at ? { completedAt: String(row.completed_at) } : {}),
    attempt: Number.isFinite(Number(row?.attempt)) ? Number(row.attempt) : 1,
  };
}

function stringOrNull(value) {
  return typeof value === "string" && value ? value : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clampHistoryLimit(value) {
  const number = Number.parseInt(String(value ?? "100"), 10);

  if (!Number.isFinite(number)) {
    return 100;
  }

  return Math.min(200, Math.max(1, number));
}

async function persistGenerationResultImages(fetchImpl, env, task, userId) {
  const bucket = env.WEB_GENERATION_STORAGE_BUCKET?.trim();

  if (!bucket || !Array.isArray(task.resultUrls) || task.resultUrls.length === 0) {
    return task;
  }

  const copiedUrls = await Promise.all(
    task.resultUrls.map((url, index) =>
      copyGenerationResultImage(fetchImpl, env, {
        bucket,
        userId,
        taskId: task.id,
        index,
        url,
      }),
    ),
  );

  if (copiedUrls.every((url, index) => url === task.resultUrls[index])) {
    return task;
  }

  const replacements = new Map(
    task.resultUrls.map((url, index) => [url, copiedUrls[index]]),
  );
  const resultAssets = Array.isArray(task.resultAssets)
    ? task.resultAssets.map((asset) => ({
        ...asset,
        url: replacements.get(asset.url) ?? asset.url,
      }))
    : undefined;

  return {
    ...task,
    resultUrls: copiedUrls,
    ...(resultAssets ? { resultAssets } : {}),
  };
}

async function copyGenerationResultImage(fetchImpl, env, input) {
  if (isSupabasePublicStorageUrl(env, input.bucket, input.url)) {
    return input.url;
  }

  try {
    const image = await readImageForStorage(fetchImpl, input.url);
    const objectPath = [
      sanitizeStoragePathSegment(input.userId),
      sanitizeStoragePathSegment(input.taskId),
      `${input.index + 1}.${image.extension}`,
    ].join("/");
    const response = await fetchImpl(
      `${supabaseUrl(env)}/storage/v1/object/${encodeURIComponent(input.bucket)}/${objectPath}`,
      {
        method: "PUT",
        headers: {
          apikey: env.WEB_SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.WEB_SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": image.contentType,
          "x-upsert": "true",
        },
        body: new Blob([image.buffer], { type: image.contentType }),
      },
    );

    await parseSupabaseResponse(response);

    return `${supabaseUrl(env)}/storage/v1/object/public/${encodeURIComponent(input.bucket)}/${objectPath}`;
  } catch {
    return input.url;
  }
}

async function readImageForStorage(fetchImpl, url) {
  if (url.startsWith("data:")) {
    return parseDataUrlImage(url);
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("Unsupported image URL");
  }

  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error("Image result could not be fetched");
  }

  const contentType = normalizeImageContentType(response.headers.get("Content-Type"));
  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    buffer,
    contentType,
    extension: imageExtension(contentType, url),
  };
}

function parseDataUrlImage(url) {
  const match = url.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);

  if (!match) {
    throw new Error("Invalid data URL image");
  }

  const contentType = normalizeImageContentType(match[1]);
  const buffer = match[2]
    ? Buffer.from(match[3], "base64")
    : Buffer.from(decodeURIComponent(match[3]));

  return {
    buffer,
    contentType,
    extension: imageExtension(contentType, ""),
  };
}

function normalizeImageContentType(value) {
  const contentType = String(value ?? "image/png").split(";")[0].trim().toLowerCase();

  return ["image/png", "image/jpeg", "image/webp"].includes(contentType)
    ? contentType
    : "image/png";
}

function imageExtension(contentType, url) {
  if (contentType === "image/jpeg") {
    return "jpg";
  }

  if (contentType === "image/webp") {
    return "webp";
  }

  const extension = String(url).match(/\.(png|jpg|jpeg|webp)(?:\?|#|$)/i)?.[1];

  return extension ? extension.toLowerCase().replace("jpeg", "jpg") : "png";
}

function sanitizeStoragePathSegment(value) {
  return String(value ?? "item")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "item";
}

function isSupabasePublicStorageUrl(env, bucket, url) {
  return String(url).startsWith(
    `${supabaseUrl(env)}/storage/v1/object/public/${encodeURIComponent(bucket)}/`,
  );
}

async function handleImageProxy(request, env, fetchImpl, upstreamPath, method) {
  await requireAuthUser(request, env, fetchImpl);
  const baseUrl = env.WEB_IMAGE_API_BASE_URL?.replace(/\/+$/, "");

  if (!baseUrl) {
    throw new HttpError(501, {
      detail: "Web image generation upstream is not configured.",
    });
  }

  const proxyBody = method === "GET" ? undefined : await readOptionalJsonBody(request);
  const body = proxyBody === undefined ? undefined : JSON.stringify(proxyBody);
  const headers = {
    "Content-Type": "application/json",
    "X-Kroma-Client": "web-backend",
  };
  const imageApiKey = isMobileAppImageRouter(baseUrl)
    ? ""
    : env.WEB_IMAGE_API_KEY?.trim();

  if (imageApiKey) {
    headers.Authorization = `Bearer ${imageApiKey}`;
  }

  const response = await fetchImpl(`${baseUrl}${upstreamPath}`, {
    method,
    headers,
    body,
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { detail: response.ok ? "Empty image backend response" : "Image backend request failed" };
  }

  return jsonResponse(payload, response.status);
}

async function handlePaddleWebhook(request, env, fetchImpl) {
  const rawBody = await request.text();
  verifyPaddleWebhookSignature(rawBody, request.headers.get("paddle-signature"), env);

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new HttpError(422, { detail: "Invalid Paddle webhook JSON" });
  }

  const eventId = String(payload.event_id ?? payload.eventId ?? "");
  const eventType = String(payload.event_type ?? payload.eventType ?? "");

  if (!eventId) {
    throw new HttpError(422, { detail: "Missing Paddle event id" });
  }

  const reserved = await reserveBillingEvent(fetchImpl, env, {
    event_id: eventId,
    provider: "paddle",
    event_type: eventType,
    status: "received",
    payload,
  });

  if (!reserved) {
    const existingEvent = await getBillingEvent(fetchImpl, env, eventId);

    if (existingEvent?.status === "failed_retryable" || existingEvent?.status === "received") {
      await updateBillingEvent(fetchImpl, env, eventId, { status: "processing" });
    } else {
      return jsonResponse({
        received: true,
        duplicate: true,
        status: existingEvent?.status ?? "unknown",
      });
    }
  } else {
    await updateBillingEvent(fetchImpl, env, eventId, { status: "processing" });
  }

  if (eventType !== "transaction.completed") {
    await updateBillingEvent(fetchImpl, env, eventId, {
      status: "ignored",
    });
    return jsonResponse({ received: true, ignored: true });
  }

  const data = payload.data ?? {};
  const customData = data.custom_data ?? data.customData ?? {};
  const userId = String(customData.user_id ?? customData.userId ?? "");
  const fulfillment = resolvePaddleFulfillment(data, customData, env);
  const credits = fulfillment.credits;
  const planId = fulfillment.planId;
  const planName = fulfillment.planName;
  const transactionId = String(data.id ?? eventId);
  let creditMutationStarted = false;

  try {
    if (!userId || credits <= 0) {
      await updateBillingEvent(fetchImpl, env, eventId, {
        status: "rejected",
        reference_id: transactionId,
        user_id: userId || null,
        credits,
      });
      throw new HttpError(422, { detail: "Paddle webhook is missing user_id or credits" });
    }

    const user = await getWebUserById(fetchImpl, env, userId);
    if (!user) {
      await updateBillingEvent(fetchImpl, env, eventId, {
        status: "rejected",
        reference_id: transactionId,
        user_id: userId,
        credits,
      });
      throw new HttpError(422, { detail: "Paddle webhook user was not found" });
    }

    const nextCredits = user.credits + credits;
    creditMutationStarted = true;
    await updateWebUserCredits(fetchImpl, env, user.id, nextCredits);
    await createCreditTransaction(fetchImpl, env, {
      user_id: user.id,
      amount: credits,
      type: "purchase",
      description: planName ? `Paddle purchase: ${planName}` : "Paddle purchase",
      reference_id: transactionId,
    });
    await updateBillingEvent(fetchImpl, env, eventId, {
      status: "processed",
      reference_id: transactionId,
      user_id: user.id,
      credits,
    });

    return jsonResponse({
      received: true,
      credited: credits,
      credits_remaining: nextCredits,
    });
  } catch (error) {
    if (!(error instanceof HttpError && error.status >= 400 && error.status < 500)) {
      await updateBillingEvent(fetchImpl, env, eventId, {
        status: creditMutationStarted ? "needs_review" : "failed_retryable",
        reference_id: transactionId,
        user_id: userId || null,
        credits,
      });
    }

    throw error;
  }
}

function requireInternalBillingAccess(request, env) {
  const configuredKey = env.WEB_INTERNAL_BILLING_KEY?.trim();
  const providedKey = request.headers.get("x-kroma-billing-key")?.trim();

  if (!configuredKey || providedKey !== configuredKey) {
    throw new HttpError(403, { detail: "Credit top-up requires internal billing access" });
  }
}

function resolvePaddleFulfillment(data, customData, env) {
  const customCredits = Math.max(
    0,
    Number.parseInt(String(customData.credits ?? "0"), 10),
  );
  const customPlanId = String(customData.plan_id ?? customData.planId ?? "");
  const customPlanName = String(customData.plan_name ?? customData.planName ?? customPlanId);

  if (customCredits > 0) {
    return {
      credits: customCredits,
      planId: customPlanId,
      planName: customPlanName,
    };
  }

  const priceId = extractPaddlePriceId(data);
  const mapped = priceId ? parsePaddlePriceCreditMap(env)[priceId] : null;

  if (!mapped) {
    return {
      credits: 0,
      planId: customPlanId,
      planName: customPlanName,
    };
  }

  return {
    credits: Math.max(0, Number.parseInt(String(mapped.credits ?? "0"), 10)),
    planId: String(mapped.plan_id ?? mapped.planId ?? customPlanId),
    planName: String(mapped.plan_name ?? mapped.planName ?? mapped.plan_id ?? mapped.planId ?? customPlanName),
  };
}

function extractPaddlePriceId(data) {
  const items = Array.isArray(data?.items) ? data.items : [];

  for (const item of items) {
    const priceId = item?.price?.id ?? item?.price_id ?? item?.priceId;

    if (priceId) {
      return String(priceId);
    }
  }

  return "";
}

function parsePaddlePriceCreditMap(env) {
  const value = env.WEB_PADDLE_PRICE_CREDITS_JSON?.trim();

  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function hasValidPaddlePriceCreditMap(env) {
  return Object.values(parsePaddlePriceCreditMap(env)).some((entry) => {
    const credits = Number.parseInt(String(entry?.credits ?? "0"), 10);

    return Number.isFinite(credits) && credits > 0;
  });
}

function verifyPaddleWebhookSignature(rawBody, signatureHeader, env) {
  const secret = env.WEB_PADDLE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new HttpError(500, { detail: "WEB_PADDLE_WEBHOOK_SECRET is not configured" });
  }

  const signature = parsePaddleSignature(signatureHeader);
  if (!signature.ts || !signature.h1) {
    throw new HttpError(401, { detail: "Invalid Paddle webhook signature" });
  }

  const toleranceSeconds = Number.parseInt(
    env.WEB_PADDLE_SIGNATURE_TOLERANCE_SECONDS ?? "300",
    10,
  );
  const timestamp = Number.parseInt(signature.ts, 10);
  if (
    Number.isFinite(timestamp) &&
    Number.isFinite(toleranceSeconds) &&
    toleranceSeconds > 0 &&
    Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds
  ) {
    throw new HttpError(401, { detail: "Expired Paddle webhook signature" });
  }

  const expected = createHmac("sha256", secret)
    .update(`${signature.ts}:${rawBody}`)
    .digest("hex");

  if (!timingSafeHexEqual(expected, signature.h1)) {
    throw new HttpError(401, { detail: "Invalid Paddle webhook signature" });
  }
}

function parsePaddleSignature(value) {
  return String(value ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((parsed, part) => {
      const [key, ...rest] = part.split("=");
      return {
        ...parsed,
        [key]: rest.join("="),
      };
    }, {});
}

function timingSafeHexEqual(left, right) {
  const leftBuffer = Buffer.from(String(left), "hex");
  const rightBuffer = Buffer.from(String(right), "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function reserveBillingEvent(fetchImpl, env, body) {
  try {
    await restFetch(fetchImpl, env, "/web_billing_events", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body,
    });
    return true;
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      return false;
    }

    throw error;
  }
}

async function getBillingEvent(fetchImpl, env, eventId) {
  const rows = await restFetch(
    fetchImpl,
    env,
    `/web_billing_events?provider=eq.paddle&event_id=eq.${encodeURIComponent(eventId)}&select=status&limit=1`,
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return {
    status: String(rows[0].status ?? ""),
  };
}

async function updateBillingEvent(fetchImpl, env, eventId, body) {
  await restFetch(
    fetchImpl,
    env,
    `/web_billing_events?provider=eq.paddle&event_id=eq.${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body,
    },
  );
}

async function requireAuthUser(request, env, fetchImpl) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, { detail: "Missing bearer token" });
  }

  const response = await fetchImpl(`${supabaseUrl(env)}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: env.WEB_SUPABASE_ANON_KEY,
      Authorization: auth,
    },
  });
  const data = await parseSupabaseResponse(response);
  if (!data.id) {
    throw new HttpError(401, { detail: "Invalid auth user" });
  }
  return { id: String(data.id), email: normalizeEmail(data.email) };
}

async function getOrCreateWebUser(fetchImpl, env, authUser) {
  const existing = await getWebUserById(fetchImpl, env, authUser.id);
  if (existing) {
    return existing;
  }

  const created = await restFetch(fetchImpl, env, "/web_users", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      id: authUser.id,
      email: authUser.email,
      credits: defaultFreeCredits,
      plan: "free",
    },
  });

  return normalizeWebUser(Array.isArray(created) ? created[0] : created);
}

async function getWebUserById(fetchImpl, env, userId) {
  const rows = await restFetch(fetchImpl, env, `/web_users?id=eq.${encodeURIComponent(userId)}&select=*`);
  if (Array.isArray(rows) && rows.length > 0) {
    return normalizeWebUser(rows[0]);
  }

  return null;
}

async function updateWebUserCredits(fetchImpl, env, userId, credits) {
  await restFetch(fetchImpl, env, `/web_users?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: { credits },
  });
}

async function createCreditTransaction(fetchImpl, env, body) {
  await restFetch(fetchImpl, env, "/web_credit_transactions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body,
  });
}

async function supabaseAuth(fetchImpl, env, endpoint, body) {
  const response = await fetchImpl(`${supabaseUrl(env)}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: {
      apikey: env.WEB_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseSupabaseResponse(response);
}

async function supabaseAdmin(fetchImpl, env, endpoint, body, options = {}) {
  const response = await fetchImpl(`${supabaseUrl(env)}/auth/v1/admin/${endpoint}`, {
    method: options.method ?? "POST",
    headers: {
      apikey: env.WEB_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.WEB_SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseSupabaseResponse(response);
}

async function confirmSignupUser(fetchImpl, env, userId) {
  return supabaseAdmin(
    fetchImpl,
    env,
    `users/${encodeURIComponent(userId)}`,
    { email_confirm: true },
    { method: "PUT" },
  );
}

async function sendAuthCodeEmail(fetchImpl, env, input) {
  if (!env.WEB_RESEND_API_KEY) {
    throw new HttpError(500, { detail: "WEB_RESEND_API_KEY is not configured" });
  }

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WEB_RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.WEB_AUTH_EMAIL_FROM || defaultSender,
      to: [input.email],
      subject: input.subject,
      html: renderCodeEmail(input),
      text: `${input.title}\n\n${input.intro}\n${input.action}\n\n${input.code}\n\n验证码有效期有限，请勿转发给他人。如果不是你本人操作，可以忽略这封邮件。`,
    }),
  });

  await parseSupabaseResponse(response);
}

function renderCodeEmail(input) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.7;">
      <h2 style="margin: 0 0 16px;">${escapeHtml(input.title)}</h2>
      <p>${escapeHtml(input.intro)}</p>
      <p>${escapeHtml(input.action)}</p>
      <p style="font-size: 32px; line-height: 1.2; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">${escapeHtml(input.code)}</p>
      <p style="color: #6b7280;">验证码有效期有限，请勿转发给他人。如果不是你本人操作，可以忽略这封邮件。</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function restFetch(fetchImpl, env, path, options = {}) {
  const headers = {
    apikey: env.WEB_SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.WEB_SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  const response = await fetchImpl(`${supabaseUrl(env)}/rest/v1${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return parseSupabaseResponse(response);
}

async function parseSupabaseResponse(response) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new HttpError(response.status, {
      detail: data?.msg ?? data?.message ?? data?.error ?? "Supabase request failed",
    });
  }

  return data;
}

function tokenResponse(data) {
  return jsonResponse({
    access_token: data?.access_token ?? "",
    refresh_token: data?.refresh_token ?? "",
    user_id: data?.user?.id ?? "",
  });
}

function normalizeWebUser(row) {
  return {
    id: String(row.id),
    email: normalizeEmail(row.email),
    credits: Number.isFinite(Number(row.credits)) ? Number(row.credits) : defaultFreeCredits,
    plan: row.plan ? String(row.plan) : "free",
  };
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(422, { detail: "Invalid JSON body" });
  }
}

async function readOptionalJsonBody(request) {
  const text = await request.text();

  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(422, { detail: "Invalid JSON body" });
  }
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function supabaseUrl(env) {
  const value = env.WEB_SUPABASE_URL?.replace(/\/+$/, "");
  if (!value) {
    throw new HttpError(500, { detail: "WEB_SUPABASE_URL is not configured" });
  }
  return value;
}

function parseAllowedRedirects(env) {
  const configured = env.WEB_ALLOWED_AUTH_REDIRECTS || env.WEB_AUTH_REDIRECT_URL || "";
  return new Set(
    configured
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        try {
          return new URL(item).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );
}

async function buildHealthResponse(env, fetchImpl) {
  const optionalConfigKeys = new Set(["internalBillingKey", "authCodeSecret"]);
  const usesMobileAppImageRouter = isMobileAppImageRouter(
    env.WEB_IMAGE_API_BASE_URL,
  );
  const hasImageProviders = hasConfiguredImageProviders(env);
  const config = {
    supabaseUrl: Boolean(env.WEB_SUPABASE_URL),
    supabaseAnonKey: Boolean(env.WEB_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: Boolean(env.WEB_SUPABASE_SERVICE_ROLE_KEY),
    resendApiKey: Boolean(env.WEB_RESEND_API_KEY),
    authCodeSecret: Boolean(env.WEB_AUTH_CODE_SECRET),
    authEmailFrom: Boolean(env.WEB_AUTH_EMAIL_FROM),
    authRedirectUrl: Boolean(env.WEB_AUTH_REDIRECT_URL),
    allowedAuthRedirects: Boolean(env.WEB_ALLOWED_AUTH_REDIRECTS),
    internalBillingKey: Boolean(env.WEB_INTERNAL_BILLING_KEY),
    paddleWebhookSecret: Boolean(env.WEB_PADDLE_WEBHOOK_SECRET),
    paddlePriceCredits: hasValidPaddlePriceCreditMap(env),
    imageApiBaseUrl: Boolean(env.WEB_IMAGE_API_BASE_URL) || hasImageProviders,
    imageApiKey: Boolean(env.WEB_IMAGE_API_KEY) || usesMobileAppImageRouter || hasImageProviders,
  };
  const missing = Object.entries(config)
    .filter(([key, configured]) => !configured && !optionalConfigKeys.has(key))
    .map(([key]) => key);
  const optionalMissing = Object.entries(config)
    .filter(([key, configured]) => !configured && optionalConfigKeys.has(key))
    .map(([key]) => key);
  const database = await checkDatabaseHealth(fetchImpl, env, config);
  const databaseOk = Object.values(database).every(Boolean);

  return {
    ok: missing.length === 0 && databaseOk,
    service: "kroma-web-backend",
    commit: env.RENDER_GIT_COMMIT ?? env.GIT_COMMIT ?? "unknown",
    checked_at: new Date().toISOString(),
    config,
    database,
    missing,
    optionalMissing,
  };
}

function isMobileAppImageRouter(value) {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).hostname === "kroma-api.onrender.com";
  } catch {
    return false;
  }
}

async function checkDatabaseHealth(fetchImpl, env, config) {
  const tables = {
    webUsers: "/web_users?select=id&limit=1",
    webCreditTransactions: "/web_credit_transactions?select=id&limit=1",
    webGenerations: "/web_generations?select=id&limit=1",
    webAuthCodes: "/web_auth_codes?select=id&limit=1",
    webBillingEvents: "/web_billing_events?select=id&limit=1",
  };
  const database = Object.fromEntries(
    Object.keys(tables).map((table) => [table, false]),
  );

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return database;
  }

  await Promise.all(
    Object.entries(tables).map(async ([table, path]) => {
      try {
        await restFetch(fetchImpl, env, path);
        database[table] = true;
      } catch {
        database[table] = false;
      }
    }),
  );

  return database;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json" }),
  });
}

function emptyResponse(status = 204) {
  return new Response(null, { status, headers: corsHeaders() });
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Kroma-Client, X-Kroma-Billing-Key, Paddle-Signature",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    ...extra,
  };
}

class HttpError extends Error {
  constructor(status, body) {
    super(typeof body?.detail === "string" ? body.detail : "HTTP Error");
    this.status = status;
    this.body = body;
  }
}
