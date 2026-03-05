import pkg from "./package.json" with { type: "json" };
import createConfig from "../../rollup.config.js";

export default createConfig(pkg.name, Object.keys(pkg.dependencies));
