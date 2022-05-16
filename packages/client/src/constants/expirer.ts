import { ONE_DAY } from "@walletconnect/time";

export const EXPIRER_CONTEXT = "expirer";

export const EXPIRER_EVENTS = {
  created: "expirer_created",
  deleted: "expirer_deleted",
  expired: "expirer_expired",
  sync: "expirer_sync",
};

export const EXPIRER_STORAGE_VERSION = "0.3";

export const EXPIRER_DEFAULT_TTL = ONE_DAY;
