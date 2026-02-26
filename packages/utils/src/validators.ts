import { SessionTypes, ProposalTypes, RelayerTypes, EngineTypes } from "@walletconnect/types";
import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import {
  getNamespacesChains,
  getNamespacesMethodsForChainId,
  getNamespacesEventsForChainId,
  getAccountsChains,
} from "./namespaces.js";
import { getSdkError, getInternalError } from "./errors.js";
import { fromBase64, hasOverlap } from "./misc.js";
import { getChainsFromNamespace } from "./caip.js";

export type ErrorObject = { message: string; code: number } | null;

// -- types validation ----------------------------------------------------- //

export function isValidArray(arr: any, itemCondition?: (item: any) => boolean) {
  if (Array.isArray(arr)) {
    if (typeof itemCondition !== "undefined" && arr.length) {
      return arr.every(itemCondition);
    } else {
      return true;
    }
  }
  return false;
}

export function isValidObject(obj: any) {
  return Object.getPrototypeOf(obj) === Object.prototype && Object.keys(obj).length;
}

export function isUndefined(input: any): input is undefined {
  return typeof input === "undefined";
}

export function isValidString(input: any, optional: boolean): input is string {
  if (optional && isUndefined(input)) return true;

  return typeof input === "string" && Boolean(input.trim().length);
}

export function isValidNumber(input: any, optional: boolean) {
  if (optional && isUndefined(input)) return true;

  return typeof input === "number" && !isNaN(input);
}

// -- protocol validation -------------------------------------------------- //

export function isSessionCompatible(session: SessionTypes.Struct, params: EngineTypes.FindParams) {
  const { requiredNamespaces } = params;
  const sessionKeys = Object.keys(session.namespaces);
  const paramsKeys = Object.keys(requiredNamespaces);
  let compatible = true;

  if (!hasOverlap(paramsKeys, sessionKeys)) return false;

  sessionKeys.forEach((key) => {
    const { accounts, methods, events } = session.namespaces[key];
    const chains = getAccountsChains(accounts);
    const requiredNamespace = requiredNamespaces[key];
    if (
      !hasOverlap(getChainsFromNamespace(key, requiredNamespace), chains) ||
      !hasOverlap(requiredNamespace.methods, methods) ||
      !hasOverlap(requiredNamespace.events, events)
    ) {
      compatible = false;
    }
  });

  return compatible;
}

export function isValidChainId(value: any) {
  if (isValidString(value, false) && value.includes(":")) {
    const split = value.split(":");
    return split.length === 2;
  }
  return false;
}

export function isValidAccountId(value: any) {
  if (isValidString(value, false) && value.includes(":")) {
    const split = value.split(":");
    if (split.length === 3) {
      const chainId = split[0] + ":" + split[1];
      return !!split[2] && isValidChainId(chainId);
    }
  }
  return false;
}

export function isValidUrl(value: any) {
  function validateUrl(blob: string) {
    try {
      const url = new URL(blob);
      return typeof url !== "undefined";
    } catch (e) {
      return false;
    }
  }
  try {
    if (isValidString(value, false)) {
      const isValid = validateUrl(value);
      if (isValid) return true;

      const decoded = fromBase64(value);
      return validateUrl(decoded);
    }
  } catch (e) {}
  return false;
}

export function isProposalStruct(input: any): input is ProposalTypes.Struct {
  return input?.proposer?.publicKey;
}

export function isSessionStruct(input: any): input is SessionTypes.Struct {
  return input?.topic;
}

export function isValidController(input: any, method: string) {
  let error: ErrorObject = null;
  if (!isValidString(input?.publicKey, false)) {
    error = getInternalError(
      "MISSING_OR_INVALID",
      `${method} controller public key should be a string`,
    );
  }

  return error;
}

export function isValidNamespaceMethodsOrEvents(input: any): input is string {
  let valid = true;
  if (isValidArray(input)) {
    if (input.length) {
      valid = input.every((item: any) => isValidString(item, false));
    }
  } else {
    valid = false;
  }

  return valid;
}

export function isValidChains(key: string, chains: any, context: string) {
  let error: ErrorObject = null;

  if (isValidArray(chains) && chains.length) {
    chains.forEach((chain: any) => {
      if (error) return;
      if (!isValidChainId(chain)) {
        error = getSdkError(
          "UNSUPPORTED_CHAINS",
          `${context}, chain ${chain} should be a string and conform to "namespace:chainId" format`,
        );
      }
    });
  } else if (!isValidChainId(key)) {
    error = getSdkError(
      "UNSUPPORTED_CHAINS",
      `${context}, chains must be defined as "namespace:chainId" e.g. "eip155:1": {...} in the namespace key OR as an array of CAIP-2 chainIds e.g. eip155: { chains: ["eip155:1", "eip155:5"] }`,
    );
  }

  return error;
}

