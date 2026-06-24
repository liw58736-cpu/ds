import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createWebBackend } from "./app.mjs";

const app = createWebBackend();
const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const currentDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(currentDir, "../..", "..");
const staticRoot = resolve(process.env.WEB_STATIC_ROOT ?? join(repoRoot, "dist"));

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

const server = createServer(async (request, response) => {
  if (await tryServeStaticAsset(request, response)) {
    return;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  const host = request.headers.host ?? `127.0.0.1:${port}`;
  const url = new URL(request.url ?? "/", `http://${host}`);
  const webRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body,
    duplex: body ? "half" : undefined,
  });
  const webResponse = await app.handle(webRequest);

  response.writeHead(
    webResponse.status,
    Object.fromEntries(webResponse.headers.entries()),
  );
  if (webResponse.body) {
    response.end(Buffer.from(await webResponse.arrayBuffer()));
  } else {
    response.end();
  }
});

server.listen(port, () => {
  console.log(`kroma web backend listening on ${port}`);
});

async function tryServeStaticAsset(request, response) {
  if (!["GET", "HEAD"].includes(request.method ?? "")) {
    return false;
  }

  const host = request.headers.host ?? `127.0.0.1:${port}`;
  const url = new URL(request.url ?? "/", `http://${host}`);

  if (url.pathname.startsWith("/api/") || !existsSync(staticRoot)) {
    return false;
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
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return true;
  }

  const assetPath = await getReadableAssetPath(resolvedCandidate);

  if (!assetPath) {
    return false;
  }

  response.writeHead(200, {
    "Content-Type":
      contentTypes.get(extname(assetPath).toLowerCase()) ??
      "application/octet-stream",
    "Cache-Control": assetPath.endsWith("index.html")
      ? "no-store"
      : "public, max-age=31536000, immutable",
  });

  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  createReadStream(assetPath).pipe(response);
  return true;
}

async function getReadableAssetPath(candidate) {
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
