import { ONE_DAY } from "./time";

export const EXPIRER_CONTEXT = "expirer";

export const EXPIRER_EVENTS = {
  created: "expirer_created",
  deleted: "expirer_deleted",
  expired: "expirer_expired",
};

export const EXPIRER_DEFAULT_TTL = ONE_DAY;
