import { SessionTypes, ProposalTypes, RelayerTypes, EngineTypes } from "@walletconnect/types";
import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import {
  getNamespacesChains,
  getNamespacesMethodsForChainId,
  getNamespacesEventsForChainId,
  getAccountsChains,
} from "./namespaces";
import { getSdkError, getInternalError } from "./errors";
import { hasOverlap } from "./misc";

export type ErrorObject = { message: string; code: number } | null;

// -- types validation ----------------------------------------------------- //

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

export function isValidObject(obj: any) {
  return Object.getPrototypeOf(obj) === Object.prototype && Object.keys(obj).length;
}

export function isUndefined(input: any): input is undefined {
  return typeof input === "undefined";
}

export function isValidString(input: any, optional: boolean) {
  if (optional && isUndefined(input)) return true;

  return typeof input === "string" && Boolean(input.trim().length);
}

export function isValidNumber(input: any, optional: boolean) {
  if (optional && isUndefined(input)) return true;

  return typeof input === "number";
}

// -- protocol validation -------------------------------------------------- //

export function isSessionCompatible(session: SessionTypes.Struct, params: EngineTypes.FindParams) {
  const { requiredNamespaces } = params;
  const sessionKeys = Object.keys(session.namespaces);
  const paramsKeys = Object.keys(requiredNamespaces);
  let compatible = true;

  if (!hasOverlap(paramsKeys, sessionKeys)) return false;

  sessionKeys.forEach(key => {
    const { accounts, methods, events, extension } = session.namespaces[key];
    const chains = getAccountsChains(accounts);
    const requiredNamespace = requiredNamespaces[key];

    if (
      !hasOverlap(requiredNamespace.chains, chains) ||
      !hasOverlap(requiredNamespace.methods, methods) ||
      !hasOverlap(requiredNamespace.events, events)
    ) {
      compatible = false;
    }

    if (compatible && extension) {
      extension.forEach(extensionNamespace => {
        const { accounts, methods, events } = extensionNamespace;
        const chains = getAccountsChains(accounts);
        const overlap = requiredNamespace.extension?.find(
          ext =>
            hasOverlap(ext.chains, chains) &&
            hasOverlap(ext.methods, methods) &&
            hasOverlap(ext.events, events),
        );
        if (!overlap) compatible = false;
      });
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
  if (isValidString(value, false)) {
    try {
      const url = new URL(value);
      return typeof url !== "undefined";
    } catch (e) {
      return false;
    }
  }
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

export function isValidExtension(namespace: any, method: string) {
  let error: ErrorObject = null;
  if (!isUndefined(namespace?.extension)) {
    if (!isValidArray(namespace.extension) || !namespace.extension.length) {
      error = getInternalError(
        "MISSING_OR_INVALID",
        `${method} extension should be an array of namespaces, or omitted`,
      );
    }
  }

  return error;
}

export function isValidNamespaceMethodsOrEvents(input: any): input is string {
  let valid = true;
  if (isValidArray(input)) {
    if (input.length) {
      input.forEach((item: any) => {
        if (!isValidString(item, false)) valid = false;
      });
    }
  } else {
    valid = false;
  }

  return valid;
}

export function isValidChains(key: string, chains: any, context: string) {
  let error: ErrorObject = null;
  if (isValidArray(chains)) {
    chains.forEach((chain: any) => {
      if (error) return;
      if (!isValidChainId(chain) || !chain.includes(key)) {
        error = getSdkError(
          "UNSUPPORTED_CHAINS",
          `${context}, chain ${chain} should be a string and conform to "namespace:chainId" format`,
        );
      }
    });
  } else {
    error = getSdkError(
      "UNSUPPORTED_CHAINS",
      `${context}, chains ${chains} should be an array of strings conforming to "namespace:chainId" format`,
    );
  }

  return error;
}

export function isValidNamespaceChains(namespaces: any, method: string) {
  let error: ErrorObject = null;
  Object.entries(namespaces).forEach(([key, namespace]: [string, any]) => {
    if (error) return;
    const validChainsError = isValidChains(key, namespace?.chains, `${method} requiredNamespace`);
    const validExtensionError = isValidExtension(namespace, method);
    if (validChainsError) {
      error = validChainsError;
    } else if (validExtensionError) {
      error = validExtensionError;
    } else if (namespace.extension) {
      namespace.extension.forEach((extension: any) => {
        if (error) return;
        const validChainsError = isValidChains(key, extension.chains, `${method} extension`);
        if (validChainsError) {
          error = validChainsError;
        }
      });
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
    const validExtensionError = isValidExtension(namespace, method);
    if (validAccountsError) {
      error = validAccountsError;
    } else if (validExtensionError) {
      error = validExtensionError;
    } else if (namespace.extension) {
      namespace.extension.forEach((extension: any) => {
        if (error) return;
        const validAccountsError = isValidAccounts(extension.accounts, `${method} extension`);
        if (validAccountsError) {
          error = validAccountsError;
        }
      });
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
    const validExtensionError = isValidExtension(namespace, method);
    if (validActionsError) {
      error = validActionsError;
    } else if (validExtensionError) {
      error = validExtensionError;
    } else if (namespace.extension) {
      namespace.extension.forEach((extension: any) => {
        if (error) return;
        const validActionsError = isValidActions(extension, `${method}, extension`);
        if (validActionsError) {
          error = validActionsError;
        }
      });
    }
  });

  return error;
}

export function isValidRequiredNamespaces(input: any, method: string) {
  let error: ErrorObject = null;
  if (input && isValidObject(input)) {
    const validActionsError = isValidNamespaceActions(input, method);
    if (validActionsError) {
      error = validActionsError;
    }
    const validChainsError = isValidNamespaceChains(input, method);
    if (validChainsError) {
      error = validChainsError;
    }
  } else {
    error = getInternalError(
      "MISSING_OR_INVALID",
      `${method}, requiredNamespaces should be an object with data`,
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
  const requiredNamespaceKeys = Object.keys(requiredNamespaces);
  const namespaceKeys = Object.keys(namespaces);

  if (!hasOverlap(requiredNamespaceKeys, namespaceKeys)) {
    error = getInternalError(
      "NON_CONFORMING_NAMESPACES",
      `${context} namespaces keys don't satisfy requiredNamespaces`,
    );
  } else {
    requiredNamespaceKeys.forEach(key => {
      if (error) return;

      const requiredNamespaceChains = requiredNamespaces[key].chains;
      const namespaceChains = getAccountsChains(namespaces[key].accounts);

      if (!hasOverlap(requiredNamespaceChains, namespaceChains)) {
        error = getInternalError(
          "NON_CONFORMING_NAMESPACES",
          `${context} namespaces accounts don't satisfy requiredNamespaces chains for ${key}`,
        );
      } else if (!hasOverlap(requiredNamespaces[key].methods, namespaces[key].methods)) {
        error = getInternalError(
          "NON_CONFORMING_NAMESPACES",
          `${context} namespaces methods don't satisfy requiredNamespaces methods for ${key}`,
        );
      } else if (!hasOverlap(requiredNamespaces[key].events, namespaces[key].events)) {
        error = getInternalError(
          "NON_CONFORMING_NAMESPACES",
          `${context} namespaces events don't satisfy requiredNamespaces events for ${key}`,
        );
      } else if (requiredNamespaces[key].extension && !namespaces[key].extension) {
        error = getInternalError(
          "NON_CONFORMING_NAMESPACES",
          `${context} namespaces extension doesn't satisfy requiredNamespaces extension for ${key}`,
        );
      }
    });
  }

  return error;
}
