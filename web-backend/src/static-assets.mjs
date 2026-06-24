import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, relative, resolve } from "node:path";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

export async function resolveStaticAsset(request, { staticRoot, port }) {
  if (!["GET", "HEAD"].includes(request.method ?? "")) {
    return { handled: false };
  }

  const host = request.headers.host ?? `127.0.0.1:${port}`;
  const url = new URL(request.url ?? "/", `http://${host}`);

  if (url.pathname.startsWith("/api/") || !existsSync(staticRoot)) {
    return { handled: false };
  }

  const requestedPath =
    url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const candidate = normalize(join(staticRoot, requestedPath));
  const resolvedCandidate = resolve(candidate);
  const relativeCandidate = relative(staticRoot, resolvedCandidate);

  if (
    relativeCandidate.startsWith("..") ||
    relativeCandidate === ".." ||
    resolve(relativeCandidate) === relativeCandidate
  ) {
    return {
      handled: true,
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Forbidden",
    };
  }

  const assetPath = await getReadableAssetPath(resolvedCandidate, staticRoot);

  if (!assetPath) {
    return { handled: false };
  }

  return {
    handled: true,
    status: 200,
    headers: {
      "Content-Type":
        contentTypes.get(extname(assetPath).toLowerCase()) ??
        "application/octet-stream",
      "Cache-Control": assetPath.endsWith("index.html")
        ? "no-store"
        : "public, max-age=31536000, immutable",
    },
    filePath: assetPath,
  };
}

async function getReadableAssetPath(candidate, staticRoot) {
  try {
    const info = await stat(candidate);

    if (info.isFile()) {
      return candidate;
    }
  } catch {
    // Fall through to SPA fallback below.
  }

  const indexPath = join(staticRoot, "index.html");

  try {
    const info = await stat(indexPath);
    return info.isFile() ? indexPath : null;
  } catch {
    return null;
  }
}
