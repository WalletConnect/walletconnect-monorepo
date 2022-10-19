import { SignClientTypes } from "@walletconnect/types";

export const SIGN_CLIENT_PROTOCOL = "wc";
export const SIGN_CLIENT_VERSION = 2;
export const SIGN_CLIENT_CONTEXT = "client";

export const SIGN_CLIENT_STORAGE_PREFIX = `${SIGN_CLIENT_PROTOCOL}@${SIGN_CLIENT_VERSION}:${SIGN_CLIENT_CONTEXT}:`;

export const SIGN_CLIENT_DEFAULT = {
  name: SIGN_CLIENT_CONTEXT,
  logger: "error",
  controller: false,
  relayUrl: "wss://relay.walletconnect.com",
};

export const SIGN_CLIENT_EVENTS: Record<SignClientTypes.Event, SignClientTypes.Event> = {
  session_proposal: "session_proposal",
  session_update: "session_update",
  session_extend: "session_extend",
  session_ping: "session_ping",
  session_delete: "session_delete",
  session_expire: "session_expire",
  session_request: "session_request",
  session_event: "session_event",
  proposal_expire: "proposal_expire",
};

export const SIGN_CLIENT_STORAGE_OPTIONS = {
  database: ":memory:",
};
