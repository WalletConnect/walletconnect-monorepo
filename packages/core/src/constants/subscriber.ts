import { THIRTY_DAYS, FIVE_SECONDS } from "@walletconnect/time";

export const SUBSCRIBER_EVENTS = {
  created: "subscription_created",
  deleted: "subscription_deleted",
  expired: "subscription_expired",
  disabled: "subscription_disabled",
  sync: "subscription_sync",
  resubscribed: "subscription_resubscribed",
};

export const SUBSCRIBER_DEFAULT_TTL = THIRTY_DAYS;

export const SUBSCRIBER_CONTEXT = "subscription";

export const SUBSCRIBER_STORAGE_VERSION = "0.3";

export const PENDING_SUB_RESOLUTION_TIMEOUT = FIVE_SECONDS * 1000;
