const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4180",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "npm run build && node dist/scripts/e2e-server.js",
    url: "http://127.0.0.1:4180/api/health",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
