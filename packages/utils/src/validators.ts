import { SessionTypes, ProposalTypes, RelayerTypes, EngineTypes } from "@walletconnect/types";
import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import {
  getNamespacesChains,
  getNamespacesMethodsForChainId,
  getNamespacesEventsForChainId,
  getAccountsChains,
} from "./namespaces";
import { hasOverlap, getDeletedDiff } from "./misc";

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

export function isValidRequiredNamespaceBody(
  input: any,
): input is ProposalTypes.BaseRequiredNamespace {
  const { methods, events, chains } = input;
  let validChains = true;
  const validRequiredNamespace =
    isValidArray(methods) && isValidArray(events) && isValidArray(chains);
  if (validRequiredNamespace) {
    chains.forEach((chain: string) => {
      if (!isValidChainId(chain)) validChains = false;
    });
  }

  return validRequiredNamespace && validChains;
}

export function isValidRequiredNamespaces(input: any): input is ProposalTypes.RequiredNamespaces {
  let valid = false;
  if (input && isValidObject(input)) {
    valid = true;
    Object.values(input).forEach((namespace: any) => {
      if (!isValidRequiredNamespaceBody(namespace)) valid = false;
      if (valid && namespace?.extension) {
        if (!isValidArray(namespace.extension)) valid = false;
        namespace.extension.forEach((extension: any) => {
          if (!isValidRequiredNamespaceBody(extension)) valid = false;
        });
      }
    });
  }

  return valid;
}

export function isValidNamespaceBody(input: any): input is SessionTypes.BaseNamespace {
  const { methods, events, accounts } = input;
  let validAccounts = true;
  const validNamespace = isValidArray(methods) && isValidArray(events) && isValidArray(accounts);
  if (validNamespace) {
    accounts.forEach((account: string) => {
      if (!isValidAccountId(account)) validAccounts = false;
    });
  }

  return validNamespace && validAccounts;
}

export function isValidNamespaces(input: any): input is SessionTypes.Namespaces {
  let valid = false;
  if (input && isValidObject(input)) {
    valid = true;
    Object.values(input).forEach((namespace: any) => {
      if (!isValidNamespaceBody(namespace)) valid = false;
      if (valid && namespace?.extension) {
        if (!isValidArray(namespace.extension)) valid = false;
        namespace.extension.forEach((extension: any) => {
          if (!isValidNamespaceBody(extension)) valid = false;
        });
      }
    });
  }

  return valid;
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
  return Object.keys(getDeletedDiff(requiredNamespaces, namespaces)).length === 0;
}
