import { defineConfig, devices } from "@playwright/test";

// Use HTTPS for Secure cookies on every engine, including Safari/WebKit.
// The one-day self-signed certificate is confined to the disposable CI fixture.
const baseURL = "https://localhost:3443";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  globalTimeout: 25 * 60_000,
  // The database-backed flows share a deliberately small synthetic fixture.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "node scripts/e2e-https-server.mjs",
    url: `${baseURL}/login`,
    ignoreHTTPSErrors: true,
    // Verify the production build; never silently reuse a development server.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
