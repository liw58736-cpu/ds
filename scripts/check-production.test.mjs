import assert from "node:assert/strict";
import test from "node:test";
import { getExpectedBackendCommit } from "./check-production.mjs";

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
