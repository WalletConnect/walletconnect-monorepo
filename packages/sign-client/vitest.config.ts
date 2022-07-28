import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 600_000,
    hookTimeout: 120_000,
  },
});
