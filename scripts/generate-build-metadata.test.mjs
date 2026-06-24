import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createBuildMetadata,
  getGitCommit,
  writeBuildMetadata,
} from "./generate-build-metadata.mjs";

test("build metadata records the web service commit", () => {
  assert.deepEqual(
    createBuildMetadata({
      commit: "commit-1",
      builtAt: "2026-06-24T00:00:00.000Z",
    }),
    {
      service: "kroma-web",
      commit: "commit-1",
      built_at: "2026-06-24T00:00:00.000Z",
    },
  );
});

test("git commit lookup falls back when git is unavailable", () => {
  assert.equal(
    getGitCommit(() => {
      throw new Error("git unavailable");
    }),
    "unknown",
  );
});

test("build metadata writes a version file for static deployment checks", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "kroma-version-"));
  const outputPath = join(tempDir, "public", "version.json");

  try {
    const metadata = writeBuildMetadata({
      outputPath,
      execFile: () => "commit-2\n",
      builtAt: "2026-06-24T01:00:00.000Z",
    });

    assert.equal(metadata.commit, "commit-2");
    assert.deepEqual(JSON.parse(readFileSync(outputPath, "utf8")), {
      service: "kroma-web",
      commit: "commit-2",
      built_at: "2026-06-24T01:00:00.000Z",
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
