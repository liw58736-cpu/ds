import test from "node:test";
import assert from "node:assert/strict";
import { createWebBackend } from "../src/app.mjs";
const json = (body) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
const env = {
  WEB_SUPABASE_URL: "https://db.invalid",
  WEB_SUPABASE_ANON_KEY: "fixture",
  WEB_SUPABASE_SERVICE_ROLE_KEY: "fixture",
  WEB_RESEND_API_KEY: "fixture",
};
test("repeated incorrect recovery codes are rate limited before additional database lookups", async () => {
  let lookups = 0;
  const app = createWebBackend({ env, fetch: async () => { lookups++; return json([]); } });
  const attempt = () => app.handle(new Request("http://local/api/v1/auth/recovery/complete", {
    method: "POST", body: JSON.stringify({ email: "a@example.invalid", code: "123456", password: "test-password" }),
  }));
  for (let i = 0; i < 10; i++) assert.equal((await attempt()).status, 422);
  const before = lookups;
  assert.equal((await attempt()).status, 429);
  assert.equal(lookups, before);
});
test("recovery request and password reset require the correct email OTP and never return a login session", async () => {
  const stored = [];
  let receivedCode;
  let changed = false;
  const app = createWebBackend({
    env,
    fetch: async (url, init = {}) => {
      const body = init.body ? JSON.parse(init.body) : {};
      if (url.endsWith("/admin/generate_link"))
        return json({ properties: { email_otp: "provider-code" } });
      if (url === "https://api.resend.com/emails") {
        receivedCode = String(body.text).match(/\b\d{6}\b/)?.[0];
        return json({ id: "mail" });
      }
      if (url.includes("/rest/v1/web_auth_codes")) {
        if (init.method === "POST") {
          stored.push(body);
          return json([body]);
        }
        if (init.method === "DELETE") return json([]);
        const query = new URL(url).searchParams;
        if (query.has("created_at")) return json([]);
        return json(
          stored.filter(
            (row) =>
              `eq.${row.code}` === query.get("code") &&
              `eq.${row.email}` === query.get("email"),
          ),
        );
      }
      if (url.endsWith("/auth/v1/verify")) {
        assert.equal(body.type, "recovery");
        return json({ access_token: "recovery-session" });
      }
      if (url.endsWith("/auth/v1/user") && init.method === "PUT") {
        assert.equal(init.headers.Authorization, "Bearer recovery-session");
        changed = true;
        return json({ id: "user" });
      }
      throw new Error("Unexpected fixture request");
    },
  });
  const post = (path, body) =>
    app.handle(
      new Request(`http://local/api/v1/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  assert.equal(
    (await post("auth/recovery", { email: "user@example.invalid" })).status,
    200,
  );
  assert.match(receivedCode, /^\d{6}$/);
  assert.equal(
    (
      await post("auth/recovery/complete", {
        email: "other@example.invalid",
        code: receivedCode,
        password: "test-password",
      })
    ).status,
    422,
  );
  const response = await post("auth/recovery/complete", {
    email: "user@example.invalid",
    code: receivedCode,
    password: "test-password",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reset: true });
  assert.equal(changed, true);
});
test("checkout catalog never advertises mismatched credit grants", async () => {
  const app = createWebBackend({
    env: {
      ...env,
      WEB_CHECKOUT_REVIEWED: "true",
      WEB_PADDLE_PRICE_CREDITS_JSON: JSON.stringify({
        pri_good: { credits: 90 },
        pri_bad: { credits: 999 },
      }),
      WEB_CHECKOUT_CATALOG_JSON: JSON.stringify([
        {
          id: "basic-top-up",
          price_id: "pri_good",
          amount_minor: 3600,
          currency: "CNY",
          credits: 90,
        },
        {
          id: "pro-top-up",
          price_id: "pri_bad",
          amount_minor: 21800,
          currency: "CNY",
          credits: 650,
        },
      ]),
    },
  });
  const result = await (
    await app.handle(new Request("http://local/api/v1/billing/catalog"))
  ).json();
  assert.equal(result.plans.length, 1);
  assert.equal(result.plans[0].credits, 90);
});
