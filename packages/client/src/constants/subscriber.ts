import { THIRTY_DAYS } from "@walletconnect/time";

export const SUBSCRIBER_EVENTS = {
  created: "subscription_created",
  deleted: "subscription_deleted",
  expired: "subscription_expired",
  enabled: "subscription_enabled",
  disabled: "subscription_disabled",
  sync: "subscription_sync",
};

export const SUBSCRIBER_DEFAULT_TTL = THIRTY_DAYS;

export const SUBSCRIBER_CONTEXT = "subscription";
