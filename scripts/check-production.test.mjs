import assert from "node:assert/strict";
import test from "node:test";
import {
  getMissingEnvironmentGuidance,
  getExpectedBackendCommit,
  getExpectedFrontendCommit,
  getFrontendVersionUrl,
  getFrontendVersionGuidance,
  isLiveCommitCompatible,
  partitionMissingEnvironment,
  readJsonResponse,
} from "./check-production.mjs";

test("production check compares the live backend to the latest backend-affecting commit", () => {
  const calls = [];
  const commit = getExpectedBackendCommit((command, args) => {
    calls.push([command, args]);
    return "backend-commit\n";
  });

  assert.equal(commit, "backend-commit");
  assert.deepEqual(calls, [
    [
      "git",
      [
        "log",
        "-1",
        "--format=%H",
        "--",
        "web-backend/src",
        "web-backend/package.json",
        "web-backend/package-lock.json",
        "web-backend/supabase",
        "render.yaml",
      ],
    ],
  ]);
});

test("production check compares the live frontend to the latest frontend-affecting commit", () => {
  const calls = [];
  const commit = getExpectedFrontendCommit((command, args) => {
    calls.push([command, args]);
    return "frontend-commit\n";
  });

  assert.equal(commit, "frontend-commit");
  assert.deepEqual(calls, [
    [
      "git",
      [
        "log",
        "-1",
        "--format=%H",
        "--",
        "src",
        "public",
        "index.html",
        "package.json",
        "package-lock.json",
        "vite.config.ts",
        "tsconfig.json",
        "tsconfig.app.json",
        "tsconfig.node.json",
        "render.yaml",
        "scripts/generate-build-metadata.mjs",
        ":(exclude)**/*.test.ts",
        ":(exclude)**/*.test.tsx",
      ],
    ],
  ]);
});

test("production check accepts a live commit that includes the latest backend commit", () => {
  const calls = [];
  const compatible = isLiveCommitCompatible(
    "backend-commit",
    "frontend-commit",
    (command, args) => {
      calls.push([command, args]);
      return "";
    },
  );

  assert.equal(compatible, true);
  assert.deepEqual(calls, [
    ["git", ["merge-base", "--is-ancestor", "backend-commit", "frontend-commit"]],
  ]);
});

test("production check reads frontend version metadata from the deployed site", () => {
  assert.equal(
    getFrontendVersionUrl("https://kromaai.app/"),
    "https://kromaai.app/version.json",
  );
});

test("production check handles non-json frontend version responses", async () => {
  const result = await readJsonResponse(
    new Response("<!doctype html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }),
  );

  assert.deepEqual(result, {
    ok: false,
    payload: {},
    contentType: "text/html",
    bodyPreview: "<!doctype html>",
  });
});

test("production check explains frontend version HTML rewrites", () => {
  assert.match(
    getFrontendVersionGuidance({
      responseOk: true,
      status: 200,
      contentType: "text/html; charset=utf-8",
      bodyPreview: "<!doctype html><html>",
    }),
    /static frontend service/,
  );
});

test("production check explains empty frontend version responses", () => {
  assert.match(
    getFrontendVersionGuidance({
      responseOk: true,
      status: 200,
      contentType: "application/json",
      bodyPreview: "",
    }),
    /dist\/version\.json/,
  );
});

test("production check explains failed frontend version requests", () => {
  assert.match(
    getFrontendVersionGuidance({
      responseOk: false,
      status: 404,
      contentType: "",
      bodyPreview: "",
    }),
    /HTTP 404/,
  );
});

test("production check explains how to fill remaining production secrets", () => {
  assert.match(
    getMissingEnvironmentGuidance("internalBillingKey"),
    /secret:internal-billing/,
  );
  assert.match(
    getMissingEnvironmentGuidance("paddleWebhookSecret"),
    /Paddle webhook/,
  );
  assert.match(
    getMissingEnvironmentGuidance("imageApiBaseUrl"),
    /WEB_IMAGE_API_BASE_URL/,
  );
  assert.match(
    getMissingEnvironmentGuidance("authCodeSecret"),
    /secret:auth-code/,
  );
});

test("production check treats manual top-up key as optional", () => {
  assert.deepEqual(
    partitionMissingEnvironment([
      "authCodeSecret",
      "internalBillingKey",
      "paddleWebhookSecret",
      "imageApiBaseUrl",
    ]),
    {
      required: ["paddleWebhookSecret", "imageApiBaseUrl"],
      optional: ["authCodeSecret", "internalBillingKey"],
    },
  );
});
