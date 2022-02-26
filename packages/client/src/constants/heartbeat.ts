import { FIVE_SECONDS } from "@walletconnect/time";

export const HEARTBEAT_CONTEXT = "heartbeat";

export const HEARTBEAT_INTERVAL = FIVE_SECONDS;

export const HEARTBEAT_DEFAULT_LOGGER = "error";

export const HEARTBEAT_EVENTS = {
  pulse: "heartbeat_pulse",
};
