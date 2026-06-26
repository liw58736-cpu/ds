import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  createWebBackend,
  isAllowedAuthRedirect,
} from "../src/app.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readJson(response) {
  return response.json();
}

function paddleSignature(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const h1 = createHmac("sha256", secret).update(`${timestamp}:${rawBody}`).digest("hex");
  return `ts=${timestamp};h1=${h1}`;
}

test("health endpoint reports deployment commit and missing configuration", async () => {
  const tablePaths = [
    "/rest/v1/web_users?select=id&limit=1",
    "/rest/v1/web_credit_transactions?select=id&limit=1",
    "/rest/v1/web_generations?select=id&limit=1",
    "/rest/v1/web_auth_codes?select=id&limit=1",
    "/rest/v1/web_billing_events?select=id&limit=1",
  ];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_RESEND_API_KEY: "resend-key",
      WEB_AUTH_EMAIL_FROM: "kroma <no-reply@example.com>",
      WEB_AUTH_CODE_SECRET: "auth-code-secret",
      WEB_AUTH_REDIRECT_URL: "https://kromaai.app",
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app",
      WEB_INTERNAL_BILLING_KEY: "billing-secret",
      WEB_PADDLE_WEBHOOK_SECRET: "paddle-secret",
      WEB_PADDLE_PRICE_CREDITS_JSON: '{"pri_test":{"credits":120}}',
      WEB_IMAGE_API_BASE_URL: "https://image-web.example.com/api/v1",
      WEB_IMAGE_API_KEY: "image-secret",
      RENDER_GIT_COMMIT: "commit-1",
    },
    fetch: async (url) => {
      if (tablePaths.some((path) => url.endsWith(path))) {
        return jsonResponse([]);
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/health"),
  );

  assert.equal(response.status, 200);
  const body = await readJson(response);
  assert.match(body.checked_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(body, {
    ok: true,
    service: "kroma-web-backend",
    commit: "commit-1",
    checked_at: body.checked_at,
    config: {
      supabaseUrl: true,
      supabaseAnonKey: true,
      supabaseServiceRoleKey: true,
      resendApiKey: true,
      authCodeSecret: true,
      authEmailFrom: true,
      authRedirectUrl: true,
      allowedAuthRedirects: true,
      internalBillingKey: true,
      paddleWebhookSecret: true,
      paddlePriceCredits: true,
      imageApiBaseUrl: true,
      imageApiKey: true,
    },
    database: {
      webUsers: true,
      webCreditTransactions: true,
      webGenerations: true,
      webAuthCodes: true,
      webBillingEvents: true,
    },
    missing: [],
    optionalMissing: [],
  });
});

test("health endpoint accepts the mobile app image router without an image api key", async () => {
  const tablePaths = [
    "/rest/v1/web_users?select=id&limit=1",
    "/rest/v1/web_credit_transactions?select=id&limit=1",
    "/rest/v1/web_generations?select=id&limit=1",
    "/rest/v1/web_auth_codes?select=id&limit=1",
    "/rest/v1/web_billing_events?select=id&limit=1",
  ];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_RESEND_API_KEY: "resend-key",
      WEB_AUTH_EMAIL_FROM: "kroma <no-reply@i18.pro>",
      WEB_AUTH_REDIRECT_URL: "https://kromaai.app",
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app",
      WEB_PADDLE_WEBHOOK_SECRET: "paddle-secret",
      WEB_PADDLE_PRICE_CREDITS_JSON: '{"pri_test":{"credits":120}}',
      WEB_IMAGE_API_BASE_URL: "https://kroma-api.onrender.com/api/v1",
      RENDER_GIT_COMMIT: "commit-1",
    },
    fetch: async (url) => {
      if (tablePaths.some((path) => url.endsWith(path))) {
        return jsonResponse([]);
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/health"),
  );
  const health = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(health.config.imageApiBaseUrl, true);
  assert.equal(health.config.imageApiKey, true);
  assert.deepEqual(health.missing, []);
});

test("health endpoint identifies missing production configuration", async () => {
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/health"),
  );
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, false);
  assert.equal(body.config.supabaseUrl, true);
  assert.equal(body.config.supabaseServiceRoleKey, false);
  assert.equal(body.database.webUsers, false);
  assert.ok(body.missing.includes("supabaseServiceRoleKey"));
  assert.ok(body.missing.includes("paddleWebhookSecret"));
});

