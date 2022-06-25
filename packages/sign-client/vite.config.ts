import { resolve } from "path";
import { name } from "./package.json";
import createConfig from "../../vite.config";

export default createConfig({
  name,
  entry: resolve(__dirname, "src/index.ts"),
  outDir: resolve(__dirname, "dist"),
});
