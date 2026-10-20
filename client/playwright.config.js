import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5600",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/browser-server.js",
    cwd: fileURLToPath(new URL("../server", import.meta.url)),
    url: "http://127.0.0.1:5600/api/health",
    timeout: 60000,
    reuseExistingServer: false,
  },
  reporter: [["list"]],
});