test("health endpoint treats non-blocking production helpers as optional configuration", async () => {
  const tablePaths = [
    "/rest/v1/web_users?select=id&limit=1",
    "/rest/v1/web_credit_transactions?select=id&limit=1",
    "/rest/v1/web_generations?select=id&limit=1",
    "/rest/v1/web_auth_codes?select=id&limit=1",
    "/rest/v1/web_billing_events?select=id&limit=1",
  ];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_RESEND_API_KEY: "resend-key",
      WEB_AUTH_EMAIL_FROM: "kroma <no-reply@example.com>",
      WEB_AUTH_REDIRECT_URL: "https://kromaai.app",
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app",
      WEB_PADDLE_WEBHOOK_SECRET: "paddle-secret",
      WEB_PADDLE_PRICE_CREDITS_JSON: '{"pri_test":{"credits":120}}',
      WEB_IMAGE_API_BASE_URL: "https://image-web.example.com/api/v1",
      WEB_IMAGE_API_KEY: "image-secret",
    },
    fetch: async (url) => {
      if (tablePaths.some((path) => url.endsWith(path))) {
        return jsonResponse([]);
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/health"),
  );
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.config.authCodeSecret, false);
  assert.equal(body.config.internalBillingKey, false);
  assert.deepEqual(body.optionalMissing, ["authCodeSecret", "internalBillingKey"]);
  assert.ok(!body.missing.includes("authCodeSecret"));
  assert.ok(!body.missing.includes("internalBillingKey"));
});

test("health endpoint rejects invalid Paddle price credit mapping", async () => {
  const tablePaths = [
    "/rest/v1/web_users?select=id&limit=1",
    "/rest/v1/web_credit_transactions?select=id&limit=1",
    "/rest/v1/web_generations?select=id&limit=1",
    "/rest/v1/web_auth_codes?select=id&limit=1",
    "/rest/v1/web_billing_events?select=id&limit=1",
  ];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_RESEND_API_KEY: "resend-key",
      WEB_AUTH_EMAIL_FROM: "kroma <no-reply@example.com>",
      WEB_AUTH_REDIRECT_URL: "https://kromaai.app",
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app",
      WEB_INTERNAL_BILLING_KEY: "billing-secret",
      WEB_PADDLE_WEBHOOK_SECRET: "paddle-secret",
      WEB_PADDLE_PRICE_CREDITS_JSON: "not-json",
      WEB_IMAGE_API_BASE_URL: "https://image-web.example.com/api/v1",
      WEB_IMAGE_API_KEY: "image-secret",
    },
    fetch: async (url) => {
      if (tablePaths.some((path) => url.endsWith(path))) {
        return jsonResponse([]);
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/health"),
  );
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, false);
  assert.equal(body.config.paddlePriceCredits, false);
  assert.ok(body.missing.includes("paddlePriceCredits"));
});

test("health endpoint flags missing Supabase schema tables", async () => {
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_RESEND_API_KEY: "resend-key",
      WEB_AUTH_EMAIL_FROM: "kroma <no-reply@example.com>",
      WEB_AUTH_REDIRECT_URL: "https://kromaai.app",
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app",
      WEB_INTERNAL_BILLING_KEY: "billing-secret",
      WEB_PADDLE_WEBHOOK_SECRET: "paddle-secret",
      WEB_PADDLE_PRICE_CREDITS_JSON: '{"pri_test":{"credits":120}}',
      WEB_IMAGE_API_BASE_URL: "https://image-web.example.com/api/v1",
      WEB_IMAGE_API_KEY: "image-secret",
    },
    fetch: async (url) => {
      if (url.includes("/rest/v1/web_billing_events?")) {
        return jsonResponse({ message: "relation does not exist" }, 404);
      }

      if (url.includes("/rest/v1/web_")) {
        return jsonResponse([]);
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/health"),
  );
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, false);
  assert.equal(body.missing.length, 0);
  assert.equal(body.database.webUsers, true);
  assert.equal(body.database.webBillingEvents, false);
});

