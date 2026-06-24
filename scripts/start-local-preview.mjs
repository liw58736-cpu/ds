import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number.parseInt(process.env.PORT ?? "8000", 10);
const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const staticRoot = resolve(repoRoot, "dist");
const isWindows = process.platform === "win32";

async function isPortAvailable(value) {
  return await new Promise((resolveAvailable) => {
    const server = createServer();

    server.once("error", () => resolveAvailable(false));
    server.once("listening", () => {
      server.close(() => resolveAvailable(true));
    });
    server.listen(value, "127.0.0.1");
  });
}

if (!(await isPortAvailable(port))) {
  console.error(
    `Port ${port} is already in use. Stop the existing local service, then run npm run preview:full again.`,
  );
  process.exit(1);
}

const build = isWindows
  ? spawnSync("npm run build", {
      cwd: repoRoot,
      shell: true,
      stdio: "inherit",
    })
  : spawnSync("npm", ["run", "build"], {
      cwd: repoRoot,
      stdio: "inherit",
    });

if (build.status !== 0) {
  if (build.error) {
    console.error(`Failed to run npm build: ${build.error.message}`);
  }
  process.exit(build.status ?? 1);
}

const server = isWindows
  ? spawn("npm start", {
      cwd: resolve(repoRoot, "web-backend"),
      env: {
        ...process.env,
        PORT: String(port),
        WEB_STATIC_ROOT: staticRoot,
      },
      shell: true,
      stdio: "inherit",
    })
  : spawn("npm", ["start"], {
      cwd: resolve(repoRoot, "web-backend"),
      env: {
        ...process.env,
        PORT: String(port),
        WEB_STATIC_ROOT: staticRoot,
      },
      stdio: "inherit",
    });

console.log(`Kroma full local preview: http://127.0.0.1:${port}`);

server.on("error", (error) => {
  console.error(`Failed to start local preview server: ${error.message}`);
  process.exit(1);
});

server.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
