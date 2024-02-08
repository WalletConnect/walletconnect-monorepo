import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "process.env.IS_VITEST": true,
  },
  test: {
    testTimeout: 800_000,
    hookTimeout: 800_000,
    maxConcurrency: 1,
  },
});