test("auth signup creates an unconfirmed user and only sends the custom six digit code", async () => {
  const calls = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_RESEND_API_KEY: "resend-key",
      WEB_AUTH_REDIRECT_URL: "https://kromaai.app",
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app,https://www.kromaai.app",
    },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.includes("/rest/v1/web_users?email=eq.seller%40example.com")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/auth/v1/admin/users")) {
        return jsonResponse({
          id: "auth-user-1",
          email: "seller@example.com",
        });
      }
      if (url.endsWith("/rest/v1/web_auth_codes")) {
        return jsonResponse([{ id: "code-1", ...JSON.parse(init.body) }]);
      }
      if (url === "https://api.resend.com/emails") {
        return jsonResponse({ id: "email-1" });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "seller@example.com",
        password: "secret-password",
        redirect_to: "https://kromaai.app",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(
    calls[1].url,
    "https://web-project.supabase.co/auth/v1/admin/users",
  );
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    email: "seller@example.com",
    password: "secret-password",
    email_confirm: false,
    user_metadata: {
      source: "kroma-web",
    },
  });
  assert.equal(calls[3].url, "https://api.resend.com/emails");
  const storedCode = JSON.parse(calls[2].init.body).code;
  assert.match(storedCode, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(calls[2].init.body).provider_token, "auth-user-1");
  const emailBody = JSON.parse(calls[3].init.body);
  const publicCode = emailBody.text.match(/\b\d{6}\b/)?.[0];
  assert.match(publicCode ?? "", /^\d{6}$/);
  assert.notEqual(storedCode, publicCode);
  assert.equal(emailBody.subject, "kroma 注册验证码");
  assert.match(emailBody.html, new RegExp(publicCode));
  assert.doesNotMatch(emailBody.html, /auth-user-1/);
  assert.doesNotMatch(emailBody.html, /ConfirmationURL|Confirm email address/);
});

test("auth signup rejects app deep-link redirects for the web backend", async () => {
  assert.equal(
    isAllowedAuthRedirect("kroma://login-callback", {
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app",
    }),
    false,
  );

  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app",
    },
    fetch: async () => {
      throw new Error("Supabase should not be called");
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "seller@example.com",
        password: "secret-password",
        redirect_to: "kroma://login-callback",
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    detail: "Invalid auth redirect URL",
  });
});

test("auth signup maps existing Supabase auth users to the registered email response", async () => {
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app",
    },
    fetch: async (url) => {
      if (url.includes("/rest/v1/web_users?email=eq.seller%40example.com")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/auth/v1/admin/users")) {
        return jsonResponse({ message: "A user with this email address has already been registered" }, 422);
      }
      if (
        url.includes("/rest/v1/web_auth_codes?email=eq.seller%40example.com") &&
        url.includes("type=eq.signup")
      ) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "seller@example.com",
        password: "secret-password",
        redirect_to: "https://kromaai.app",
      }),
    }),
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await readJson(response), {
    detail: {
      code: "email_already_registered",
      message: "该邮箱已注册，请直接登录。",
    },
  });
});

test("auth signup resends a custom code for a pending unconfirmed signup", async () => {
  const calls = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_RESEND_API_KEY: "resend-key",
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app",
    },
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.includes("/rest/v1/web_users?email=eq.seller%40example.com")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/auth/v1/admin/users")) {
        return jsonResponse({ message: "A user with this email address has already been registered" }, 422);
      }
      if (
        url.includes("/rest/v1/web_auth_codes?email=eq.seller%40example.com") &&
        url.includes("type=eq.signup")
      ) {
        return jsonResponse([
          {
            id: "old-code",
            provider_token: "auth-user-1",
          },
        ]);
      }
      if (url.endsWith("/rest/v1/web_auth_codes")) {
        return jsonResponse([{ id: "code-2", ...JSON.parse(init.body) }]);
      }
      if (url === "https://api.resend.com/emails") {
        return jsonResponse({ id: "email-2" });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "seller@example.com",
        password: "secret-password",
        redirect_to: "https://kromaai.app",
      }),
    }),
  );

  assert.equal(response.status, 200);
  const storedCodeBody = JSON.parse(calls[3].init.body);
  assert.match(storedCodeBody.code, /^[a-f0-9]{64}$/);
  assert.equal(storedCodeBody.provider_token, "auth-user-1");
  const emailBody = JSON.parse(calls[4].init.body);
  const publicCode = emailBody.text.match(/\b\d{6}\b/)?.[0];
  assert.match(publicCode ?? "", /^\d{6}$/);
  assert.notEqual(storedCodeBody.code, publicCode);
  assert.match(emailBody.html, new RegExp(publicCode));
  assert.doesNotMatch(emailBody.html, /auth-user-1/);
});

