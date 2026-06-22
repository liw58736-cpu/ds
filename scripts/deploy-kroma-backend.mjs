import { cp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = path.join(repoRoot, "dist");
const defaultTarget = "F:\\ai\u56fe\u50cf\u751f\u6210app\\backend\\static\\site";
const targetDir = path.resolve(
  process.env.KROMA_BACKEND_SITE_DIR?.trim() || defaultTarget,
);

function assertSafeTarget(target) {
  const normalized = target.toLowerCase();
  const requiredSuffix = path.normalize("backend/static/site").toLowerCase();

  if (!normalized.endsWith(requiredSuffix)) {
    throw new Error(
      `Refusing to deploy outside a backend/static/site directory: ${target}`,
    );
  }
}

async function assertDirectory(directory, label) {
  const stats = await stat(directory);

  if (!stats.isDirectory()) {
    throw new Error(`${label} is not a directory: ${directory}`);
  }
}

await assertDirectory(distDir, "Frontend build output");
await assertBackendApiBase(distDir);
assertSafeTarget(targetDir);

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });
await cp(distDir, targetDir, { recursive: true });

console.log(`Deployed frontend build to ${targetDir}`);

async function assertBackendApiBase(buildDirectory) {
  const assetsDir = path.join(buildDirectory, "assets");
  const files = await readdir(assetsDir);
  const jsFiles = files.filter((file) => file.endsWith(".js"));

  for (const jsFile of jsFiles) {
    const contents = await readFile(path.join(assetsDir, jsFile), "utf8");

    if (contents.includes("/api/v1")) {
      return;
    }
  }

  throw new Error(
    "Frontend build is missing VITE_KROMA_API_BASE_URL=/api/v1. Refusing to deploy a frontend that cannot call the bundled backend.",
  );
}
