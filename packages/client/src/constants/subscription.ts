import { THIRTY_DAYS } from "./time";

export const SUBSCRIPTION_EVENTS = {
  payload: "subscription_payload",
  created: "subscription_created",
  updated: "subscription_updated",
  deleted: "subscription_deleted",
  enabled: "subscription_enabled",
  disabled: "subscription_disabled",
  sync: "subscription_sync",
};

export const SUBSCRIPTION_DEFAULT_TTL = THIRTY_DAYS;
