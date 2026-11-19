import { mergeConfig } from "vitest/config";
import defineConfig from "../../vitest.config";

export default mergeConfig(defineConfig, {
  test: { setupFiles: ["./test/shared/v2-only.setup.ts"] },
});
