import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";
import { PGlite } from "@electric-sql/pglite";
import { createWebBackend } from "../src/app.mjs";
import { createDurableJobs } from "../src/durable-jobs.mjs";
import { createImageRouter } from "../src/image-router.mjs";

const user = "00000000-0000-0000-0000-000000000001";
const remoteUrl = "https://source.invalid/result.png";
const storedPrefix = "https://db.invalid/storage/v1/object/public/web-generation-results/";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function gate() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
async function until(check) {
  for (let i = 0; i < 500; i++) {
    const value = await check();
    if (value) return value;
    await setImmediate();
  }
  throw new Error("Fixture did not reach the expected state");
}
const input = (id) => ({
  prompt: "retain product", quality: "standard", task_type: "ecommerce",
  context: { requestId: id, groupId: id, index: 0, total: 1,
    product: { imageUrl: "https://source.invalid/product.png" }, config: { module: "main_image" } },
});
async function fixture(t, options = {}) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);");
  for (const path of ["schema.sql", "20260904-durable-jobs.sql"])
    await db.exec(await readFile(new URL(`../supabase/${path}`, import.meta.url), "utf8"));
  await db.query("insert into web_users(id,email,credits) values($1,'fixture@example.invalid',10)", [user]);
  const env = {
    WEB_SUPABASE_URL: "https://db.invalid", WEB_SUPABASE_ANON_KEY: "fixture", WEB_SUPABASE_SERVICE_ROLE_KEY: "fixture",
    WEB_DURABLE_JOBS: options.durable === false ? "false" : "true",
    RIGHTCODE_BASE_URL: "https://provider.invalid/v1", RIGHTCODE_KEY_1: "fixture", RIGHTCODE_CONCURRENT: "1",
  };
  const calls = { provider: 0, upload: 0, download: 0, finish: [] };
  const fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/auth/v1/user") return json({ id: user, email: "fixture@example.invalid" });
    if (parsed.hostname === "provider.invalid") {
      calls.provider++;
      return options.provider ? options.provider(init, calls.provider) : json({ data: [{ url: remoteUrl }] });
    }
    if (url === remoteUrl) {
      calls.download++;
      return options.download ? options.download(init) : new Response(png, { headers: { "Content-Type": "image/png" } });
    }
    if (parsed.pathname === "/storage/v1/bucket") return json({ message: "exists" }, 409);
    if (parsed.pathname.startsWith("/storage/v1/object/")) {
      calls.upload++;
      assert.match(parsed.pathname, new RegExp("/" + user + "/web-img-"));
      return options.upload ? options.upload(init) : json({ saved: true });
    }
    if (parsed.pathname.endsWith("/web_users")) return json((await db.query("select * from web_users where id=$1", [user])).rows);
    if (parsed.pathname.includes("/rpc/")) {
      const name = parsed.pathname.split("/").at(-1), args = JSON.parse(init.body);
      assert.ok(["web_job_reserve", "web_job_claim", "web_job_finish", "web_job_history"].includes(name));
      if (name === "web_job_finish") { calls.finish.push(args.p_status); await options.beforeFinish?.(args); }
      const query = "select " + name + "(" + Object.keys(args).map((key, i) => key + " := $" + (i + 1)).join(",") + ") as value";
      let result = (await db.query(query, Object.values(args).map((v) => typeof v === "object" ? JSON.stringify(v) : v))).rows[0].value;
      if (name === "web_job_claim" && result) {
        if (options.leaseMs) {
          result.lease_until = new Date(Date.now() + options.leaseMs).toISOString();
          await db.query("update web_image_jobs set lease_until=$1 where id=$2", [result.lease_until, result.id]);
        }
        await options.afterClaim?.(result);
      }
      return json(result);
    }
    if (parsed.pathname.endsWith("/web_image_jobs")) {
      const id = parsed.searchParams.get("id")?.slice(3), owner = parsed.searchParams.get("user_id")?.slice(3);
      return json((await db.query("select * from web_image_jobs where ($1::text is null or id=$1) and ($2::uuid is null or user_id=$2) order by created_at", [id || null, owner || null])).rows);
    }
    throw new Error("Unexpected fixture request " + parsed.pathname);
  };
  const router = createImageRouter({ env, fetch });
  const jobs = createDurableJobs({ env, fetch, router });
  const app = createWebBackend({ env, fetch });
  const balance = async () => (await db.query("select credits,reserved_credits from web_users")).rows[0];
  const row = async (id) => (await db.query("select * from web_image_jobs where id=$1", [id])).rows[0];
  const completed = (id) => until(async () => { const value = await row(id); return value?.settled && value; });
  const create = async () => (await app.handle(new Request("http://local/api/v1/image/generate", {
    method: "POST", headers: { Authorization: "Bearer fixture" }, body: JSON.stringify(input("http-fixture")),
  }))).json();
  const poll = async (id) => (await app.handle(new Request(`http://local/api/v1/image/task/${id}`, { headers: { Authorization: "Bearer fixture" } }))).json();
  return { db, env, fetch, router, jobs, app, calls, balance, row, completed, create, poll };
}

