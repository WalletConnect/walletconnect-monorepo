import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 800_000,
    hookTimeout: 800_000,
  },
});
