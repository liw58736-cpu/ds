import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const apiBaseUrl =
  process.env.KROMA_WEB_API_BASE_URL || "https://kroma-web-api.onrender.com/api/v1";
const healthUrl = `${apiBaseUrl.replace(/\/+$/, "")}/health`;
const frontendBaseUrl =
  process.env.KROMA_WEB_FRONTEND_URL || "https://kromaai.app";
const frontendVersionUrl = getFrontendVersionUrl(frontendBaseUrl);
const optionalEnvironmentKeys = new Set(["internalBillingKey"]);

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

export function getFrontendVersionUrl(baseUrl) {
  return `${String(baseUrl).replace(/\/+$/, "")}/version.json`;
}

export async function readJsonResponse(response) {
  try {
    return {
      ok: true,
      payload: await response.json(),
    };
  } catch {
    return {
      ok: false,
      payload: {},
    };
  }
}

function printStatus(label, ok, detail = "") {
  const marker = ok ? "OK" : "CHECK";
  console.log(`${marker} ${label}${detail ? `: ${detail}` : ""}`);
}

export function getMissingEnvironmentGuidance(key) {
  const guidanceByKey = {
    internalBillingKey:
      "run npm run secret:internal-billing, then set WEB_INTERNAL_BILLING_KEY on kroma-web-api",
    paddleWebhookSecret:
      "create the Paddle webhook and set WEB_PADDLE_WEBHOOK_SECRET on kroma-web-api",
    imageApiBaseUrl:
      "set WEB_IMAGE_API_BASE_URL to the dedicated web image-generation upstream",
    imageApiKey:
      "set WEB_IMAGE_API_KEY for the dedicated web image-generation upstream",
    paddlePriceCredits:
      "set WEB_PADDLE_PRICE_CREDITS_JSON from render.yaml on kroma-web-api",
  };

  return guidanceByKey[key] ?? "configure this value on kroma-web-api";
}

export function partitionMissingEnvironment(missing) {
  return {
    required: missing.filter((key) => !optionalEnvironmentKeys.has(key)),
    optional: missing.filter((key) => optionalEnvironmentKeys.has(key)),
  };
}

function printMissingGuidance(missing) {
  missing.forEach((key) => {
    console.log(`NEXT ${key}: ${getMissingEnvironmentGuidance(key)}`);
  });
}

async function main() {
  const localCommit = getLocalCommit();
  const expectedBackendCommit = getExpectedBackendCommit();
  const [response, frontendResponse] = await Promise.all([
    fetch(healthUrl),
    fetch(frontendVersionUrl, { cache: "no-store" }),
  ]);
  const backendJson = await readJsonResponse(response);
  const frontendJson = frontendResponse.ok
    ? await readJsonResponse(frontendResponse)
    : { ok: false, payload: {} };
  const payload = backendJson.payload;
  const frontendPayload = frontendJson.payload;

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

  console.log(`Kroma web frontend version: ${frontendVersionUrl}`);
  printStatus("frontend version request", frontendResponse.ok, `${frontendResponse.status}`);
  printStatus(
    "frontend version metadata",
    frontendJson.ok,
    frontendJson.ok ? "valid JSON" : "missing or rewritten to HTML",
  );
  const liveFrontendCommit = String(frontendPayload.commit ?? "");
  const frontendCommitMatches = isLiveCommitCompatible(
    localCommit,
    liveFrontendCommit,
  );
  printStatus(
    "deployed frontend commit",
    frontendCommitMatches,
    liveFrontendCommit || "missing version.json commit",
  );

  const payloadMissing = Array.isArray(payload.missing) ? payload.missing : [];
  const payloadOptionalMissing = Array.isArray(payload.optionalMissing)
    ? payload.optionalMissing
    : [];
  const { required: missing, optional: optionalMissingFromLegacyHealth } =
    partitionMissingEnvironment(payloadMissing);
  const optionalMissing = [
    ...new Set([...optionalMissingFromLegacyHealth, ...payloadOptionalMissing]),
  ];
  printStatus("required environment", missing.length === 0, missing.join(", ") || "complete");
  if (missing.length > 0) {
    printMissingGuidance(missing);
  }
  printStatus(
    "optional environment",
    true,
    optionalMissing.length > 0 ? optionalMissing.join(", ") : "complete",
  );
  if (optionalMissing.length > 0) {
    printMissingGuidance(optionalMissing);
  }

  const database = payload.database && typeof payload.database === "object" ? payload.database : {};
  const failedTables = Object.entries(database)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  printStatus("required Supabase tables", failedTables.length === 0, failedTables.join(", ") || "complete");

  const healthOk =
    payload.ok ||
    (missing.length === 0 && failedTables.length === 0);

  if (
    !healthOk ||
    !commitMatches ||
    !frontendJson.ok ||
    !frontendCommitMatches ||
    missing.length > 0 ||
    failedTables.length > 0
  ) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`CHECK production health failed: ${error.message}`);
    process.exitCode = 1;
  });
}
