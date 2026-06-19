import { defineConfig, devices } from "@playwright/test";

const env =
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env ?? {};
const configuredPort = Number.parseInt(env.PLAYWRIGHT_PORT ?? "", 10);
const port =
  Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535
    ? configuredPort
    : 4289;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL,
  },
  webServer: {
    command: `npm run dev -- --mode test --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !env.CI,
  },
  projects: [
    {
      name: "desktop chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
