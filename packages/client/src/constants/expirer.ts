import { ONE_DAY } from "./time";

export const EXPIRER_CONTEXT = "expirer";

export const EXPIRER_EVENTS = {
  set: "expirer_set",
  del: "expirer_del",
  expired: "expirer_expired",
};

export const EXPIRER_DEFAULT_TTL = ONE_DAY;
