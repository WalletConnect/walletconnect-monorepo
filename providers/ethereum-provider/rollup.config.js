import { name, dependencies } from "./package.json";
import createConfig from "../../rollup.config";
// web3modal has dynamic imports, so we need to enable inlineDynamicImports
export default createConfig(
  name,
  Object.keys(dependencies),
  { inlineDynamicImports: true },
  { inlineDynamicImports: true },
  { inlineDynamicImports: true },
);
