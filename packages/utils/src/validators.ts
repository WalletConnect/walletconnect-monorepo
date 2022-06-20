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
import { deletedDiff } from "deep-object-diff";

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
  let valid = true;
  let error = { message: "", code: 0 };
  if (isValidArray(chains)) {
    chains.forEach((chain: any) => {
      if (!valid) return;
      if (!isValidChainId(chain) || !chain.includes(key)) {
        valid = false;
        error = getSdkError(
          "UNSUPPORTED_CHAINS",
          `${context}, chain ${chain} should be a string and conform to "namespace:chainId" format`,
        );
      }
    });
  } else {
    valid = false;
    error = getSdkError(
      "UNSUPPORTED_CHAINS",
      `${context}, chains ${chains} should be an array of strings conforming to "namespace:chainId" format`,
    );
  }

  return { valid, error };
}

export function isValidController(input: any, method: string) {
  let valid = true;
  let error = { message: "", code: 0 };
  if (!isValidString(input?.publicKey, false)) {
    valid = false;
    error = getInternalError(
      "MISSING_OR_INVALID",
      `${method} controller public key should be a string`,
    );
  }

  return { valid, error };
}

export function isValidNamespaceChains(namespaces: any, method: string) {
  let valid = true;
  let error = { message: "", code: 0 };
  Object.entries(namespaces).forEach(([key, namespace]: [string, any]) => {
    if (!valid) return;
    const validChains = isValidChains(key, namespace?.chains, `${method} requiredNamespace`);
    const validExtension = isValidExtension(namespace, method);
    if (!validChains.valid) {
      valid = false;
      error = validChains.error;
    } else if (!validExtension.valid) {
      valid = false;
      error = validExtension.error;
    } else if (namespace.extension) {
      namespace.extension.forEach((extension: any) => {
        if (!valid) return;
        const validChains = isValidChains(key, extension.chains, `${method} extension`);
        if (!validChains.valid) {
          valid = false;
          error = validChains.error;
        }
      });
    }
  });

  return { valid, error };
}

export function isValidAccounts(key: string, accounts: any, context: string) {
  let valid = true;
  let error = { message: "", code: 0 };
  if (isValidArray(accounts)) {
    accounts.forEach((account: any) => {
      if (!valid) return;
      if (!isValidAccountId(account) || !account.includes(key)) {
        valid = false;
        error = getSdkError(
          "UNSUPPORTED_ACCOUNTS",
          `${context}, account ${account} should be a string and conform to "namespace:chainId:address" format`,
        );
      }
    });
  } else {
    valid = false;
    error = getSdkError(
      "UNSUPPORTED_ACCOUNTS",
      `${context}, accounts should be an array of strings conforming to "namespace:chainId:address" format`,
    );
  }

  return { valid, error };
}

export function isValidNamespaceAccounts(input: any, method: string) {
  let valid = true;
  let error = { message: "", code: 0 };
  Object.entries(input).forEach(([key, namespace]: [string, any]) => {
    if (!valid) return;
    const validAccounts = isValidAccounts(key, namespace?.accounts, `${method} namespace`);
    const validExtension = isValidExtension(namespace, method);
    if (!validAccounts.valid) {
      valid = false;
      error = validAccounts.error;
    } else if (!validExtension.valid) {
      valid = false;
      error = validExtension.error;
    } else if (namespace.extension) {
      namespace.extension.forEach((extension: any) => {
        if (!valid) return;
        const validAccounts = isValidAccounts(key, extension.accounts, `${method} extension`);
        if (!validAccounts.valid) {
          valid = false;
          error = validAccounts.error;
        }
      });
    }
  });

  return { valid, error };
}

export function isValidActions(namespace: any, context: string) {
  let valid = true;
  let error = { message: "", code: 0 };
  if (!isValidNamespaceMethodsOrEvents(namespace?.methods)) {
    valid = false;
    error = getSdkError(
      "UNSUPPORTED_METHODS",
      `${context}, methods should be an array of strings or empty array for no methods`,
    );
  } else if (!isValidNamespaceMethodsOrEvents(namespace?.events)) {
    valid = false;
    error = getSdkError(
      "UNSUPPORTED_EVENTS",
      `${context}, events should be an array of strings or empty array for no events`,
    );
  }

  return { valid, error };
}

export function isValidExtension(namespace: any, method: string) {
  let valid = true;
  let error = { message: "", code: 0 };
  if (!isUndefined(namespace?.extension)) {
    if (!isValidArray(namespace.extension) || !namespace.extension.length) {
      valid = false;
      error = getInternalError(
        "MISSING_OR_INVALID",
        `${method} extension should be an array of namespaces, or omitted`,
      );
    }
  }

  return { valid, error };
}

export function isValidNamespaceActions(input: any, method: string) {
  let valid = true;
  let error = { message: "", code: 0 };
  Object.values(input).forEach((namespace: any) => {
    if (!valid) return;
    const validActions = isValidActions(namespace, `${method}, namespace`);
    const validExtension = isValidExtension(namespace, method);
    if (!validActions.valid) {
      valid = false;
      error = validActions.error;
    } else if (!validExtension.valid) {
      valid = false;
      error = validExtension.error;
    } else if (namespace.extension) {
      namespace.extension.forEach((extension: any) => {
        if (!valid) return;
        const validActions = isValidActions(extension, `${method}, extension`);
        if (!validActions.valid) {
          valid = false;
          error = validActions.error;
        }
      });
    }
  });

  return { valid, error };
}

export function isValidRequiredNamespaces(input: any, method: string) {
  let valid = true;
  let error = { message: "", code: 0 };
  if (input && isValidObject(input)) {
    const validActions = isValidNamespaceActions(input, method);
    if (!validActions.valid) {
      valid = false;
      error = validActions.error;
    }
    const validChains = isValidNamespaceChains(input, method);
    if (!validChains.valid) {
      valid = false;
      error = validChains.error;
    }
  } else {
    valid = false;
    error = getInternalError(
      "MISSING_OR_INVALID",
      `${method}, requiredNamespaces should be an object with data`,
    );
  }

  return { valid, error };
}

export function isValidNamespaces(input: any, method: string) {
  let valid = true;
  let error = { message: "", code: 0 };
  if (input && isValidObject(input)) {
    const validActions = isValidNamespaceActions(input, method);
    if (!validActions.valid) {
      valid = false;
      error = validActions.error;
    }
    const validAccounts = isValidNamespaceAccounts(input, method);
    if (!validAccounts.valid) {
      valid = false;
      error = validAccounts.error;
    }
  } else {
    valid = false;
    error = getInternalError(
      "MISSING_OR_INVALID",
      `${method}, namespaces should be an object with data`,
    );
  }

  return { valid, error };
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
) {
  let valid = true;
  let error = { message: "", code: 0 };
  Object.values(deletedDiff(requiredNamespaces, namespaces)).forEach(namespace => {
    if (!valid) return;
    if (namespace.methods) {
      valid = false;
      error = getSdkError("INVALID_METHOD");
    } else if (namespace.events) {
      valid = false;
      error = getSdkError("INVALID_EVENT");
    } else if (namespace.extension) {
      if (namespace.extension.methods) {
        valid = false;
        error = getSdkError("INVALID_METHOD", "extension");
      } else if (namespace.extension.events) {
        valid = false;
        error = getSdkError("INVALID_EVENT", "extension");
      }
    }
  });

  return { valid, error };
}
