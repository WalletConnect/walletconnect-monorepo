import { toMiliseconds } from "@walletconnect/utils";

import { FIVE_SECONDS } from "./time";

export const CLIENT_CONTEXT = "client";

export const CLIENT_BEAT_INTERVAL = toMiliseconds(FIVE_SECONDS);

export const CLIENT_EVENTS = {
  beat: "client_beat",
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
    notification: "session_notification",
    request: "session_request",
    response: "session_response",
  },
};

export const CLIENT_STORAGE_OPTIONS = {
  database: ":memory:",
};
