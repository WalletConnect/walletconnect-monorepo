const GITHASH = process.env.GITHASH || "0000000";
const VERSION = require("../../package.json").version || "0.0.0";
const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"];
let logLevel = process.env.LOG_LEVEL || "info";
if (LEVELS.indexOf(logLevel.toLowerCase()) == -1) {
  throw `Wrong log level used: ${process.env.LOG_LEVEL}. Valid levels are: ${LEVELS}`;
}
logLevel = logLevel.toLowerCase();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;
const host = process.env.HOST || `0.0.0.0`;
const apiKey = process.env.API_KEY || "1b4f6f7f70880ac6c3ffb084480cad27";

export default {
  apiKey,
  logLevel,
  port,
  host,
  GITHASH,
  VERSION,
};
