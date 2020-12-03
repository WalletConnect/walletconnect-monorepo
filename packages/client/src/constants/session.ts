import { NotificationPermissions, SessionTypes, SignalTypes } from "@walletconnect/types";

export const SESSION_JSONRPC = {
  propose: "wc_sessionPropose",
  respond: "wc_sessionRespond",
  update: "wc_sessionUpdate",
  delete: "wc_sessionDelete",
  payload: "wc_sessionPayload",
  notification: "wc_sessionNotification",
};

export const SESSION_CONTEXT = "session";

export const SESSION_DEFAULT_SUBSCRIBE_TTL = 604800; // 7 days

export const SESSION_SIGNAL_METHOD_CONNECTION = "connection" as SignalTypes.MethodConnection;

export const SESSION_STATUS = {
  proposed: "proposed" as SessionTypes.ProposedStatus,
  responded: "responded" as SessionTypes.RespondedStatus,
  pending: "pending",
  settled: "settled",
};

export const SESSION_EVENTS = {
  payload: "session_payload",
  proposed: "session_proposed",
  responded: "session_responded",
  settled: "session_settled",
  updated: "session_updated",
  deleted: "session_deleted",
  notification: "session_notification",
};

export const SESSION_REASONS = {
  settled: "Session settled",
  not_approved: "Session not approved",
  responded: "Session proposal responded",
  acknowledged: "Session response acknowledged",
};

export const SESSION_EMPTY_PERMISSIONS = {
  jsonrpc: {
    methods: [],
  },
  blockchain: {
    chainIds: [],
  },
  notifications: {
    types: [],
  },
} as SessionTypes.ProposedPermissions;

export const SESSION_EMPTY_RESPONSE = {
  metadata: {
    name: "",
    description: "",
    url: "",
    icons: [],
  },
  state: {
    accountIds: [],
  },
} as SessionTypes.Response;
