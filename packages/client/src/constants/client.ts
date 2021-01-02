export const CLIENT_CONTEXT = "client";

export const CLIENT_EVENTS = {
  pairing: {
    proposal: "pairing_proposal",
    updated: "pairing_updated",
    created: "pairing_created",
    deleted: "pairing_deleted",
  },
  session: {
    proposal: "session_proposal",
    updated: "session_updated",
    created: "session_created",
    deleted: "session_deleted",
    payload: "session_payload",
    notification: "session_notification",
  },
};

export const CLIENT_STORAGE_OPTIONS = {
  database: ":memory:",
};
