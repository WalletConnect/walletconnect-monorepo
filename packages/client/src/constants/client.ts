import { FIVE_SECONDS } from "./time";

export const CLIENT_CONTEXT = "client";

export const CLIENT_DEFAULT = {
  name: CLIENT_CONTEXT,
  logger: "error",
  controller: false,
};

export const CLIENT_BEAT_INTERVAL = FIVE_SECONDS;

export const CLIENT_SHORT_TIMEOUT = 50;

export const CLIENT_EVENTS = {
  beat: "client_beat",
  pairing: {
    proposal: "pairing_proposal",
    updated: "pairing_updated",
    created: "pairing_created",
    deleted: "pairing_deleted",
    sync: "pairing_sync",
  },
  session: {
    proposal: "session_proposal",
    updated: "session_updated",
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
