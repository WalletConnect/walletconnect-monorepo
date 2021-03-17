import {
  BlockchainTypes,
  JsonRpcPermissions,
  NotificationPermissions,
  PairingTypes,
  SessionTypes,
  SubscriptionEvent,
  Validation,
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

export function validateSessionProposeParamsPermissions(
  permissions: SessionTypes.ProposedPermissions,
): Validation.Result {
  const blockchainPermissionsValidation = validateBlockchainPermissions(permissions.blockchain);
  if (isValidationInvalid(blockchainPermissionsValidation)) {
    return blockchainPermissionsValidation;
  }
  const jsonRpcPermissionsValidation = validateJsonRpcPermissions(permissions.jsonrpc);
  if (isValidationInvalid(jsonRpcPermissionsValidation)) {
    return jsonRpcPermissionsValidation;
  }
  const notificationPermissionsValidation = validateNotificationPermissions(
    permissions.notifications,
  );
  if (isValidationInvalid(notificationPermissionsValidation)) {
    return notificationPermissionsValidation;
  }
  return formatValidResult();
}

export function validateSessionProposeParamsMetadata(
  metadata: SessionTypes.Metadata,
): Validation.Result {
  if (!isValidString(metadata.name)) {
    return formatInvalidResult("Missing or invalid metadata name");
  }
  if (!isValidString(metadata.description)) {
    return formatInvalidResult("Missing or invalid metadata description");
  }
  if (typeof metadata.url === "undefined" || !isValidUrl(metadata.url)) {
    return formatInvalidResult("Missing or invalid metadata url");
  }
  if (typeof metadata.icons === "undefined" || !isValidArray(metadata.icons, isValidUrl)) {
    return formatInvalidResult("Missing or invalid metadata icons");
  }
  return formatValidResult();
}

export function validateSessionProposeParams(
  params: SessionTypes.ProposeParams,
): Validation.Result {
  const permissionsValidation = validateSessionProposeParamsPermissions(params.permissions);
  if (isValidationInvalid(permissionsValidation)) {
    return permissionsValidation;
  }
  const metadataValidation = validateSessionProposeParamsMetadata(params.metadata);
  if (isValidationInvalid(metadataValidation)) {
    return metadataValidation;
  }
  return formatValidResult();
}

export function validateSessionRespondParams(
  params: SessionTypes.RespondParams,
): Validation.Result {
  if (params.approved) {
    if (typeof params.response === "undefined") {
      return formatInvalidResult("Missing response for approved session");
    }
    const stateValidation = validateBlockchainState(
      params.response.state,
      params.proposal.permissions.blockchain,
    );
    if (isValidationInvalid(stateValidation)) {
      return stateValidation;
    }
    const metadataValidation = validateSessionProposeParamsMetadata(params.response.metadata);
    if (isValidationInvalid(metadataValidation)) {
      return metadataValidation;
    }
  }
  return formatValidResult();
}

// -- permissions -------------------------------------------------- //

export function validateBlockchainPermissions(
  blockchain?: BlockchainTypes.Permissions,
): Validation.Result {
  if (
    typeof blockchain === "undefined" ||
    typeof blockchain.chains === "undefined" ||
    !isValidArray(blockchain.chains, isValidChainId)
  ) {
    return formatInvalidResult("Missing or invalid blockchain permissions");
  }
  return formatValidResult();
}

export function validateJsonRpcPermissions(jsonrpc?: JsonRpcPermissions): Validation.Result {
  if (
    typeof jsonrpc === "undefined" ||
    typeof jsonrpc.methods === "undefined" ||
    !isValidArray(jsonrpc.methods, isValidString)
  ) {
    return formatInvalidResult("Missing or invalid jsonrpc permissions");
  }
  return formatValidResult();
}

export function validateNotificationPermissions(
  notifications: NotificationPermissions,
): Validation.Result {
  if (
    typeof notifications === "undefined" ||
    typeof notifications.types === "undefined" ||
    !isValidArray(notifications.types, isValidString)
  ) {
    return formatInvalidResult("Missing or invalid notification permissions");
  }
  return formatValidResult();
}

// -- state -------------------------------------------------- //

export function validateBlockchainState(
  state?: BlockchainTypes.State,
  blockchain?: BlockchainTypes.Permissions,
): Validation.Result {
  if (
    typeof blockchain === "undefined" ||
    typeof blockchain.chains === "undefined" ||
    !isValidArray(blockchain.chains, isValidChainId)
  ) {
    return formatInvalidResult("Missing or invalid blockchain permissions");
  }
  if (
    typeof state === "undefined" ||
    typeof state.accounts === "undefined" ||
    !isValidArray(state.accounts, isValidAccountId)
  ) {
    return formatInvalidResult("Missing or invalid state accounts");
  }
  const mismatch = state.accounts.filter(accountId => {
    const chainId = accountId.split("@")[1];
    return !blockchain.chains.includes(chainId);
  });
  if (mismatch.length) {
    return formatInvalidResult(`Invalid accounts with mismatched chains: ${mismatch.toString()}`);
  }
  return formatValidResult();
}

// -- misc -------------------------------------------------- //

export function isValidArray(arr: any, itemCondition?: (item: any) => boolean): boolean {
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

export function isValidString(value: any): boolean {
  return typeof value === "string" && !!value.trim();
}

export function isValidChainId(value: any): boolean {
  if (isValidString(value) && value.includes(":")) {
    const split = value.split(":");
    return split.length === 2;
  }
  return false;
}

export function isValidAccountId(value: any): boolean {
  if (isValidString(value) && value.includes("@")) {
    const split = value.split("@");
    if (split.length === 2) {
      return !!split[0] && isValidChainId(split[1]);
    }
  }
  return false;
}

export function isValidUrl(value: any): boolean {
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

// -- validation result ---------------------------------------- //

export function isValidationInvalid(
  validation: Validation.Result,
): validation is Validation.Invalid {
  return (
    "valid" in validation &&
    validation.valid === false &&
    "error" in validation &&
    typeof validation.error === "string"
  );
}

export function formatValidResult(): Validation.Valid {
  return { valid: true };
}

export function formatInvalidResult(error: string): Validation.Invalid {
  return { valid: false, error };
}
