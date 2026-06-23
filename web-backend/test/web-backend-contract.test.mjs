import assert from "node:assert/strict";
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

test("auth signup generates an OTP and sends a custom verification email", async () => {
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
      if (url.endsWith("/auth/v1/admin/generate_link")) {
        return jsonResponse({
          email_otp: "123456",
        });
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
    "https://web-project.supabase.co/auth/v1/admin/generate_link",
  );
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    type: "signup",
    email: "seller@example.com",
    password: "secret-password",
    redirect_to: "https://kromaai.app",
  });
  assert.equal(calls[2].url, "https://api.resend.com/emails");
  const emailBody = JSON.parse(calls[2].init.body);
  assert.equal(emailBody.subject, "kroma 注册验证码");
  assert.match(emailBody.html, /123456/);
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
          email_otp: "654321",
        });
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
  const emailBody = JSON.parse(calls[1].init.body);
  assert.equal(emailBody.subject, "kroma 登录验证码");
  assert.match(emailBody.html, /654321/);
  assert.doesNotMatch(emailBody.html, /ConfirmationURL|Sign in/);
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
