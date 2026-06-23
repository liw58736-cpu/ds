const defaultFreeCredits = 5;
const defaultSender = "kroma <no-reply@i18.pro>";

export function createWebBackend({
  env = process.env,
  fetch: fetchImpl = globalThis.fetch,
} = {}) {
  return {
    handle: (request) => handleRequest(request, env, fetchImpl),
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

async function handleRequest(request, env, fetchImpl) {
  if (request.method === "OPTIONS") {
    return emptyResponse(204);
  }

  const url = new URL(request.url);

  try {
    if (url.pathname === "/api/v1/health") {
      return jsonResponse({ ok: true, service: "kroma-web-backend" });
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

    if (url.pathname.startsWith("/api/v1/image/")) {
      return jsonResponse(
        { detail: "Web image generation backend is not configured yet." },
        501,
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

  const data = await supabaseAdmin(fetchImpl, env, "generate_link", {
    type: "signup",
    email,
    password,
    ...(redirectTo ? { redirect_to: redirectTo } : {}),
  });

  const token = data?.email_otp ?? data?.properties?.email_otp;
  if (!token) {
    throw new HttpError(500, { detail: "Signup code was not generated" });
  }

  await sendAuthCodeEmail(fetchImpl, env, {
    email,
    code: token,
    subject: "kroma 注册验证码",
    title: "kroma 注册验证码",
    intro: "你正在注册 kroma 网页端账号。",
    action: "请在注册页面输入下面的验证码完成注册：",
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

  const token = data?.email_otp ?? data?.properties?.email_otp;
  if (!token) {
    throw new HttpError(500, { detail: "Login code was not generated" });
  }

  await sendAuthCodeEmail(fetchImpl, env, {
    email,
    code: token,
    subject: "kroma 登录验证码",
    title: "kroma 登录验证码",
    intro: "你正在登录 kroma 网页端账号。",
    action: "请在登录页面输入下面的验证码：",
  });

  return jsonResponse({ sent: true });
}

async function handleVerify(request, env, fetchImpl, type) {
  const body = await readJsonBody(request);
  const data = await supabaseAuth(fetchImpl, env, "verify", {
    email: normalizeEmail(body.email),
    token: String(body.token ?? ""),
    type,
  });

  return tokenResponse(data);
}

async function ensureEmailIsNotRegistered(fetchImpl, env, email) {
  const rows = await restFetch(
    fetchImpl,
    env,
    `/web_users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
  );

  if (Array.isArray(rows) && rows.length > 0) {
    throw new HttpError(409, {
      detail: {
        code: "email_already_registered",
        message: "该邮箱已注册，请直接登录。",
      },
    });
  }
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
  const rows = await restFetch(fetchImpl, env, `/web_users?id=eq.${encodeURIComponent(authUser.id)}&select=*`);
  if (Array.isArray(rows) && rows.length > 0) {
    return normalizeWebUser(rows[0]);
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

async function supabaseAdmin(fetchImpl, env, endpoint, body) {
  const response = await fetchImpl(`${supabaseUrl(env)}/auth/v1/admin/${endpoint}`, {
    method: "POST",
    headers: {
      apikey: env.WEB_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.WEB_SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseSupabaseResponse(response);
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Kroma-Client",
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
