import { THIRTY_SECONDS } from "./time";

export const JSONRPC_RETRIAL_TIMEOUT = THIRTY_SECONDS * 1000;

export const JSONRPC_RETRIAL_MAX = 3;

export const JSONRPC_CONTEXT = "jsonrpc";

export const JSONRPC_EVENTS = {
  publish: "jsonrpc_publish",
  subscribe: "jsonrpc_subscribe",
  unsubscribe: "jsonrpc_unsubscribe",
  subscription: "jsonrpc_subscription",
};
