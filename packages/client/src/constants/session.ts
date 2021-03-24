import { SessionTypes, SignalTypes } from "@walletconnect/types";

import { SEVEN_DAYS } from "./time";

export const SESSION_JSONRPC = {
  propose: "wc_sessionPropose",
  approve: "wc_sessionApprove",
  reject: "wc_sessionReject",
  update: "wc_sessionUpdate",
  upgrade: "wc_sessionUpgrade",
  delete: "wc_sessionDelete",
  payload: "wc_sessionPayload",
  ping: "wc_sessionPing",
  notification: "wc_sessionNotification",
};

export const SESSION_CONTEXT = "session";

export const SESSION_DEFAULT_TTL = SEVEN_DAYS;

export const SESSION_SIGNAL_METHOD_PAIRING = "pairing" as SignalTypes.MethodPairing;

export const SESSION_STATUS = {
  proposed: "proposed" as SessionTypes.ProposedStatus,
  responded: "responded" as SessionTypes.RespondedStatus,
  pending: "pending",
  settled: "settled",
};

export const SESSION_EVENTS = {
  proposed: "session_proposed",
  responded: "session_responded",
  settled: "session_settled",
  updated: "session_updated",
  deleted: "session_deleted",
  notification: "session_notification",
  request: "session_request",
  response: "session_response",
};

export const SESSION_REASONS = {
  settled: { code: 1000, message: "Session settled" },
  not_approved: { code: 1001, message: "Session not approved" },
  responded: { code: 1002, message: "Session proposal responded" },
  acknowledged: { code: 1003, message: "Session response acknowledged" },
};

export const SESSION_EMPTY_PERMISSIONS = {
  jsonrpc: {
    methods: [],
  },
  blockchain: {
    chains: [],
  },
  notifications: {
    types: [],
  },
} as SessionTypes.ProposedPermissions;

export const SESSION_EMPTY_STATE = {
  accounts: [],
};

export const SESSION_EMPTY_METADATA = {
  name: "",
  description: "",
  url: "",
  icons: [],
};

export const SESSION_EMPTY_RESPONSE = {
  metadata: SESSION_EMPTY_METADATA,
  state: SESSION_EMPTY_STATE,
} as SessionTypes.Response;