export function isValidNamespaceChains(namespaces: any, method: string, type: string) {
  let error: ErrorObject = null;
  Object.entries(namespaces).forEach(([key, namespace]: [string, any]) => {
    if (error) return;
    const validChainsError = isValidChains(
      key,
      getChainsFromNamespace(key, namespace),
      `${method} ${type}`,
    );
    if (validChainsError) {
      error = validChainsError;
    }
  });

  return error;
}

export function isValidAccounts(accounts: any, context: string) {
  let error: ErrorObject = null;
  if (isValidArray(accounts)) {
    accounts.forEach((account: any) => {
      if (error) return;
      if (!isValidAccountId(account)) {
        error = getSdkError(
          "UNSUPPORTED_ACCOUNTS",
          `${context}, account ${account} should be a string and conform to "namespace:chainId:address" format`,
        );
      }
    });
  } else {
    error = getSdkError(
      "UNSUPPORTED_ACCOUNTS",
      `${context}, accounts should be an array of strings conforming to "namespace:chainId:address" format`,
    );
  }

  return error;
}

export function isValidNamespaceAccounts(input: any, method: string) {
  let error: ErrorObject = null;
  Object.values(input).forEach((namespace: any) => {
    if (error) return;
    const validAccountsError = isValidAccounts(namespace?.accounts, `${method} namespace`);
    if (validAccountsError) {
      error = validAccountsError;
    }
  });

  return error;
}

export function isValidActions(namespace: any, context: string) {
  let error: ErrorObject = null;
  if (!isValidNamespaceMethodsOrEvents(namespace?.methods)) {
    error = getSdkError(
      "UNSUPPORTED_METHODS",
      `${context}, methods should be an array of strings or empty array for no methods`,
    );
  } else if (!isValidNamespaceMethodsOrEvents(namespace?.events)) {
    error = getSdkError(
      "UNSUPPORTED_EVENTS",
      `${context}, events should be an array of strings or empty array for no events`,
    );
  }

  return error;
}

export function isValidNamespaceActions(input: any, method: string) {
  let error: ErrorObject = null;
  Object.values(input).forEach((namespace: any) => {
    if (error) return;
    const validActionsError = isValidActions(namespace, `${method}, namespace`);
    if (validActionsError) {
      error = validActionsError;
    }
  });

  return error;
}

export function isValidRequiredNamespaces(input: any, method: string, type: string) {
  let error: ErrorObject = null;
  if (input && isValidObject(input)) {
    const validActionsError = isValidNamespaceActions(input, method);
    if (validActionsError) {
      error = validActionsError;
    }
    const validChainsError = isValidNamespaceChains(input, method, type);
    if (validChainsError) {
      error = validChainsError;
    }
  } else {
    error = getInternalError(
      "MISSING_OR_INVALID",
      `${method}, ${type} should be an object with data`,
    );
  }

  return error;
}

export function isValidNamespaces(input: any, method: string) {
  let error: ErrorObject = null;
  if (input && isValidObject(input)) {
    const validActionsError = isValidNamespaceActions(input, method);
    if (validActionsError) {
      error = validActionsError;
    }
    const validAccountsError = isValidNamespaceAccounts(input, method);
    if (validAccountsError) {
      error = validAccountsError;
    }
  } else {
    error = getInternalError(
      "MISSING_OR_INVALID",
      `${method}, namespaces should be an object with data`,
    );
  }

  return error;
}

export function isValidRelay(input: any): input is RelayerTypes.ProtocolOptions {
  return isValidString(input.protocol, true);
}

export function isValidRelays(
  input: any,
  optional: boolean,
): input is RelayerTypes.ProtocolOptions[] {
  let valid = false;

  if (optional && !input) valid = true;
  else if (input && isValidArray(input) && input.length) {
    input.forEach((relay: RelayerTypes.ProtocolOptions) => {
      valid = isValidRelay(relay);
    });
  }

  return valid;
}

export function isValidId(input: any) {
  return typeof input === "number";
}

export function isValidParams(input: any) {
  // eslint-disable-next-line valid-typeof
  return typeof input !== "undefined" && typeof input !== null;
}

export function isValidErrorReason(input: any): input is ErrorResponse {
  if (!input) return false;
  if (typeof input !== "object") return false;
  if (!input.code || !isValidNumber(input.code, false)) return false;
  if (!input.message || !isValidString(input.message, false)) return false;

  return true;
}

export function isValidRequest(request: any) {
  if (isUndefined(request)) return false;
  if (!isValidString(request.method, false)) return false;
  return true;
}

export function isValidResponse(response: any) {
  if (isUndefined(response)) return false;
  if (isUndefined(response.result) && isUndefined(response.error)) return false;
  if (!isValidNumber(response.id, false)) return false;
  if (!isValidString(response.jsonrpc, false)) return false;
  return true;
}

export function isValidEvent(event: any) {
  if (isUndefined(event)) return false;
  if (!isValidString(event.name, false)) return false;
  return true;
}

export function isValidNamespacesChainId(namespaces: SessionTypes.Namespaces, chainId: string) {
  if (!isValidChainId(chainId)) return false;
  const chains = getNamespacesChains(namespaces);
  if (!chains.includes(chainId)) return false;

  return true;
}

