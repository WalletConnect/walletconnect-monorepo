export const CLIENT_CONTEXT = "client";

export const CLIENT_DEFAULT = {
  name: CLIENT_CONTEXT,
  logger: "error",
  controller: false,
  relayUrl: "wss://relay.walletconnect.com",
};

export const CLIENT_SHORT_TIMEOUT = 50;

export const CLIENT_EVENTS = {
  pairing: {
    proposal: "pairing_proposal",
    updated: "pairing_updated",
    upgraded: "pairing_upgraded",
    extended: "pairing_extended",
    created: "pairing_created",
    deleted: "pairing_deleted",
    sync: "pairing_sync",
  },
  session: {
    proposal: "session_proposal",
    updated: "session_updated",
    upgraded: "session_upgraded",
    extended: "session_extended",
    created: "session_created",
    deleted: "session_deleted",
    notification: "session_notification",
    request: "session_request",
    response: "session_response",
    sync: "session_sync",
  },
};

export const CLIENT_STORAGE_OPTIONS = {
  database: ":memory:",
};
