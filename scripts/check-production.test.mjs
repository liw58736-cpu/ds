import assert from "node:assert/strict";
import test from "node:test";
import {
  getMissingEnvironmentGuidance,
  getExpectedBackendCommit,
  getFrontendVersionUrl,
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
        "web-backend",
        "render.yaml",
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
  });
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
