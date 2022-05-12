import { SessionTypes, ProposalTypes, RelayerTypes } from "@walletconnect/types";
import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import isEqual from "lodash.isequal";
import {
  getNamespacesChains,
  getNamespacesMethodsForChainId,
  getNamespacesEventsForChainId,
} from "./namespaces";

export function isSessionCompatible(session: SessionTypes.Struct, filters: SessionTypes.Updatable) {
  const results = [];
  const { namespace, expiry } = filters;
  if (session.namespaces && namespace) {
    Object.keys(session.namespaces).forEach(key => {
      if (key === namespace.key) {
        results.push(isEqual(session.namespaces[key], namespace.body));
      }
    });
  }
  if (session.expiry && expiry) {
    results.push(session.expiry >= expiry);
  }
  return !results.includes(false);
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

export function isValidChainId(value: any, optional: boolean) {
  if (typeof value === "undefined" && optional) return true;
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
      return !!split[2] && isValidChainId(chainId, false);
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
): input is ProposalTypes.RequiredNamespaceBody {
  const { methods, events, chains } = input;
  let validChains = true;
  const validRequiredNamespace =
    isValidArray(methods) && isValidArray(events) && isValidArray(chains);
  chains.forEach((chain: string) => {
    if (!isValidChainId(chain, false)) validChains = false;
  });

  return validRequiredNamespace && validChains;
}

export function isValidRequiredNamespaces(
  input: any,
  optional: boolean,
): input is ProposalTypes.RequiredNamespaces {
  let valid = false;
  if (optional && !input) valid = true;
  else if (input && isValidObject(input)) {
    valid = true;
    Object.values(input).forEach(namespace => {
      if (!isValidRequiredNamespaceBody(namespace)) valid = false;
    });
  }

  return valid;
}

export function isValidNamespaceBody(input: any): input is SessionTypes.NamespaceBody {
  const { methods, events, accounts } = input;
  let validAccounts = true;
  const validNamespace = isValidArray(methods) && isValidArray(events) && isValidArray(accounts);
  accounts.forEach((account: string) => {
    if (!isValidAccountId(account)) validAccounts = false;
  });
  return validNamespace && validAccounts;
}

export function isValidNamespaces(input: any, optional: boolean): input is SessionTypes.Namespaces {
  let valid = false;

  if (optional && !input) valid = true;
  else if (input && isValidObject(input)) {
    valid = true;
    Object.values(input).forEach(namespace => {
      if (!isValidNamespaceBody(namespace)) valid = false;
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

export function isValidAccounts(input: any, optional: boolean): input is string[] {
  let valid = false;

  if (optional && !input) valid = true;
  else if (input && isValidArray(input) && input.length) {
    input.forEach((account: string) => {
      valid = isValidAccountId(account);
    });
  }

  return valid;
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
  if (!isValidChainId(chainId, false)) return false;
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