test("canceling a queued durable job prevents supplier work and releases only its reservation", async (t) => {
  const first = gate();
  const f = await fixture(t, { provider: async () => { await first.promise; return json({ data: [{ url: storedPrefix + "stable.png" }] }); } });
  const a = await f.jobs.submit(user, input("first"));
  await until(() => f.calls.provider === 1);
  const b = await f.jobs.submit(user, input("second"));
  await until(() => f.router.get(b.task_id)?.progress === "排队中");
  assert.deepEqual(await f.jobs.cancel(user, b.task_id), { canceled: true });
  first.resolve();
  await f.completed(a.task_id);
  await f.completed(b.task_id);
  assert.equal(f.calls.provider, 1);
  assert.deepEqual(await f.balance(), { credits: 9, reserved_credits: 0 });
});

test("canceling while the claim response is in flight prevents execution", async (t) => {
  const claimed = gate(), release = gate();
  const f = await fixture(t, { afterClaim: async () => { claimed.resolve(); await release.promise; } });
  const task = await f.jobs.submit(user, input("claim-race"));
  await claimed.promise;
  assert.equal((await f.jobs.cancel(user, task.task_id)).canceled, true);
  release.resolve();
  await until(() => f.calls.finish.length >= 2);
  await f.completed(task.task_id);
  assert.equal(f.calls.provider, 0);
  assert.deepEqual(await f.balance(), { credits: 10, reserved_credits: 0 });
});

test("expired active work is aborted and late supplier results cannot charge credits", async (t) => {
  const late = gate();
  let outboundSignal;
  const f = await fixture(t, { leaseMs: 1000, provider: async (init) => { outboundSignal = init.signal; return late.promise; } });
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.now() });
  const task = await f.jobs.submit(user, input("timeout"));
  await until(() => f.calls.provider === 1);
  t.mock.timers.tick(1001);
  await f.jobs.recover();
  assert.equal(outboundSignal.aborted, true);
  assert.equal((await f.completed(task.task_id)).status, "error");
  late.resolve(json({ data: [{ url: remoteUrl }] }));
  await setImmediate();
  assert.equal(f.calls.download, 0);
  assert.equal(f.calls.upload, 0);
  assert.deepEqual(await f.balance(), { credits: 10, reserved_credits: 0 });
});

test("lease recovery preserves an on-time result waiting for database settlement", async (t) => {
  const settling = gate(), release = gate();
  const f = await fixture(t, { leaseMs: 1000,
    provider: async () => json({ data: [{ url: storedPrefix + "stable.png" }] }),
    beforeFinish: async () => { settling.resolve(); await release.promise; },
  });
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.now() });
  const task = await f.jobs.submit(user, input("on-time"));
  await settling.promise;
  t.mock.timers.tick(1001);
  const recovery = f.jobs.recover();
  const lookup = f.jobs.get(user, task.task_id);
  release.resolve();
  await recovery;
  assert.equal((await lookup).status, "done");
  assert.equal((await f.completed(task.task_id)).status, "done");
  assert.ok(f.calls.finish.every((status) => status === "done"));
  assert.deepEqual(await f.balance(), { credits: 9, reserved_credits: 0 });
});

test("compatibility mode waits for stable storage before exposing done", async (t) => {
  const uploading = gate(), release = gate();
  const f = await fixture(t, { durable: false, upload: async () => { uploading.resolve(); await release.promise; return json({ saved: true }); } });
  const task = await f.create();
  await uploading.promise;
  assert.equal((await f.poll(task.task_id)).status, "processing");
  release.resolve();
  const done = await until(async () => { const value = await f.poll(task.task_id); return value.status === "done" && value; });
  assert.equal(done.image_url, storedPrefix + user + "/" + task.task_id + "/result.png");
  assert.equal(done.image_base64, null);
  await f.poll(task.task_id);
  assert.equal(f.calls.provider, 1);
  assert.equal(f.calls.upload, 1);
});

