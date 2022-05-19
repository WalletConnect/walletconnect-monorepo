import { ClientTypes } from "@walletconnect/types";

export const CLIENT_PROTOCOL = "wc";
export const CLIENT_VERSION = 2;
export const CLIENT_CONTEXT = "client";

export const CLIENT_STORAGE_PREFIX = `${CLIENT_PROTOCOL}@${CLIENT_VERSION}:${CLIENT_CONTEXT}:`;

export const CLIENT_DEFAULT = {
  name: CLIENT_CONTEXT,
  logger: "error",
  controller: false,
  relayUrl: "wss://relay.walletconnect.com",
};

export const CLIENT_SHORT_TIMEOUT = 50;

export const CLIENT_EVENTS: Record<ClientTypes.Event, ClientTypes.Event> = {
  session_proposal: "session_proposal",
  session_update: "session_update",
  session_extend: "session_extend",
  session_ping: "session_ping",
  pairing_ping: "pairing_ping",
  session_delete: "session_delete",
  session_expire: "session_expire",
  pairing_delete: "pairing_delete",
  pairing_expire: "pairing_expire",
  request: "request",
  event: "event",
};

export const CLIENT_STORAGE_OPTIONS = {
  database: ":memory:",
};
