import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 390, height: 844 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: `../../work/browser-${process.env.QA_RUN || Date.now()}`,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: `../evidence/browser-${process.env.QA_RUN || Date.now()}.json`,
      },
    ],
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
