import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "process.env.IS_VITEST": true,
    // Disable global core usage for tests to avoid conflicts with other tests
    "process.env.DISABLE_GLOBAL_CORE": true,
  },
  test: {
    testTimeout: 300_000,
    hookTimeout: 300_000,
    globalSetup: ["./test/shared/globalSetup.ts"], // runs once before/after all tests
  },
});