test("auth otp sends a custom login code email", async () => {
  const calls = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_RESEND_API_KEY: "resend-key",
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app",
    },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/auth/v1/admin/generate_link")) {
        return jsonResponse({
          email_otp: "87654321",
        });
      }
      if (url.endsWith("/rest/v1/web_auth_codes")) {
        return jsonResponse([{ id: "code-2", ...JSON.parse(init.body) }]);
      }
      if (url === "https://api.resend.com/emails") {
        return jsonResponse({ id: "email-2" });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/auth/otp", {
      method: "POST",
      body: JSON.stringify({
        email: "seller@example.com",
        redirect_to: "https://kromaai.app",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { sent: true });
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    type: "magiclink",
    email: "seller@example.com",
    redirect_to: "https://kromaai.app",
  });
  const storedCode = JSON.parse(calls[1].init.body).code;
  assert.match(storedCode, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(calls[1].init.body).provider_token, "87654321");
  const emailBody = JSON.parse(calls[2].init.body);
  const publicCode = emailBody.text.match(/\b\d{6}\b/)?.[0];
  assert.match(publicCode ?? "", /^\d{6}$/);
  assert.notEqual(storedCode, publicCode);
  assert.equal(emailBody.subject, "kroma 登录验证码");
  assert.match(emailBody.html, new RegExp(publicCode));
  assert.doesNotMatch(emailBody.html, /87654321/);
  assert.doesNotMatch(emailBody.html, /ConfirmationURL|Sign in/);
});

test("auth verify confirms the signup user after the public six digit code", async () => {
  const calls = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.includes("/rest/v1/web_auth_codes?email=")) {
        assert.match(url, /code=eq\.[a-f0-9]{64}/);
        assert.doesNotMatch(url, /code=eq\.123456/);
        return jsonResponse([
          {
            id: "code-1",
            provider_token: "auth-user-1",
          },
        ]);
      }
      if (url.includes("/rest/v1/web_auth_codes?id=eq.code-1")) {
        return jsonResponse({});
      }
      if (url.endsWith("/auth/v1/admin/users/auth-user-1")) {
        return jsonResponse({
          id: "auth-user-1",
          email: "seller@example.com",
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/auth/verify-signup", {
      method: "POST",
      body: JSON.stringify({
        email: "seller@example.com",
        token: "123456",
      }),
    }),
  );

  const responseBody = await readJson(response);
  assert.equal(response.status, 200, JSON.stringify(responseBody));
  assert.deepEqual(responseBody, {
    access_token: "",
    refresh_token: "",
    user_id: "auth-user-1",
  });
  assert.deepEqual(JSON.parse(calls[2].init.body), {
    email_confirm: true,
  });
});

test("auth verify still accepts a recent legacy plain code during rollout", async () => {
  const calls = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.includes("/rest/v1/web_auth_codes?email=")) {
        if (url.includes("code=eq.123456")) {
          return jsonResponse([
            {
              id: "legacy-code-1",
              provider_token: "auth-user-legacy",
            },
          ]);
        }

        return jsonResponse([]);
      }
      if (url.includes("/rest/v1/web_auth_codes?id=eq.legacy-code-1")) {
        return jsonResponse({});
      }
      if (url.endsWith("/auth/v1/admin/users/auth-user-legacy")) {
        return jsonResponse({
          id: "auth-user-legacy",
          email: "seller@example.com",
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/auth/verify-signup", {
      method: "POST",
      body: JSON.stringify({
        email: "seller@example.com",
        token: "123456",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    access_token: "",
    refresh_token: "",
    user_id: "auth-user-legacy",
  });
  assert.match(calls[0].url, /code=eq\.[a-f0-9]{64}/);
  assert.match(calls[1].url, /code=eq\.123456/);
});

test("auth verify rejects raw Supabase eight digit codes", async () => {
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fetch: async (url) => {
      if (url.includes("/rest/v1/web_auth_codes?")) {
        return jsonResponse([]);
      }

      if (url.endsWith("/auth/v1/verify")) {
        throw new Error("Raw Supabase OTP should not be verified directly");
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/auth/verify-signup", {
      method: "POST",
      body: JSON.stringify({
        email: "seller@example.com",
        token: "12345678",
      }),
    }),
  );

  assert.equal(response.status, 422);
  assert.deepEqual(await readJson(response), {
    detail: "Invalid or expired verification code",
  });
});

test("credits endpoint creates an isolated web user with five free credits", async () => {
  const calls = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.endsWith("/auth/v1/user")) {
        return jsonResponse({ id: "web-user-1", email: "seller@example.com" });
      }
      if (url.includes("/rest/v1/web_users?id=eq.web-user-1")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/rest/v1/web_users")) {
        return jsonResponse([
          {
            id: "web-user-1",
            email: "seller@example.com",
            credits: 5,
            plan: "free",
          },
        ]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/user/credits", {
      headers: { Authorization: "Bearer access-token" },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    credits: 5,
    is_paid: false,
    plan: "free",
  });
  assert.equal(calls[2].init.method, "POST");
  assert.equal(JSON.parse(calls[2].init.body).credits, 5);
});

