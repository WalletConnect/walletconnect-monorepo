import { THIRTY_DAYS } from "./time";

export const SUBSCRIPTION_EVENTS = {
  created: "subscription_created",
  deleted: "subscription_deleted",
  expired: "subscription_expired",
  enabled: "subscription_enabled",
  disabled: "subscription_disabled",
  sync: "subscription_sync",
};

export const SUBSCRIPTION_DEFAULT_TTL = THIRTY_DAYS;

export const SUBSCRIPTION_CONTEXT = "subscription";
