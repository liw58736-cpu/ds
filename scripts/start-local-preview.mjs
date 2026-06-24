import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const staticRoot = resolve(repoRoot, "dist");
const isWindows = process.platform === "win32";

export function parsePreviewPort(env = process.env) {
  const configuredPort = Number.parseInt(env.PORT ?? "", 10);

  return Number.isInteger(configuredPort) &&
    configuredPort > 0 &&
    configuredPort <= 65535
    ? configuredPort
    : 8000;
}

export function createNpmCommand(
  args,
  { isWindows: useWindows = isWindows } = {},
) {
  return useWindows
    ? {
        command: `npm ${args.join(" ")}`,
        args: [],
        shell: true,
      }
    : {
        command: "npm",
        args,
        shell: false,
      };
}

export async function isPortAvailable(value) {
  return await new Promise((resolveAvailable) => {
    const server = createServer();

    server.once("error", () => resolveAvailable(false));
    server.once("listening", () => {
      server.close(() => resolveAvailable(true));
    });
    server.listen(value, "127.0.0.1");
  });
}

async function main() {
  const port = parsePreviewPort();

  if (!(await isPortAvailable(port))) {
    console.error(
      `Port ${port} is already in use. Stop the existing local service, then run npm run preview:full again.`,
    );
    process.exit(1);
  }

  const buildCommand = createNpmCommand(["run", "build"]);
  const build = spawnSync(buildCommand.command, buildCommand.args, {
    cwd: repoRoot,
    shell: buildCommand.shell,
    stdio: "inherit",
  });

  if (build.status !== 0) {
    if (build.error) {
      console.error(`Failed to run npm build: ${build.error.message}`);
    }
    process.exit(build.status ?? 1);
  }

  const startCommand = createNpmCommand(["start"]);
  const server = spawn(startCommand.command, startCommand.args, {
    cwd: resolve(repoRoot, "web-backend"),
    env: {
      ...process.env,
      PORT: String(port),
      WEB_STATIC_ROOT: staticRoot,
    },
    shell: startCommand.shell,
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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