test("deduct endpoint charges only completed success-only tasks", async () => {
  const rows = [{ id: "web-user-1", email: "seller@example.com", credits: 5, plan: "free" }];
  const transactions = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fetch: async (url, init = {}) => {
      if (url.endsWith("/auth/v1/user")) {
        return jsonResponse({ id: "web-user-1", email: "seller@example.com" });
      }
      if (url.includes("/rest/v1/web_users?id=eq.web-user-1")) {
        if (init.method === "PATCH") {
          rows[0].credits = JSON.parse(init.body).credits;
          return jsonResponse([rows[0]]);
        }
        return jsonResponse(rows);
      }
      if (url.endsWith("/rest/v1/web_credit_transactions")) {
        transactions.push(JSON.parse(init.body));
        return jsonResponse([transactions.at(-1)]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const skipped = await app.handle(
    new Request(
      "http://local.test/api/v1/user/credits/deduct?amount=2&task_status=failed&charge_policy=success_only",
      { method: "POST", headers: { Authorization: "Bearer access-token" } },
    ),
  );
  assert.deepEqual(await readJson(skipped), {
    success: false,
    charged: false,
    credits_remaining: 5,
  });
  assert.equal(rows[0].credits, 5);

  const charged = await app.handle(
    new Request(
      "http://local.test/api/v1/user/credits/deduct?amount=2&task_status=completed&charge_policy=success_only",
      { method: "POST", headers: { Authorization: "Bearer access-token" } },
    ),
  );
  assert.deepEqual(await readJson(charged), {
    success: true,
    charged: true,
    credits_remaining: 3,
  });
  assert.equal(rows[0].credits, 3);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].amount, -2);
});

test("image generation proxy requires auth and a dedicated web image upstream", async () => {
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fetch: async () => {
      return jsonResponse({ id: "web-user-1", email: "seller@example.com" });
    },
  });

  const missingAuth = await app.handle(
    new Request("http://local.test/api/v1/image/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "product hero" }),
    }),
  );

  assert.equal(missingAuth.status, 401);

  const missingUpstream = await app.handle(
    new Request("http://local.test/api/v1/image/generate", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
      body: JSON.stringify({ prompt: "product hero" }),
    }),
  );

  assert.equal(missingUpstream.status, 501);
  assert.deepEqual(await readJson(missingUpstream), {
    detail: "Web image generation upstream is not configured.",
  });
});

test("image generation proxy forwards to the dedicated web image upstream", async () => {
  const calls = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_IMAGE_API_BASE_URL: "https://image-web.example.com/api/v1",
      WEB_IMAGE_API_KEY: "image-secret",
    },
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.endsWith("/auth/v1/user")) {
        return jsonResponse({ id: "web-user-1", email: "seller@example.com" });
      }
      if (url === "https://image-web.example.com/api/v1/image/generate") {
        assert.equal(init.method, "POST");
        assert.equal(init.headers.Authorization, "Bearer image-secret");
        assert.equal(init.headers["X-Kroma-Client"], "web-backend");
        assert.deepEqual(JSON.parse(init.body), { prompt: "product hero" });
        return jsonResponse({
          task_id: "image-task-1",
          status: "processing",
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/image/generate", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
      body: JSON.stringify({ prompt: "product hero" }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    task_id: "image-task-1",
    status: "processing",
  });
  assert.equal(calls[0].url, "https://web-project.supabase.co/auth/v1/user");
  assert.equal(calls[1].url, "https://image-web.example.com/api/v1/image/generate");
});

test("image generation proxy can use the mobile app image router without mixing auth", async () => {
  const calls = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_IMAGE_API_BASE_URL: "https://kroma-api.onrender.com/api/v1",
      WEB_IMAGE_API_KEY: "stale-web-or-app-token",
    },
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.endsWith("/auth/v1/user")) {
        return jsonResponse({ id: "web-user-1", email: "seller@example.com" });
      }
      if (url === "https://kroma-api.onrender.com/api/v1/image/generate") {
        assert.equal(init.method, "POST");
        assert.equal(init.headers.Authorization, undefined);
        assert.equal(init.headers["X-Kroma-Client"], "web-backend");
        assert.deepEqual(JSON.parse(init.body), { prompt: "product hero" });
        return jsonResponse({
          task_id: "image-task-1",
          status: "processing",
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/image/generate", {
      method: "POST",
      headers: { Authorization: "Bearer web-access-token" },
      body: JSON.stringify({ prompt: "product hero" }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    task_id: "image-task-1",
    status: "processing",
  });
  assert.equal(calls[0].url, "https://web-project.supabase.co/auth/v1/user");
  assert.equal(calls[1].url, "https://kroma-api.onrender.com/api/v1/image/generate");
});