for (const durable of [false, true]) {
  test(`storage failure returns error without charge with durable=${durable}`, async (t) => {
    const f = await fixture(t, { durable, upload: async () => json({ message: "fixture storage outage" }, 503) });
    const task = await f.create();
    const failed = await until(async () => { const value = await f.poll(task.task_id); return value.status === "error" && value; });
    assert.match(failed.error, /result_image_upload_failed.*fixture storage outage/);
    assert.ok(!failed.image_url);
    assert.ok(!failed.image_base64);
    assert.deepEqual(await f.balance(), { credits: 10, reserved_credits: 0 });
    assert.equal((await f.db.query("select count(*)::integer as count from web_credit_transactions")).rows[0].count, 0);
  });
}

test("remote result streaming stops at 20 MiB without an upload", async (t) => {
  let pulls = 0, canceled = false;
  const f = await fixture(t, { durable: false, download: async () => new Response(new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { canceled = true; },
  }), { headers: { "Content-Type": "image/png" } }) });
  const task = await f.create();
  const failed = await until(async () => { const value = await f.poll(task.task_id); return value.status === "error" && value; });
  assert.match(failed.error, /result_image_invalid_size/);
  assert.equal(canceled, true);
  assert.ok(pulls <= 22);
  assert.equal(f.calls.upload, 0);
});

test("compatibility result storage has a bounded deadline even if an upload hangs", async (t) => {
  const uploading = gate();
  let outboundSignal;
  const f = await fixture(t, { durable: false, upload: async (init) => { outboundSignal = init.signal; uploading.resolve(); return new Promise(() => {}); } });
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.now() });
  const task = await f.create();
  await uploading.promise;
  t.mock.timers.tick(90001);
  const failed = await until(async () => { const value = await f.poll(task.task_id); return value.status === "error" && value; });
  assert.match(failed.error, /result_storage_timeout/);
  assert.equal(outboundSignal.aborted, true);
  assert.deepEqual(await f.balance(), { credits: 10, reserved_credits: 0 });
});

test("canceling during storage cannot be overwritten by a late successful upload", async (t) => {
  const uploading = gate(), release = gate();
  const f = await fixture(t, { upload: async () => { uploading.resolve(); await release.promise; return json({ saved: true }); } });
  const task = await f.jobs.submit(user, input("storage-cancel"));
  await uploading.promise;
  assert.equal((await f.jobs.cancel(user, task.task_id)).canceled, true);
  release.resolve();
  assert.equal((await f.completed(task.task_id)).status, "error");
  await setImmediate();
  assert.deepEqual(await f.balance(), { credits: 10, reserved_credits: 0 });
});

for (const uploadFails of [false, true]) {
  test(`compatibility proxy completion also requires stable storage, failure=${uploadFails}`, async () => {
    let uploads = 0;
    const app = createWebBackend({
      env: { WEB_SUPABASE_URL: "https://db.invalid", WEB_SUPABASE_ANON_KEY: "fixture", WEB_SUPABASE_SERVICE_ROLE_KEY: "fixture", WEB_IMAGE_API_BASE_URL: "https://upstream.invalid", WEB_DURABLE_JOBS: "false" },
      fetch: async (url) => {
        if (url.endsWith("/auth/v1/user")) return json({ id: user });
        if (url.startsWith("https://upstream.invalid/")) return json({ task_id: "proxy-result", status: "done", image_url: remoteUrl });
        if (url === remoteUrl) return new Response(png, { headers: { "Content-Type": "image/png" } });
        if (url.endsWith("/storage/v1/bucket")) return json({ message: "exists" }, 409);
        if (url.includes("/storage/v1/object/")) {
          uploads++;
          return json(uploadFails ? { message: "storage unavailable" } : { saved: true }, uploadFails ? 503 : 200);
        }
        throw new Error("Unexpected fixture request");
      },
    });
    const response = await app.handle(new Request("http://local/api/v1/image/task/proxy-result", { headers: { Authorization: "Bearer fixture" } }));
    const result = await response.json();
    assert.equal(result.status, uploadFails ? "error" : "done");
    assert.equal(result.image_url, uploadFails ? null : storedPrefix + user + "/proxy-result/result.png");
    assert.equal(uploads, 1);
  });
}
