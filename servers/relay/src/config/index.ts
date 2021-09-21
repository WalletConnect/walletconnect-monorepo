import { THIRTY_DAYS } from "../constants";
import { RelayModes } from "../types";

const GITHASH = process.env.GITHASH || "0000000";
const VERSION = require("../../package.json").version || "0.0.0";
const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"];
let logLevel = process.env.LOG_LEVEL || "info";

if (LEVELS.indexOf(logLevel.toLowerCase()) == -1) {
  throw `Wrong log level used: ${process.env.LOG_LEVEL}. Valid levels are: ${LEVELS}`;
}
logLevel = logLevel.toLowerCase();

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const host = process.env.HOST || `0.0.0.0`;
const REDIS_MAX_TTL: number = process.env.REDIS_MAXTTL
  ? parseInt(process.env.REDIS_MAXTTL, 10)
  : THIRTY_DAYS;
const redis = {
  url: process.env.REDIS_URL || `redis://localhost:6379/0`,
  prefix: process.env.REDIS_PREFIX || "walletconnect-bridge",
};
const mode = (process.env.RELAY_MODE || "any") as RelayModes.All;
const wakuUrl = process.env.WAKU_URL;

export default {
  logLevel,
  port,
  host,
  redis,
  mode,
  wakuUrl,
  REDIS_MAX_TTL,
  GITHASH,
  VERSION,
};
