import assert from "node:assert/strict";
import test from "node:test";
import {
  getMissingEnvironmentGuidance,
  getExpectedBackendCommit,
  isLiveCommitCompatible,
  partitionMissingEnvironment,
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
});

test("production check treats manual top-up key as optional", () => {
  assert.deepEqual(
    partitionMissingEnvironment([
      "internalBillingKey",
      "paddleWebhookSecret",
      "imageApiBaseUrl",
    ]),
    {
      required: ["paddleWebhookSecret", "imageApiBaseUrl"],
      optional: ["internalBillingKey"],
    },
  );
});
