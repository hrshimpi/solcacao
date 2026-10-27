// Browser tests: three desktop browsers and two phone profiles. The dev server is started for the run
// (or reused if it is already running on port 5173).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Six browsers run at once and axe scans are heavy, so on a laptop with other programs open a plain page scan can
  // take 30 seconds instead of 3 (measured). The default of 30 seconds then fails tests that did nothing wrong.
  // The checks inside a test keep their own, shorter time limit below, so a real problem still fails quickly.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "pixel-5", use: { ...devices["Pixel 5"] } },
    { name: "iphone-13", use: { ...devices["iPhone 13"] } },
  ],
});
