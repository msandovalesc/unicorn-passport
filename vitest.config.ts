import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const fileEnv = loadEnv("test", process.cwd(), "");
const testDb = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;
if (testDb) process.env.TEST_DATABASE_URL = testDb;

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/setup/globalSetup.ts"],
    // DB tests share one database, so run files one at a time.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      AUTH_SECRET: "test-secret",
      APP_URL: "http://localhost:3000",
      ...(testDb ? { DATABASE_URL: testDb } : { DATABASE_URL: "postgresql://unused" }),
    },
  },
});