test("image generation uses the web backend provider router instead of forwarding to the app backend", async () => {
  const calls = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_IMAGE_API_BASE_URL: "https://kroma-api.onrender.com/api/v1",
      RIGHTCODE_BASE_URL: "https://rightcode.example.com/v1",
      RIGHTCODE_KEY_1: "rightcode-key",
      RIGHTCODE_CONCURRENT: "2",
    },
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.endsWith("/auth/v1/user")) {
        return jsonResponse({ id: "web-user-1", email: "seller@example.com" });
      }
      if (url === "https://rightcode.example.com/v1/images/generations") {
        assert.equal(init.method, "POST");
        assert.equal(init.headers.Authorization, "Bearer rightcode-key");
        assert.deepEqual(JSON.parse(init.body), {
          model: "gpt-image-2",
          prompt: "product hero",
          n: 1,
          size: "1024x1024",
          quality: "medium",
          response_format: "url",
          image: "https://cdn.example.com/product.png",
        });
        return jsonResponse({
          data: [{ url: "https://cdn.example.com/result.png" }],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/image/generate", {
      method: "POST",
      headers: { Authorization: "Bearer web-access-token" },
      body: JSON.stringify({
        prompt: "product hero",
        image_url: "https://cdn.example.com/product.png",
        quality: "standard",
        size: "1024x1024",
        task_type: "ecommerce",
      }),
    }),
  );

  assert.equal(response.status, 200);
  const body = await readJson(response);
  assert.match(body.task_id, /^web-img-/);
  assert.equal(body.status, "processing");
  assert.equal(calls.some((call) => call.url === "https://kroma-api.onrender.com/api/v1/image/generate"), false);

  await new Promise((resolve) => setTimeout(resolve, 0));

  const task = await app.handle(
    new Request(`http://local.test/api/v1/image/task/${body.task_id}`, {
      headers: { Authorization: "Bearer web-access-token" },
    }),
  );

  assert.equal(task.status, 200);
  assert.deepEqual(await readJson(task), {
    task_id: body.task_id,
    status: "done",
    image_url: "https://cdn.example.com/result.png",
    image_base64: null,
    channel_used: "rightcode",
    error: null,
    progress: "完成",
  });
});

test("image generation proxy forwards cancel requests without requiring a JSON body", async () => {
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_IMAGE_API_BASE_URL: "https://image-web.example.com/api/v1",
      WEB_IMAGE_API_KEY: "image-secret",
    },
    fetch: async (url, init = {}) => {
      if (url.endsWith("/auth/v1/user")) {
        return jsonResponse({ id: "web-user-1", email: "seller@example.com" });
      }
      if (url === "https://image-web.example.com/api/v1/image/task/task-1/cancel") {
        assert.equal(init.method, "POST");
        assert.equal(init.body, undefined);
        return jsonResponse({ canceled: true });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/image/task/task-1/cancel", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { canceled: true });
});

test("credit top-up endpoint requires an internal billing key", async () => {
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_INTERNAL_BILLING_KEY: "billing-secret",
    },
    fetch: async () => {
      throw new Error("Auth should not be checked before billing key validation");
    },
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/user/credits/add?amount=950", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    detail: "Credit top-up requires internal billing access",
  });
});

