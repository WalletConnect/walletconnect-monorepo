import { ONE_DAY } from "./time";

export const EXPIRER_CONTEXT = "expirer";

export const EXPIRER_EVENTS = {
  created: "expirer_created",
  deleted: "expirer_deleted",
  expired: "expirer_expired",
  init: "expirer_init",
  sync: "expirer_sync",
};

export const EXPIRER_DEFAULT_TTL = ONE_DAY;
