import { ConnectionTypes, SignalTypes } from "@walletconnect/types";

export const CONNECTION_JSONRPC = {
  respond: "wc_connectionRespond",
  update: "wc_connectionUpdate",
  delete: "wc_connectionDelete",
  payload: "wc_connectionPayload",
};

export const CONNECTION_CONTEXT = "connection";

export const CONNECTION_DEFAULT_SUBSCRIBE_TTL = 2592000; // 30 days

export const CONNECTION_SIGNAL_METHOD_URI = "uri" as SignalTypes.MethodUri;

export const CONNECTION_STATUS = {
  proposed: "proposed" as ConnectionTypes.ProposedStatus,
  responded: "responded" as ConnectionTypes.RespondedStatus,
  pending: "pending",
  settled: "settled",
};

export const CONNECTION_EVENTS = {
  payload: "connection_payload",
  proposed: "connection_proposed",
  responded: "connection_responded",
  settled: "connection_settled",
  updated: "connection_updated",
  deleted: "connection_deleted",
};

export const CONNECTION_REASONS = {
  settled: "Connection settled",
  not_approved: "Connection not approved",
  responded: "Connection proposal responded",
  acknowledged: "Connection response acknowledged",
};
