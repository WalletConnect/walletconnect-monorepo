const GITHASH = process.env.GITHASH || "0000000";
const VERSION = require("../../package.json").version || "0.0.0";

const env = process.env.NODE_ENV || "development";
const debug = env !== "production";
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : env === "production" ? 5000 : 5432;
const host = process.env.HOST || `0.0.0.0`;

export default {
  env,
  debug,
  port,
  host,
  GITHASH,
  VERSION,
};
