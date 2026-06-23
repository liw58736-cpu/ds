import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const apiBaseUrl =
  process.env.KROMA_WEB_API_BASE_URL || "https://kroma-web-api.onrender.com/api/v1";
const healthUrl = `${apiBaseUrl.replace(/\/+$/, "")}/health`;

export function getExpectedBackendCommit(execFile = execFileSync) {
  try {
    return execFile(
      "git",
      [
        "log",
        "-1",
        "--format=%H",
        "--",
        "web-backend",
        "render.yaml",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
  } catch {
    return null;
  }
}

export function isLiveCommitCompatible(
  expectedBackendCommit,
  liveCommit,
  execFile = execFileSync,
) {
  const expected = String(expectedBackendCommit ?? "").trim().toLowerCase();
  const live = String(liveCommit ?? "").trim().toLowerCase();

  if (!expected || !live) {
    return false;
  }

  if (live.startsWith(expected)) {
    return true;
  }

  try {
    execFile("git", ["merge-base", "--is-ancestor", expected, live], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

function getLocalCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function printStatus(label, ok, detail = "") {
  const marker = ok ? "OK" : "CHECK";
  console.log(`${marker} ${label}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  const localCommit = getLocalCommit();
  const expectedBackendCommit = getExpectedBackendCommit();
  const response = await fetch(healthUrl);
  const payload = await response.json();

  console.log(`Kroma web API health: ${healthUrl}`);
  printStatus("HTTP health request", response.ok, `${response.status}`);

  if (!("commit" in payload)) {
    printStatus(
      "backend deployment",
      false,
      "live service is still on the old health format; redeploy kroma-web-api",
    );
    process.exitCode = 1;
    return;
  }

  const liveCommit = String(payload.commit ?? "");
  const commitMatches = isLiveCommitCompatible(
    expectedBackendCommit,
    liveCommit,
  );
  printStatus("local commit", Boolean(localCommit), localCommit ?? "unavailable");
  printStatus(
    "expected backend commit",
    Boolean(expectedBackendCommit),
    expectedBackendCommit ?? "unavailable",
  );
  printStatus("live commit", Boolean(liveCommit), liveCommit || "missing");
  printStatus("deployed backend commit", commitMatches);

  const missing = Array.isArray(payload.missing) ? payload.missing : [];
  printStatus("required environment", missing.length === 0, missing.join(", ") || "complete");

  const database = payload.database && typeof payload.database === "object" ? payload.database : {};
  const failedTables = Object.entries(database)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  printStatus("required Supabase tables", failedTables.length === 0, failedTables.join(", ") || "complete");

  if (!payload.ok || !commitMatches || missing.length > 0 || failedTables.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`CHECK production health failed: ${error.message}`);
    process.exitCode = 1;
  });
}
