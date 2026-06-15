import { defineConfig, devices } from "@playwright/test";

const port = 4289;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL,
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
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
