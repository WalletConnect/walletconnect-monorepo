import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 80_000,
    hookTimeout: 30_000,
  },
});
