import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createWebBackend } from "./app.mjs";
import { resolveStaticAsset } from "./static-assets.mjs";

const app = createWebBackend();
const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const currentDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(currentDir, "../..", "..");
const staticRoot = resolve(process.env.WEB_STATIC_ROOT ?? join(repoRoot, "dist"));

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
  const asset = await resolveStaticAsset(request, { staticRoot, port });

  if (!asset.handled) {
    return false;
  }

  response.writeHead(asset.status, asset.headers);

  if (asset.body || !asset.filePath) {
    response.end(asset.body);
    return true;
  }

  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  createReadStream(asset.filePath).pipe(response);
  return true;
}
