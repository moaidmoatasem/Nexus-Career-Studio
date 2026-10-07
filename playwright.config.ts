import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// End-to-end smoke test (PLAN.md 13.3): the built app against local Supabase (`bun run db:local`)
// and a fake AI server, so it needs no paid service. Build first with `bun run build`.
if (existsSync(".env")) process.loadEnvFile(".env");

const PORT = 3100;
const AI_PORT = 4010;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/fake-ai.mjs",
      url: `http://127.0.0.1:${AI_PORT}/`,
      env: { FAKE_AI_PORT: String(AI_PORT) },
      reuseExistingServer: false,
    },
    {
      command: "node .output/server/index.mjs",
      url: `http://localhost:${PORT}/api/public/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        PORT: String(PORT),
        APP_URL: `http://localhost:${PORT}`,
        AI_BASE_URL: `http://127.0.0.1:${AI_PORT}/v1`,
        AI_MODEL: "fake",
        AI_API_KEY: "",
        AI_DAILY_LIMIT: "",
        FIRECRAWL_DAILY_LIMIT: "",
        ALLOWED_EMAILS: "",
      },
    },
  ],
});
