import { ConnectionTypes } from "@walletconnect/types";
import { SESSION_JSONRPC_BEFORE_SETTLEMENT } from "./session";

export const CONNECTION_JSONRPC = {
  respond: "wc_respondConnection",
  update: "wc_updateConnection",
  delete: "wc_deleteConnection",
};

export const CONNECTION_JSONRPC_BEFORE_SETTLEMENT = [CONNECTION_JSONRPC.respond];

export const CONNECTION_JSONRPC_AFTER_SETTLEMENT = [
  CONNECTION_JSONRPC.update,
  CONNECTION_JSONRPC.delete,
];

export const SETTLED_CONNECTION_JSONRPC = [
  ...CONNECTION_JSONRPC_AFTER_SETTLEMENT,
  ...SESSION_JSONRPC_BEFORE_SETTLEMENT,
];

export const CONNECTION_CONTEXT = "connection";

export const CONNECTION_SIGNAL_TYPE_URI = "uri" as ConnectionTypes.SignalTypeUri;

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
