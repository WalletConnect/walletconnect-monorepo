import { PairingTypes, SignalTypes } from "@walletconnect/types";
import { THIRTY_DAYS } from "./time";

export const PAIRING_JSONRPC: PairingTypes.JsonRpc = {
  propose: "wc_pairingPropose",
  approve: "wc_pairingApprove",
  reject: "wc_pairingReject",
  update: "wc_pairingUpdate",
  upgrade: "wc_pairingUpgrade",
  delete: "wc_pairingDelete",
  payload: "wc_pairingPayload",
  ping: "wc_pairingPing",
  notification: "wc_pairingNotification",
};

export const PAIRING_CONTEXT = "pairing";

export const PAIRING_DEFAULT_TTL = THIRTY_DAYS;

export const PAIRING_SIGNAL_METHOD_URI = "uri" as SignalTypes.MethodUri;

export const PAIRING_STATUS = {
  proposed: "proposed" as PairingTypes.ProposedStatus,
  responded: "responded" as PairingTypes.RespondedStatus,
  pending: "pending",
  settled: "settled",
};

export const PAIRING_EVENTS: PairingTypes.Events = {
  proposed: "pairing_proposed",
  responded: "pairing_responded",
  settled: "pairing_settled",
  updated: "pairing_updated",
  deleted: "pairing_deleted",
  request: "pairing_request",
  response: "pairing_response",
  sync: "pairing_sync",
  notification: "pairing_notification",
};
