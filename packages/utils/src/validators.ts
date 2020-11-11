import { ConnectionTypes, SessionTypes, SubscriptionEvent } from "@walletconnect/types";

// -- connection -------------------------------------------------- //

export function isConnectionStateUpdate<S = any>(
  update: ConnectionTypes.Update<S>,
): update is ConnectionTypes.StateUpdate {
  return "state" in update;
}

export function isConnectionMetadataUpdate<S = any>(
  update: ConnectionTypes.Update<S>,
): update is ConnectionTypes.MetadataUpdate {
  return "peer" in update;
}

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

// -- session -------------------------------------------------- //

export function isSessionStateUpdate<S = any>(
  update: SessionTypes.Update<S>,
): update is SessionTypes.StateUpdate {
  return "state" in update;
}

export function isSessionMetadataUpdate<S = any>(
  update: SessionTypes.Update<S>,
): update is SessionTypes.MetadataUpdate {
  return "peer" in update;
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

export function isSubscriptionUpdatedEvent<T = any>(
  event: SubscriptionEvent.Created<T> | SubscriptionEvent.Updated<T>,
): event is SubscriptionEvent.Updated<T> {
  return "update" in event;
}
