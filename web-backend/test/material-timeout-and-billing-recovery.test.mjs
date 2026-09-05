import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createWebBackend } from "../src/app.mjs";

const env = {
  WEB_SUPABASE_URL: "https://db.invalid",
  WEB_SUPABASE_ANON_KEY: "fixture",
  WEB_SUPABASE_SERVICE_ROLE_KEY: "fixture",
  WEB_PADDLE_WEBHOOK_SECRET: "fixture",
};
const user = "00000000-0000-0000-0000-000000000001";
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});
const post = (app, path, body, options = {}) => app.handle(new Request(
  `http://local/api/v1/${path}`, {
    method: "POST", headers: { Authorization: "Bearer fixture", ...options.headers },
    body: JSON.stringify(body), ...(options.signal ? { signal: options.signal } : {}),
  },
));

for (const stalledStage of ["bucket", "upload-body"]) {
  test(`material storage deadline aborts stalled ${stalledStage}`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let entered, storageSignal, uploadCalls = 0;
    const reachedStorage = new Promise((resolve) => { entered = resolve; });
    const app = createWebBackend({
      env,
      resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
      fetch: async (url, init = {}) => {
        const path = new URL(url).pathname;
        if (path === "/auth/v1/user") return json({ id: user });
        if (new URL(url).hostname === "source.invalid")
          return new Response(new Uint8Array([255, 216, 255]), {
            headers: { "Content-Type": "image/jpeg" },
          });
        if (path === "/storage/v1/bucket" && stalledStage !== "bucket")
          return json({ message: "already exists" }, 409);
        if (path.startsWith("/storage/v1/object/")) uploadCalls++;
        storageSignal = init.signal;
        entered();
        assert.ok(storageSignal, "storage must share the request deadline");
        if (stalledStage === "bucket") return new Promise((_, reject) => {
          storageSignal.addEventListener("abort", () => reject(storageSignal.reason), { once: true });
        });
        return new Response(new ReadableStream({
          start(controller) {
            storageSignal.addEventListener("abort", () => controller.error(storageSignal.reason), { once: true });
          },
        }), { headers: { "Content-Type": "application/json" } });
      },
    });
    const pending = post(app, "materials/store", { url: "https://source.invalid/photo.jpg", authorized: true });
    await reachedStorage;
    t.mock.timers.tick(80000);
    const response = await pending;
    assert.equal(response.status, 504);
    assert.match((await response.json()).detail, /timed out/);
    assert.equal(storageSignal.aborted, true);
    assert.equal(uploadCalls, stalledStage === "bucket" ? 0 : 1);
  });
}

test("a canceled material request aborts its pending authentication read", async () => {
  const controller = new AbortController();
  let entered, outboundSignal;
  const started = new Promise((resolve) => { entered = resolve; });
  const app = createWebBackend({ env, fetch: async (_url, init) => {
    outboundSignal = init.signal;
    entered();
    return new Promise((_, reject) => {
      outboundSignal.addEventListener("abort", () => reject(outboundSignal.reason), { once: true });
    });
  } });
  const pending = post(app, "materials/store", {}, { signal: controller.signal });
  await started;
  controller.abort();
  assert.equal((await pending).status, 499);
  assert.equal(outboundSignal.aborted, true);
});

for (const kind of ["image", "oversized-page", "redirect"]) {
  test(`material import cancels the unused ${kind} response body`, async () => {
    let canceled = 0;
    const app = createWebBackend({
      env,
      resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
      fetch: async (url) => {
        if (url.endsWith("/auth/v1/user")) return json({ id: user });
        if (url.endsWith("/final")) return new Response('<img src="https://source.invalid/photo.jpg">', {
          headers: { "Content-Type": "text/html" },
        });
        return new Response(new ReadableStream({ cancel() { canceled++; } }), {
          status: kind === "redirect" ? 302 : 200,
          headers: kind === "image" ? { "Content-Type": "image/jpeg" }
            : kind === "redirect" ? { Location: "https://source.invalid/final" }
              : { "Content-Type": "text/html", "Content-Length": String(3 * 1024 * 1024) },
        });
      },
    });
    const response = await post(app, "materials/import", { url: "https://source.invalid/start", authorized: true });
    assert.equal(response.status, kind === "oversized-page" ? 413 : 200);
    assert.equal(canceled, 1);
  });
}

for (const alreadyCredited of [false, true]) {
  test(`Paddle processing replay settles exactly once after interruption ${alreadyCredited ? "after" : "before"} credit commit`, async () => {
    const db = new PGlite();
    try {
      await db.exec("create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);");
      for (const path of ["schema.sql", "20260904-durable-jobs.sql"])
        await db.exec(await readFile(new URL(`../supabase/${path}`, import.meta.url), "utf8"));
      await db.query("insert into web_users(id,email,credits) values($1,$2,10)", [user, "fixture@example.invalid"]);
      await db.exec("insert into web_billing_events(provider,event_id,event_type,status) values('paddle','evt_fixture','transaction.completed','processing')");
      if (alreadyCredited) await db.query("select web_credit_apply($1,'paddle:txn_fixture',90,'purchase','fixture')", [user]);
      const fetch = async (url, init = {}) => {
        const parsed = new URL(url), body = init.body ? JSON.parse(init.body) : {};
        if (parsed.pathname.endsWith("/web_billing_events")) {
          if (init.method === "POST") return json({ message: "duplicate" }, 409);
          if (init.method === "PATCH") return json((await db.query("update web_billing_events set status=$1 where event_id='evt_fixture' returning *", [body.status])).rows);
          return json((await db.query("select status from web_billing_events where event_id='evt_fixture'")).rows);
        }
        if (parsed.pathname.endsWith("/web_users"))
          return json((await db.query("select * from web_users where id=$1", [user])).rows);
        if (parsed.pathname.endsWith("/rpc/web_credit_apply"))
          return json((await db.query("select web_credit_apply($1,$2,$3,$4,$5) as value", [body.p_user_id, body.p_reference_id, body.p_amount, body.p_type, body.p_description])).rows[0].value);
        throw new Error("Unexpected fixture request");
      };
      const settings = { ...env, WEB_DURABLE_JOBS: "true", WEB_PADDLE_PRICE_CREDITS_JSON: JSON.stringify({ pri_fixture: { credits: 90 } }) };
      const payload = { event_id: "evt_fixture", event_type: "transaction.completed", data: { id: "txn_fixture", custom_data: { user_id: user }, items: [{ price: { id: "pri_fixture" } }] } };
      const raw = JSON.stringify(payload), ts = Math.floor(Date.now() / 1000);
      const signature = createHmac("sha256", "fixture").update(`${ts}:${raw}`).digest("hex");
      const deliver = () => post(createWebBackend({ env: settings, fetch }), "billing/paddle/webhook", payload, {
        headers: { "Paddle-Signature": `ts=${ts};h1=${signature}` },
      });
      const responses = await Promise.all([deliver(), deliver()]);
      for (const response of responses) assert.equal(response.status, 200);
      const replies = await Promise.all(responses.map((response) => response.json()));
      assert.equal(replies.reduce((sum, reply) => sum + (reply.credited || 0), 0), alreadyCredited ? 0 : 90);
      assert.equal((await db.query("select credits from web_users")).rows[0].credits, 100);
      assert.equal((await db.query("select count(*)::integer as count from web_credit_transactions")).rows[0].count, 1);
      assert.equal((await db.query("select status from web_billing_events")).rows[0].status, "processed");
      assert.equal((await (await deliver()).json()).duplicate, true);
    } finally {
      await db.close();
    }
  });
}
