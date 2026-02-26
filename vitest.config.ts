import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "process.env.IS_VITEST": true,
    // Disable global core usage for tests to avoid conflicts with other tests
    "process.env.DISABLE_GLOBAL_CORE": true,
  },
  test: {
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
