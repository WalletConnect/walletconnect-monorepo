import { NETWORK_ENV, SERVER_LOGGER, REDIS_DEFAULT_MAXTTL } from "../constants";
import { HttpServiceConfig, RelayModes } from "../types";

const gitHash = process.env.GITHASH || "0000000";
const version = require("../../package.json").version || "0.0.0";
const logger = (process.env.LOG_LEVEL || "info").toLowerCase();

if (SERVER_LOGGER.levels.indexOf(logger) == -1) {
  throw `Wrong log level used: ${process.env.LOG_LEVEL}. Valid levels are: ${SERVER_LOGGER.levels}`;
}

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const host = process.env.HOST || `0.0.0.0`;
const maxTTL: number = process.env.REDIS_MAXTTL
  ? parseInt(process.env.REDIS_MAXTTL, 10)
  : REDIS_DEFAULT_MAXTTL;
const redis = {
  url: process.env.REDIS_URL || `redis://localhost:6379/0`,
  prefix: process.env.REDIS_PREFIX || "walletconnect-bridge",
};
const mode = (process.env.RELAY_MODE || "any") as RelayModes.All;
const waku = {
  env: process.env.RELAY_ENV || NETWORK_ENV.prod,
  url: process.env.WAKU_URL,
};

const config: HttpServiceConfig = {
  logger,
  port,
  host,
  redis,
  mode,
  waku,
  maxTTL,
  gitHash,
  version,
};

export default config;
