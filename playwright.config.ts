import { defineConfig, devices } from "@playwright/test";

// Requires a running `npm run dev` against a real, seeded DATABASE_URL —
// every storefront page is DB-backed (see app/shop/**, app/page.tsx), so
// there is no meaningful browser test without one. This suite is
// code-ready but has not been executed in an environment with no database
// available — see docs/STRIPE_TESTING.md / the final readiness report for
// the exact blocker.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    { name: "mobile-390", use: { ...devices["iPhone 12"], viewport: { width: 390, height: 844 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000
  }
});
