import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "process.env.IS_VITEST": true,
  },
  test: {
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
