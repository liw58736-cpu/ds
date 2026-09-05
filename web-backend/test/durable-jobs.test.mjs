import test from "node:test";
import assert from "node:assert/strict";
import { createDurableJobs } from "../src/durable-jobs.mjs";
import { createWebBackend } from "../src/app.mjs";

test("an interrupted batch retains finished images and exposes only missing modules for retry", async () => {
  let requested;
  const jobs = createDurableJobs({
    env: { WEB_DURABLE_JOBS: "true", WEB_SUPABASE_URL: "https://fixture.invalid" },
    router: {},
    fetch: async (url) => {
      requested = new URL(url);
      return new Response(JSON.stringify([{
        id: "child-0", user_id: "A", group_id: "group", status: "done", cost: 1,
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:01:00Z",
        result: { image_url: "https://fixture.invalid/result.png" },
        payload: { context: {
          index: 0, total: 2, label: "首屏 KV", product: {},
          config: { module: "main_image", selectedMainModules: ["hero_kv", "overall_show"] },
        } },
      }]));
    },
  });
  const [task] = await jobs.list("A", 1, 0, "group");
  assert.equal(requested.searchParams.get("user_id"), "eq.A");
  assert.equal(requested.searchParams.get("group_id"), "eq.group");
  assert.equal(task.status, "partial");
  assert.equal(task.creditCost, 1);
  assert.equal(task.resultUrls.length, 1);
  assert.equal(task.failedItems.length, 1);
  assert.deepEqual(task.failedItems[0].config.selectedMainModules, ["overall_show"]);
});

test("durable job flow saves before work, reuses request id, and reads across a process restart", async () => {
  const rows = new Map();
  const calls = [];
  let executes = 0;
  const env = {
    WEB_DURABLE_JOBS: "true",
    WEB_SUPABASE_URL: "https://fixture.invalid",
    WEB_SUPABASE_SERVICE_ROLE_KEY: "fixture",
  };
  const fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const body = init.body ? JSON.parse(init.body) : {};
    calls.push(path);
    let result;
    if (path.endsWith("web_job_reserve")) {
      result = [...rows.values()].find(
        (row) => row.request_id === body.p_request_id,
      );
      if (!result) {
        result = {
          id: body.p_id,
          user_id: body.p_user_id,
          request_id: body.p_request_id,
          group_id: body.p_group_id,
          payload: body.p_payload,
          cost: body.p_cost,
          status: "queued",
        };
        rows.set(result.id, result);
      }
    } else if (path.endsWith("web_job_claim")) {
      const row = rows.get(body.p_id);
      if (row.status !== "queued") result = null;
      else {
        row.status = "processing";
        result = { ...row };
      }
    } else if (path.endsWith("web_job_finish")) {
      const row = rows.get(body.p_id);
      Object.assign(row, {
        status: body.p_status,
        result: body.p_result,
        settled: true,
      });
      result = row;
    } else {
      const query = new URL(url).searchParams;
      result = [...rows.values()].filter(
        (row) =>
          `eq.${row.user_id}` === query.get("user_id") &&
          `eq.${row.id}` === query.get("id"),
      );
    }
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const router = {
    execute: async () => {
      executes++;
      return {
        status: "done",
        image_url: "https://storage.invalid/stable.png",
      };
    },
    cancel: () => true,
  };
  const jobs = createDurableJobs({ env, fetch, router });
  const body = {
    quality: "standard",
    context: {
      requestId: "group:1:0",
      groupId: "group",
      total: 1,
      index: 0,
      config: { module: "main_image" },
      product: { imageUrl: "https://fixture.invalid/input.png" },
    },
  };
  const first = await jobs.submit("A", body);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = await jobs.submit("A", body);
  assert.equal(first.task_id, second.task_id);
  assert.equal(executes, 1);
  assert.ok(
    calls.findIndex((path) => path.endsWith("web_job_reserve")) <
      calls.findIndex((path) => path.endsWith("web_job_claim")),
  );
  const restarted = createDurableJobs({ env, fetch, router });
  assert.equal(
    (await restarted.get("A", first.task_id)).image_url,
    "https://storage.invalid/stable.png",
  );
  assert.equal(await restarted.get("B", first.task_id), null);
  assert.equal(await restarted.cancel("B", first.task_id), null);
});

test("existing in-memory tasks cannot be read or cancelled by another account", async () => {
  const app = createWebBackend({
    env: {
      WEB_SUPABASE_URL: "https://fixture.invalid",
      WEB_SUPABASE_ANON_KEY: "fixture",
      RIGHTCODE_BASE_URL: "https://provider.invalid",
      RIGHTCODE_KEY_1: "fixture",
    },
    fetch: async (url, init = {}) => {
      if (url.endsWith("/auth/v1/user"))
        return new Response(
          JSON.stringify({
            id: new Headers(init.headers).get("Authorization"),
            email: "a@example.invalid",
          }),
        );
      return new Promise(() => {});
    },
  });
  const generated = await app.handle(
    new Request("http://fixture/api/v1/image/generate", {
      method: "POST",
      headers: { Authorization: "Bearer A" },
      body: JSON.stringify({ prompt: "test", quality: "standard" }),
    }),
  );
  const { task_id } = await generated.json();
  for (const suffix of ["", "/cancel"]) {
    const response = await app.handle(
      new Request(`http://fixture/api/v1/image/task/${task_id}${suffix}`, {
        method: suffix ? "POST" : "GET",
        headers: { Authorization: "Bearer B" },
      }),
    );
    assert.equal(response.status, 404);
  }
});
