import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: a real browser against the running HMS (web app + API).
 *
 *   npm run test:e2e            run everything headless
 *   npm run test:e2e:ui         the interactive runner
 *   npm run test:e2e:report     open the last HTML report
 *
 * It uses the Google Chrome already installed on the machine (no browser download). To use Playwright's own Chromium instead,
 * run `npx playwright install chromium` and set E2E_CHANNEL=chromium.
 *
 * By default it reuses servers already running on :3005 (app) and :4000 (API) and starts them if they aren't. Point it elsewhere
 * with E2E_BASE_URL / E2E_API_URL. The tests only read — they sign in and look at each section — so they are safe on the dev
 * database; for a throw-away stack start the API with DATABASE_DRIVER=memory.
 */
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3005);
const API_PORT = Number(process.env.E2E_API_PORT ?? 4000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${APP_PORT}`;
const apiURL = process.env.E2E_API_URL ?? `http://localhost:${API_PORT}`;
const channel = process.env.E2E_CHANNEL ?? "chrome";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  // A dev server compiles each page the first time it is opened.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    // Traces are big; keep them for CI retries, and turn them on locally with `--trace on` when chasing a failure.
    trace: process.env.CI ? "on-first-retry" : "off",
    screenshot: "only-on-failure",
    ...(channel === "chromium" ? {} : { channel }),
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: "e2e/.auth/admin.json", ...(channel === "chromium" ? {} : { channel }) }, dependencies: ["setup"], testIgnore: /(auth\.setup|login\.spec|access\.spec|public\.spec)\.ts$/ },
    { name: "anonymous", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...(channel === "chromium" ? {} : { channel }) }, testMatch: /(login|access|public)\.spec\.ts$/ },
  ],
  webServer: [
    { command: "npm --prefix server run dev", url: `${apiURL}/api/health`, reuseExistingServer: true, timeout: 120_000, stdout: "ignore", stderr: "pipe" },
    { command: "npm run dev", url: `${baseURL}/login`, reuseExistingServer: true, timeout: 180_000, env: { PORT: String(APP_PORT) }, stdout: "ignore", stderr: "pipe" },
  ],
});
