import { execFileSync } from "node:child_process";

const apiBaseUrl =
  process.env.KROMA_WEB_API_BASE_URL || "https://kroma-web-api.onrender.com/api/v1";
const healthUrl = `${apiBaseUrl.replace(/\/+$/, "")}/health`;

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
  const commitMatches =
    Boolean(localCommit) && liveCommit.toLowerCase().startsWith(localCommit.toLowerCase());
  printStatus("local commit", Boolean(localCommit), localCommit ?? "unavailable");
  printStatus("live commit", Boolean(liveCommit), liveCommit || "missing");
  printStatus("deployed current commit", commitMatches);

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

main().catch((error) => {
  console.error(`CHECK production health failed: ${error.message}`);
  process.exitCode = 1;
});