export function isValidNamespacesRequest(
  namespaces: SessionTypes.Namespaces,
  chainId: string,
  method: string,
) {
  if (!isValidString(method, false)) return false;
  const methods = getNamespacesMethodsForChainId(namespaces, chainId);
  return methods.includes(method);
}

export function isValidNamespacesEvent(
  namespaces: SessionTypes.Namespaces,
  chainId: string,
  eventName: string,
) {
  if (!isValidString(eventName, false)) return false;
  const events = getNamespacesEventsForChainId(namespaces, chainId);
  return events.includes(eventName);
}

export function isConformingNamespaces(
  requiredNamespaces: ProposalTypes.RequiredNamespaces,
  namespaces: SessionTypes.Namespaces,
  context: string,
) {
  let error: ErrorObject = null;

  const parsedRequired = parseNamespaces(requiredNamespaces);
  const parsedApproved = parseApprovedNamespaces(namespaces);
  const requiredChains = Object.keys(parsedRequired);
  const approvedChains = Object.keys(parsedApproved);

  const uniqueRequired = filterDuplicateNamespaces(Object.keys(requiredNamespaces));
  const uniqueApproved = filterDuplicateNamespaces(Object.keys(namespaces));
  const missingRequiredNamespaces = uniqueRequired.filter(
    (namespace) => !uniqueApproved.includes(namespace),
  );

  if (missingRequiredNamespaces.length) {
    error = getInternalError(
      "NON_CONFORMING_NAMESPACES",
      `${context} namespaces keys don't satisfy requiredNamespaces.
      Required: ${missingRequiredNamespaces.toString()}
      Received: ${Object.keys(namespaces).toString()}`,
    );
  }

  if (!hasOverlap(requiredChains, approvedChains)) {
    error = getInternalError(
      "NON_CONFORMING_NAMESPACES",
      `${context} namespaces chains don't satisfy required namespaces.
      Required: ${requiredChains.toString()}
      Approved: ${approvedChains.toString()}`,
    );
  }

  // validate inline defined chains with approved accounts
  Object.keys(namespaces).forEach((chain) => {
    if (!chain.includes(":")) return;
    if (error) return;
    const chains = getAccountsChains(namespaces[chain].accounts);
    if (!chains.includes(chain)) {
      error = getInternalError(
        "NON_CONFORMING_NAMESPACES",
        `${context} namespaces accounts don't satisfy namespace accounts for ${chain}
        Required: ${chain}
        Approved: ${chains.toString()}`,
      );
    }
  });

  requiredChains.forEach((chain) => {
    if (error) return;

    if (!hasOverlap(parsedRequired[chain].methods, parsedApproved[chain].methods)) {
      error = getInternalError(
        "NON_CONFORMING_NAMESPACES",
        `${context} namespaces methods don't satisfy namespace methods for ${chain}`,
      );
    } else if (!hasOverlap(parsedRequired[chain].events, parsedApproved[chain].events)) {
      error = getInternalError(
        "NON_CONFORMING_NAMESPACES",
        `${context} namespaces events don't satisfy namespace events for ${chain}`,
      );
    }
  });

  return error;
}

function parseNamespaces(namespaces: ProposalTypes.RequiredNamespaces) {
  const parsed: ProposalTypes.RequiredNamespaces = {};
  Object.keys(namespaces).forEach((key) => {
    // e.g. `eip155:1`
    const isInlineChainDefinition = key.includes(":");

    if (isInlineChainDefinition) {
      parsed[key] = namespaces[key];
    } else {
      namespaces[key].chains?.forEach((chain) => {
        parsed[chain] = {
          methods: namespaces[key].methods,
          events: namespaces[key].events,
        };
      });
    }
  });
  return parsed;
}

function filterDuplicateNamespaces(namespaces: string[]) {
  return [
    ...new Set(
      namespaces.map((namespace) =>
        namespace.includes(":") ? namespace.split(":")[0] : namespace,
      ),
    ),
  ];
}

function parseApprovedNamespaces(namespaces: SessionTypes.Namespaces) {
  const parsed: SessionTypes.Namespaces = {};
  Object.keys(namespaces).forEach((key) => {
    const isInlineChainDefinition = key.includes(":");
    if (isInlineChainDefinition) {
      parsed[key] = namespaces[key];
    } else {
      const chains = getAccountsChains(namespaces[key].accounts);
      chains?.forEach((chain) => {
        parsed[chain] = {
          accounts: namespaces[key].accounts.filter((account: string) =>
            account.includes(`${chain}:`),
          ),
          methods: namespaces[key].methods,
          events: namespaces[key].events,
        };
      });
    }
  });
  return parsed;
}

export function isValidRequestExpiry(expiry: number, boundaries: { min: number; max: number }) {
  return isValidNumber(expiry, false) && expiry <= boundaries.max && expiry >= boundaries.min;
}
