import { defineConfig } from "@playwright/test";

export default defineConfig({
  timeout: 30_000,
  use: { trace: "off" },
  projects: [
    {
      name: "local",
      testMatch: /local\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:8080" },
    },
    {
      name: "production",
      testMatch: /production-readonly\.spec\.ts/,
      use: { baseURL: "https://mu-omega-nine.vercel.app" },
    },
  ],
});
