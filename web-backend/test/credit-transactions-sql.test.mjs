import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createWebBackend } from "../src/app.mjs";

test("PostgreSQL migration preserves balances and atomically reserves, releases and settles exactly once", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);`);
    await db.exec(
      await readFile(
        new URL("../supabase/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    const user = "00000000-0000-0000-0000-000000000001";
    await db.query("insert into web_users(id,email,credits) values($1,$2,10)", [
      user,
      "test@example.invalid",
    ]);
    const migration = await readFile(
      new URL("../supabase/20260904-durable-jobs.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    const balance = async () =>
      (
        await db.query(
          "select credits,reserved_credits from web_users where id=$1",
          [user],
        )
      ).rows[0];
    assert.deepEqual(await balance(), { credits: 10, reserved_credits: 0 });
    const reserve = (id, cost) =>
      db.query("select web_job_reserve($1,$2,$1,$3,$4::jsonb,$5)", [
        id,
        user,
        "group",
        JSON.stringify({ context: { label: "测试图" } }),
        cost,
      ]);
    await reserve("job-A", 4);
    await reserve("job-A", 4);
    assert.deepEqual(await balance(), { credits: 10, reserved_credits: 4 });
    await assert.rejects(reserve("too-expensive", 7), /insufficient_credits/);
    assert.deepEqual(await balance(), { credits: 10, reserved_credits: 4 });
    await db.query("select web_job_claim($1,$2)", ["job-A", user]);
    const finish = (id, status, result) =>
      db.query("select web_job_finish($1,$2,$3,$4::jsonb)", [
        id,
        user,
        status,
        JSON.stringify(result),
      ]);
    await assert.rejects(finish("job-A", "done", {}), /missing_stored_result/);
    assert.deepEqual(await balance(), { credits: 10, reserved_credits: 4 });
    await finish("job-A", "done", {
      image_url: "https://storage.invalid/a.png",
    });
    await finish("job-A", "done", {
      image_url: "https://storage.invalid/a.png",
    });
    assert.deepEqual(await balance(), { credits: 6, reserved_credits: 0 });
    await reserve("job-B", 2);
    await finish("job-B", "error", { error: "模拟失败" });
    assert.deepEqual(await balance(), { credits: 6, reserved_credits: 0 });
    await Promise.all(
      [1, 2].map(() =>
        db.query("select web_credit_apply($1,$2,100,$3,$4)", [
          user,
          "paddle:txn-1",
          "purchase",
          "测试订单",
        ]),
      ),
    );
    assert.deepEqual(await balance(), { credits: 106, reserved_credits: 0 });
    assert.equal(
      (
        await db.query(
          "select count(*)::integer as count from web_credit_transactions where user_id=$1",
          [user],
        )
      ).rows[0].count,
      2,
    );
    assert.equal(
      (await db.query("select * from web_job_history($1,1,0)", [user])).rows
        .length,
      2,
    );
    const privileges = await db.query(
      `select has_function_privilege('anon','web_job_finish(text,uuid,text,jsonb)','EXECUTE') as anon,has_function_privilege('authenticated','web_credit_apply(uuid,text,integer,text,text)','EXECUTE') as authenticated`,
    );
    assert.deepEqual(privileges.rows[0], { anon: false, authenticated: false });
  } finally {
    await db.close();
  }
});

test("HTTP submission through provider, SQL settlement and restarted HTTP lookup completes without browser billing", async () => {
  const db = new PGlite();
  const user = "00000000-0000-0000-0000-000000000001";
  let providerCalls = 0;
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/20260904-durable-jobs.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.query("insert into web_users(id,email,credits) values($1,$2,5)", [
      user,
      "test@example.invalid",
    ]);
    const env = {
      WEB_DURABLE_JOBS: "true",
      WEB_SUPABASE_URL: "https://db.invalid",
      WEB_SUPABASE_ANON_KEY: "test",
      WEB_SUPABASE_SERVICE_ROLE_KEY: "test",
      RIGHTCODE_BASE_URL: "https://provider.invalid/v1",
      RIGHTCODE_KEY_1: "test",
    };
    const fetch = async (url, init = {}) => {
      const parsed = new URL(url);
      let result;
      if (parsed.pathname.endsWith("/auth/v1/user"))
        result = { id: user, email: "test@example.invalid" };
      else if (parsed.hostname === "provider.invalid") {
        providerCalls++;
        result = {
          data: [
            {
              url: "https://db.invalid/storage/v1/object/public/web-generation-results/stable.png",
            },
          ],
        };
      } else if (parsed.pathname.includes("/rpc/")) {
        const fn = parsed.pathname.split("/").at(-1);
        const params = JSON.parse(init.body);
        const values = Object.values(params);
        const response = await db.query(
          `select public.${fn}(${Object.keys(params)
            .map((key, index) => `${key} := $${index + 1}`)
            .join(",")}) as value`,
          values.map((value) =>
            typeof value === "object" ? JSON.stringify(value) : value,
          ),
        );
        result = response.rows[0].value;
      } else if (parsed.pathname.endsWith("/web_users"))
        result = (await db.query("select * from web_users where id=$1", [user]))
          .rows;
      else if (parsed.pathname.endsWith("/web_image_jobs"))
        result = (
          await db.query(
            "select * from web_image_jobs where user_id=$1 and id=$2",
            [user, parsed.searchParams.get("id").slice(3)],
          )
        ).rows;
      else throw new Error("Unexpected test URL " + url);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    };
    let app = createWebBackend({ env, fetch });
    const body = {
      prompt: "retain product",
      quality: "standard",
      task_type: "ecommerce",
      image_url: "https://source.invalid/photo.png",
      context: {
        requestId: "unique-1",
        groupId: "group",
        index: 0,
        total: 1,
        product: { imageUrl: "https://source.invalid/photo.png" },
        config: { module: "main_image" },
        label: "主图",
      },
    };
    const submit = () =>
      app.handle(
        new Request("http://local/api/v1/image/generate", {
          method: "POST",
          headers: { Authorization: "Bearer test" },
          body: JSON.stringify(body),
        }),
      );
    const created = await submit();
    assert.equal(created.status, 200);
    const task = await created.json();
    let settled;
    for (let i = 0; i < 100; i++) {
      settled = (
        await db.query("select * from web_image_jobs where id=$1", [
          task.task_id,
        ])
      ).rows[0];
      if (settled.settled) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(settled.status, "done");
    assert.equal(settled.settled, true);
    assert.deepEqual(
      (await db.query("select credits,reserved_credits from web_users"))
        .rows[0],
      { credits: 4, reserved_credits: 0 },
    );
    app = createWebBackend({ env, fetch });
    const restored = await app.handle(
      new Request(`http://local/api/v1/image/task/${task.task_id}`, {
        headers: { Authorization: "Bearer test" },
      }),
    );
    assert.equal(
      (await restored.json()).image_url,
      "https://db.invalid/storage/v1/object/public/web-generation-results/stable.png",
    );
    await submit();
    assert.equal(providerCalls, 1);
    const clientDeduct = await app.handle(
      new Request("http://local/api/v1/user/credits/deduct?amount=1", {
        method: "POST",
        headers: { Authorization: "Bearer test" },
      }),
    );
    assert.equal(clientDeduct.status, 409);
    assert.equal(
      (
        await db.query(
          "select count(*)::integer as count from web_credit_transactions",
        )
      ).rows[0].count,
      1,
    );
  } finally {
    await db.close();
  }
});
