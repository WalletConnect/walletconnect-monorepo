import { name, dependencies } from "./package.json";
import createConfig from "../../rollup.config";

export default createConfig(name, Object.keys(dependencies));
