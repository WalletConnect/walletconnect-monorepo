import { ConnectionTypes, SessionTypes } from "@walletconnect/types";

export function isConnectionRespondedStatus(
  status: ConnectionTypes.PendingStatus,
): status is ConnectionTypes.RespondedStatus {
  return status === "responded";
}

export function isConnectionResponded(
  pending: ConnectionTypes.Pending,
): pending is ConnectionTypes.RespondedPending {
  return isConnectionRespondedStatus(pending.status) && "outcome" in pending;
}

export function isConnectionFailed(
  outcome: ConnectionTypes.Outcome,
): outcome is ConnectionTypes.Failed {
  return "reason" in outcome;
}

export function isSessionRespondedStatus(
  status: SessionTypes.PendingStatus,
): status is SessionTypes.RespondedStatus {
  return status === "responded";
}

export function isSessionResponded(
  pending: SessionTypes.Pending,
): pending is SessionTypes.RespondedPending {
  return isConnectionRespondedStatus(pending.status) && "outcome" in pending;
}

export function isSessionFailed(outcome: SessionTypes.Outcome): outcome is SessionTypes.Failed {
  return "reason" in outcome;
}
