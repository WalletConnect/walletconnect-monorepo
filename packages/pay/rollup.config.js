import { name, dependencies } from "./package.json";
import createConfig from "../../rollup.config.js";

export default createConfig(name, Object.keys(dependencies));