test("paddle webhook credits a web user once after signature verification", async () => {
  const users = [{ id: "web-user-1", email: "seller@example.com", credits: 5, plan: "free" }];
  const transactions = [];
  const billingEvents = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_PADDLE_WEBHOOK_SECRET: "paddle-secret",
    },
    fetch: async (url, init = {}) => {
      if (url.endsWith("/rest/v1/web_billing_events")) {
        const body = JSON.parse(init.body);
        if (billingEvents.some((event) => event.event_id === body.event_id)) {
          return jsonResponse({ message: "duplicate key value violates unique constraint" }, 409);
        }
        billingEvents.push(body);
        return jsonResponse([body]);
      }
      if (url.includes("/rest/v1/web_billing_events?provider=eq.paddle&event_id=eq.evt_1")) {
        if (init.method !== "PATCH") {
          return jsonResponse(billingEvents.map((event) => ({ status: event.status })));
        }
        const body = JSON.parse(init.body);
        Object.assign(billingEvents[0], body);
        return jsonResponse([billingEvents[0]]);
      }
      if (url.includes("/rest/v1/web_users?id=eq.web-user-1")) {
        if (init.method === "PATCH") {
          users[0].credits = JSON.parse(init.body).credits;
          return jsonResponse([users[0]]);
        }
        return jsonResponse(users);
      }
      if (url.endsWith("/rest/v1/web_credit_transactions")) {
        transactions.push(JSON.parse(init.body));
        return jsonResponse([transactions.at(-1)]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });
  const payload = {
    event_id: "evt_1",
    event_type: "transaction.completed",
    data: {
      id: "txn_1",
      custom_data: {
        user_id: "web-user-1",
        plan_id: "pro-top-up",
        plan_name: "专业包",
        credits: 950,
      },
    },
  };
  const rawBody = JSON.stringify(payload);

  const response = await app.handle(
    new Request("http://local.test/api/v1/billing/paddle/webhook", {
      method: "POST",
      headers: { "Paddle-Signature": paddleSignature(rawBody, "paddle-secret") },
      body: rawBody,
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    received: true,
    credited: 950,
    credits_remaining: 955,
  });
  assert.equal(users[0].credits, 955);
  assert.deepEqual(transactions[0], {
    user_id: "web-user-1",
    amount: 950,
    type: "purchase",
    description: "Paddle purchase: 专业包",
    reference_id: "txn_1",
  });
  assert.equal(billingEvents[0].status, "processed");
  assert.equal(billingEvents[0].event_id, "evt_1");

  const duplicate = await app.handle(
    new Request("http://local.test/api/v1/billing/paddle/webhook", {
      method: "POST",
      headers: { "Paddle-Signature": paddleSignature(rawBody, "paddle-secret") },
      body: rawBody,
    }),
  );

  assert.deepEqual(await readJson(duplicate), {
    received: true,
    duplicate: true,
    status: "processed",
  });
  assert.equal(users[0].credits, 955);
  assert.equal(transactions.length, 1);
});

test("paddle webhook derives credits from server-side price mapping", async () => {
  const users = [{ id: "web-user-1", email: "seller@example.com", credits: 5, plan: "free" }];
  const transactions = [];
  const billingEvents = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_PADDLE_WEBHOOK_SECRET: "paddle-secret",
      WEB_PADDLE_PRICE_CREDITS_JSON: JSON.stringify({
        pri_standard: {
          credits: 420,
          plan_id: "standard-top-up",
          plan_name: "标准包",
        },
      }),
    },
    fetch: async (url, init = {}) => {
      if (url.endsWith("/rest/v1/web_billing_events")) {
        const body = JSON.parse(init.body);
        billingEvents.push(body);
        return jsonResponse([body]);
      }
      if (url.includes("/rest/v1/web_billing_events?provider=eq.paddle&event_id=eq.evt_price_map")) {
        if (init.method !== "PATCH") {
          return jsonResponse(billingEvents.map((event) => ({ status: event.status })));
        }
        Object.assign(billingEvents[0], JSON.parse(init.body));
        return jsonResponse([billingEvents[0]]);
      }
      if (url.includes("/rest/v1/web_users?id=eq.web-user-1")) {
        if (init.method === "PATCH") {
          users[0].credits = JSON.parse(init.body).credits;
          return jsonResponse([users[0]]);
        }
        return jsonResponse(users);
      }
      if (url.endsWith("/rest/v1/web_credit_transactions")) {
        transactions.push(JSON.parse(init.body));
        return jsonResponse([transactions.at(-1)]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });
  const payload = {
    event_id: "evt_price_map",
    event_type: "transaction.completed",
    data: {
      id: "txn_price_map",
      custom_data: {
        user_id: "web-user-1",
      },
      items: [
        {
          price: {
            id: "pri_standard",
          },
        },
      ],
    },
  };
  const rawBody = JSON.stringify(payload);

  const response = await app.handle(
    new Request("http://local.test/api/v1/billing/paddle/webhook", {
      method: "POST",
      headers: { "Paddle-Signature": paddleSignature(rawBody, "paddle-secret") },
      body: rawBody,
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    received: true,
    credited: 420,
    credits_remaining: 425,
  });
  assert.equal(users[0].credits, 425);
  assert.deepEqual(transactions[0], {
    user_id: "web-user-1",
    amount: 420,
    type: "purchase",
    description: "Paddle purchase: 标准包",
    reference_id: "txn_price_map",
  });
});

test("paddle webhook rejects invalid signatures before crediting", async () => {
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_PADDLE_WEBHOOK_SECRET: "paddle-secret",
    },
    fetch: async () => {
      throw new Error("Database should not be touched for invalid Paddle signatures");
    },
  });
  const rawBody = JSON.stringify({
    event_id: "evt_invalid",
    event_type: "transaction.completed",
  });

  const response = await app.handle(
    new Request("http://local.test/api/v1/billing/paddle/webhook", {
      method: "POST",
      headers: {
        "Paddle-Signature": `ts=${Math.floor(Date.now() / 1000)};h1=bad`,
      },
      body: rawBody,
    }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    detail: "Invalid Paddle webhook signature",
  });
});

