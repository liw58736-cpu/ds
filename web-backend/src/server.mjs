import { createServer } from "node:http";

import { createWebBackend } from "./app.mjs";

const app = createWebBackend();
const port = Number.parseInt(process.env.PORT ?? "8080", 10);

const server = createServer(async (request, response) => {
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
