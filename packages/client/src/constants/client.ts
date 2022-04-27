import { ClientTypes } from "@walletconnect/types";

export const CLIENT_CONTEXT = "client";

export const CLIENT_DEFAULT = {
  name: CLIENT_CONTEXT,
  logger: "error",
  controller: false,
  relayUrl: "wss://relay.walletconnect.com",
};

export const CLIENT_SHORT_TIMEOUT = 50;

export const CLIENT_EVENTS: Record<ClientTypes.Event, ClientTypes.Event> = {
  session_proposal: "session_proposal",
  update_accounts: "update_accounts",
  update_namespaces: "update_namespaces",
  update_expiry: "update_expiry",
  session_ping: "session_ping",
  pairing_ping: "pairing_ping",
  session_delete: "session_delete",
  pairing_delete: "pairing_delete",
  request: "request",
  event: "event",
};

export const CLIENT_STORAGE_OPTIONS = {
  database: ":memory:",
};