test("paddle webhook duplicate reservation skips crediting", async () => {
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_PADDLE_WEBHOOK_SECRET: "paddle-secret",
    },
    fetch: async (url, init = {}) => {
      if (url.endsWith("/rest/v1/web_billing_events")) {
        return jsonResponse({ message: "duplicate key value violates unique constraint" }, 409);
      }
      if (url.includes("/rest/v1/web_billing_events?provider=eq.paddle&event_id=eq.evt_duplicate")) {
        return jsonResponse([{ status: "processed" }]);
      }

      throw new Error(`Duplicate webhook should not touch another table: ${url}`);
    },
  });
  const payload = {
    event_id: "evt_duplicate",
    event_type: "transaction.completed",
    data: {
      id: "txn_duplicate",
      custom_data: {
        user_id: "web-user-1",
        credits: 950,
      },
    },
  };
  const rawBody = JSON.stringify(payload);

  const response = await app.handle(
    new Request("http://local.test/api/v1/billing/paddle/webhook", {
      method: "POST",
      headers: { "Paddle-Signature": paddleSignature(rawBody, "paddle-secret") },
      body: rawBody,
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    received: true,
    duplicate: true,
    status: "processed",
  });
});

test("paddle webhook retries events that failed before credit mutation", async () => {
  const users = [{ id: "web-user-1", email: "seller@example.com", credits: 5, plan: "free" }];
  const billingEvents = [];
  const transactions = [];
  let failFirstUserLookup = true;
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_PADDLE_WEBHOOK_SECRET: "paddle-secret",
    },
    fetch: async (url, init = {}) => {
      if (url.endsWith("/rest/v1/web_billing_events")) {
        const body = JSON.parse(init.body);
        if (billingEvents.some((event) => event.event_id === body.event_id)) {
          return jsonResponse({ message: "duplicate key value violates unique constraint" }, 409);
        }
        billingEvents.push(body);
        return jsonResponse([body]);
      }
      if (url.includes("/rest/v1/web_billing_events?provider=eq.paddle&event_id=eq.evt_retry")) {
        if (init.method !== "PATCH") {
          return jsonResponse(billingEvents.map((event) => ({ status: event.status })));
        }
        Object.assign(billingEvents[0], JSON.parse(init.body));
        return jsonResponse([billingEvents[0]]);
      }
      if (url.includes("/rest/v1/web_users?id=eq.web-user-1")) {
        if (failFirstUserLookup) {
          failFirstUserLookup = false;
          return jsonResponse({ message: "temporary database error" }, 500);
        }
        if (init.method === "PATCH") {
          users[0].credits = JSON.parse(init.body).credits;
          return jsonResponse([users[0]]);
        }
        return jsonResponse(users);
      }
      if (url.endsWith("/rest/v1/web_credit_transactions")) {
        transactions.push(JSON.parse(init.body));
        return jsonResponse([transactions.at(-1)]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });
  const payload = {
    event_id: "evt_retry",
    event_type: "transaction.completed",
    data: {
      id: "txn_retry",
      custom_data: {
        user_id: "web-user-1",
        credits: 950,
      },
    },
  };
  const rawBody = JSON.stringify(payload);

  const first = await app.handle(
    new Request("http://local.test/api/v1/billing/paddle/webhook", {
      method: "POST",
      headers: { "Paddle-Signature": paddleSignature(rawBody, "paddle-secret") },
      body: rawBody,
    }),
  );

  assert.equal(first.status, 500);
  assert.equal(billingEvents[0].status, "failed_retryable");
  assert.equal(users[0].credits, 5);

  const second = await app.handle(
    new Request("http://local.test/api/v1/billing/paddle/webhook", {
      method: "POST",
      headers: { "Paddle-Signature": paddleSignature(rawBody, "paddle-secret") },
      body: rawBody,
    }),
  );

  assert.equal(second.status, 200);
  assert.deepEqual(await readJson(second), {
    received: true,
    credited: 950,
    credits_remaining: 955,
  });
  assert.equal(users[0].credits, 955);
  assert.equal(transactions.length, 1);
  assert.equal(billingEvents[0].status, "processed");
});
