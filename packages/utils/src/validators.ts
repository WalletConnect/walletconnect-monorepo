import { ConnectionTypes, SessionTypes } from "@walletconnect/types";

export function isConnectionFailed(
  outcome: ConnectionTypes.Outcome,
): outcome is ConnectionTypes.Failed {
  return "reason" in outcome;
}

export function isSessionFailed(outcome: SessionTypes.Outcome): outcome is SessionTypes.Failed {
  return "reason" in outcome;
}
