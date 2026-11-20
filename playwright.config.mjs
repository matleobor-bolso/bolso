import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:4173/",
    viewport: { width: 390, height: 844 },
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: { command: "python3 -m http.server 4173 --directory app", port: 4173, reuseExistingServer: true },
});
