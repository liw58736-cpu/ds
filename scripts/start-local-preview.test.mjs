import assert from "node:assert/strict";
import test from "node:test";
import {
  createNpmCommand,
  parsePreviewPort,
} from "./start-local-preview.mjs";

test("parsePreviewPort uses 8000 by default and accepts valid env ports", () => {
  assert.equal(parsePreviewPort({}), 8000);
  assert.equal(parsePreviewPort({ PORT: "8099" }), 8099);
});

test("parsePreviewPort ignores invalid env ports", () => {
  assert.equal(parsePreviewPort({ PORT: "abc" }), 8000);
  assert.equal(parsePreviewPort({ PORT: "0" }), 8000);
  assert.equal(parsePreviewPort({ PORT: "70000" }), 8000);
});

test("createNpmCommand avoids argument concatenation on non-Windows shells", () => {
  assert.deepEqual(createNpmCommand(["run", "build"], { isWindows: false }), {
    command: "npm",
    args: ["run", "build"],
    shell: false,
  });
});

test("createNpmCommand uses fixed Windows command strings without dynamic args", () => {
  assert.deepEqual(createNpmCommand(["run", "build"], { isWindows: true }), {
    command: "npm run build",
    args: [],
    shell: true,
  });
});
