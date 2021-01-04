import {
  BlockchainTypes,
  JsonRpcPermissions,
  NotificationPermissions,
  PairingTypes,
  SessionTypes,
  SubscriptionEvent,
} from "@walletconnect/types";

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

export function isValidSessionProposalPermissions(
  permissions: SessionTypes.ProposedPermissions,
): void {
  isValidBlockchainPermissions(permissions.blockchain);
  isValidJsonRpcPermissions(permissions.jsonrpc);
  isValidNotificationPermissionsProposal(permissions.notifications);
}

export function isValidSessionProposalMetadata(metadata: SessionTypes.Metadata): void {
  if (!isValidString(metadata.name)) {
    throw new Error("Missing or invalid metadata name");
  }
  if (!isValidString(metadata.description)) {
    throw new Error("Missing or invalid metadata description");
  }
  if (typeof metadata.url === "undefined" || !isValidUrl(metadata.url)) {
    throw new Error("Missing or invalid metadata url");
  }

  if (typeof metadata.icons === "undefined" || !isValidArray(metadata.icons, isValidUrl)) {
    throw new Error("Missing or invalid metadata icons");
  }
}

export function isValidSessionProposal(params: SessionTypes.ProposeParams) {
  isValidSessionProposalPermissions(params.permissions);
  isValidSessionProposalMetadata(params.metadata);
}

// -- permissions -------------------------------------------------- //

export function isValidBlockchainPermissions(blockchain?: BlockchainTypes.Permissions): void {
  if (
    typeof blockchain === "undefined" ||
    typeof blockchain.chainIds === "undefined" ||
    !isValidArray(blockchain.chainIds, isValidChainId)
  ) {
    throw new Error("Missing or invalid blockchain permissions");
  }
}

export function isValidJsonRpcPermissions(jsonrpc?: JsonRpcPermissions): void {
  if (
    typeof jsonrpc === "undefined" ||
    typeof jsonrpc.methods === "undefined" ||
    !isValidArray(jsonrpc.methods, isValidString)
  ) {
    throw new Error("Missing or invalid jsonrpc permissions");
  }
}

export function isValidNotificationPermissionsProposal(
  notifications: NotificationPermissions.Proposal,
) {
  if (
    typeof notifications === "undefined" ||
    typeof notifications.types === "undefined" ||
    !isValidArray(notifications.types, isValidString)
  ) {
    throw new Error("Missing or invalid notification permissions");
  }
}

// -- misc -------------------------------------------------- //

export function isValidArray(arr: any, itemCondition?: (item: any) => boolean) {
  if (Array.isArray(arr)) {
    if (typeof itemCondition !== "undefined" && arr.length) {
      const matches = arr.filter(itemCondition);
      return matches.length === arr.length;
    } else {
      return true;
    }
  }
  return false;
}

export function isValidString(value: any) {
  return typeof value === "string" && !!value.trim();
}

export function isValidChainId(value: any) {
  if (isValidString(value) && value.includes(":")) {
    const split = value.split(":");
    return split.length === 2;
  }
  return false;
}

export function isValidUrl(value: any) {
  if (isValidString(value)) {
    try {
      const url = new URL(value);
      return typeof url !== "undefined";
    } catch (e) {
      return false;
    }
  }
  return false;
}
