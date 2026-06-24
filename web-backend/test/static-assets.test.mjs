import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { resolveStaticAsset } from "../src/static-assets.mjs";

async function withStaticRoot(callback) {
  const staticRoot = await mkdtemp(join(tmpdir(), "kroma-static-"));

  try {
    await writeFile(join(staticRoot, "index.html"), "<!doctype html>");
    await writeFile(join(staticRoot, "version.json"), '{"commit":"test"}');
    await callback(staticRoot);
  } finally {
    await rm(staticRoot, { force: true, recursive: true });
  }
}

test("static asset resolver serves the frontend index at root", async () => {
  await withStaticRoot(async (staticRoot) => {
    const asset = await resolveStaticAsset(
      new Request("http://local.test/"),
      { staticRoot, port: 8010 },
    );

    assert.equal(asset.handled, true);
    assert.equal(asset.status, 200);
    assert.equal(asset.filePath, join(staticRoot, "index.html"));
    assert.equal(asset.headers["Content-Type"], "text/html; charset=utf-8");
    assert.equal(asset.headers["Cache-Control"], "no-store");
  });
});

test("static asset resolver serves build metadata as JSON", async () => {
  await withStaticRoot(async (staticRoot) => {
    const asset = await resolveStaticAsset(
      new Request("http://local.test/version.json"),
      { staticRoot, port: 8010 },
    );

    assert.equal(asset.handled, true);
    assert.equal(asset.status, 200);
    assert.equal(asset.filePath, join(staticRoot, "version.json"));
    assert.equal(asset.headers["Content-Type"], "application/json; charset=utf-8");
  });
});

test("static asset resolver leaves API requests for the backend app", async () => {
  await withStaticRoot(async (staticRoot) => {
    const asset = await resolveStaticAsset(
      new Request("http://local.test/api/v1/health"),
      { staticRoot, port: 8010 },
    );

    assert.deepEqual(asset, { handled: false });
  });
});

test("static asset resolver falls back to index for client routes", async () => {
  await withStaticRoot(async (staticRoot) => {
    const asset = await resolveStaticAsset(
      new Request("http://local.test/account"),
      { staticRoot, port: 8010 },
    );

    assert.equal(asset.handled, true);
    assert.equal(asset.filePath, join(staticRoot, "index.html"));
  });
});

test("static asset resolver rejects paths outside the static root", async () => {
  await withStaticRoot(async (staticRoot) => {
    const asset = await resolveStaticAsset(
      new Request("http://local.test/..%5csecret.txt"),
      { staticRoot, port: 8010 },
    );

    assert.deepEqual(asset, {
      handled: true,
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Forbidden",
    });
  });
});
