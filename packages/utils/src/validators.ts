import { PairingTypes, SessionTypes, SubscriptionEvent } from "@walletconnect/types";

// -- pairing -------------------------------------------------- //

export function isPairingRespondedStatus(
  status: PairingTypes.PendingStatus,
): status is PairingTypes.RespondedStatus {
  return status === "responded";
}

export function isPairingResponded(
  pending: PairingTypes.Pending,
): pending is PairingTypes.RespondedPending {
  return isPairingRespondedStatus(pending.status) && "outcome" in pending;
}

export function isPairingFailed(outcome: PairingTypes.Outcome): outcome is PairingTypes.Failed {
  return "reason" in outcome;
}

// -- session -------------------------------------------------- //

export function isSessionRespondedStatus(
  status: SessionTypes.PendingStatus,
): status is SessionTypes.RespondedStatus {
  return status === "responded";
}

export function isSessionResponded(
  pending: SessionTypes.Pending,
): pending is SessionTypes.RespondedPending {
  return isPairingRespondedStatus(pending.status) && "outcome" in pending;
}

export function isSessionFailed(outcome: SessionTypes.Outcome): outcome is SessionTypes.Failed {
  return "reason" in outcome;
}

export function isSubscriptionUpdatedEvent<T = any>(
  event: SubscriptionEvent.Created<T> | SubscriptionEvent.Updated<T>,
): event is SubscriptionEvent.Updated<T> {
  return "update" in event;
}
