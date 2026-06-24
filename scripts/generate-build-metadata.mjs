import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

export function getGitCommit(execFile = execFileSync) {
  try {
    return execFile("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

export function createBuildMetadata({
  commit = getGitCommit(),
  builtAt = new Date().toISOString(),
} = {}) {
  return {
    service: "kroma-web",
    commit,
    built_at: builtAt,
  };
}

export function writeBuildMetadata({
  outputPath = "public/version.json",
  execFile = execFileSync,
  builtAt = new Date().toISOString(),
} = {}) {
  const metadata = createBuildMetadata({
    commit: getGitCommit(execFile),
    builtAt,
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(`${outputPath}`, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return metadata;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputPath = process.argv[2] || "public/version.json";
  writeBuildMetadata({ outputPath });
}
