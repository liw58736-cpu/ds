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

test("auth signup forwards only web-safe redirects to Supabase", async () => {
  const calls = [];
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://web-project.supabase.co",
      WEB_SUPABASE_ANON_KEY: "anon-key",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "service-key",
      WEB_AUTH_REDIRECT_URL: "https://kromaai.app",
      WEB_ALLOWED_AUTH_REDIRECTS: "https://kromaai.app,https://www.kromaai.app",
    },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
        access_token: "",
        refresh_token: "",
        user: { id: "pending-user" },
      });
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
    calls[0].url,
    "https://web-project.supabase.co/auth/v1/signup?redirect_to=https%3A%2F%2Fkromaai.app",
  );
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email: "seller@example.com",
    password: "secret-password",
  });
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
