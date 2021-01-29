import { THIRTY_DAYS } from "../constants";

const GITHASH = process.env.GITHASH || "0000000";
const VERSION = require("../../package.json").version || "0.0.0";
const env = process.env.NODE_ENV || "development";
const debug = env !== "production";
// TODO: Relay Server Port needs to be set from ops
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : env === "production" ? 5000 : 5555;
const host = process.env.HOST || `0.0.0.0`;
const REDIS_MAX_TTL: number = process.env.REDIS_MAXTTL
  ? parseInt(process.env.REDIS_MAXTTL, 10)
  : THIRTY_DAYS;
const redis = {
  url: process.env.REDIS_URL || "redis://localhost:6379/0",
  prefix: process.env.REDIS_PREFIX || "walletconnect-bridge",
};

export default {
  env: env,
  debug: debug,
  port,
  host,
  redis,
  REDIS_MAX_TTL,
  GITHASH,
  VERSION,
};
