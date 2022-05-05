import { SessionTypes, ProposalTypes, RelayerTypes } from "@walletconnect/types";
import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import { hasOverlap, isNamespaceEqual, calcExpiry } from "./misc";
import { getChains } from "./caip";
import { getNamespacesChains, getNamespacesEventsForChainId } from "./namespaces";
import { FIVE_MINUTES, SEVEN_DAYS } from "@walletconnect/time";

export function isSessionCompatible(session: SessionTypes.Struct, filters: SessionTypes.Updatable) {
  const results = [];
  const { accounts, namespace, expiry } = filters;
  if (session.accounts && accounts) {
    results.push(hasOverlap(accounts, session.accounts));
  }
  if (session.namespaces && namespace) {
    session.namespaces.forEach(n => {
      results.push(isNamespaceEqual(namespace, n));
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

export function isValidNamespace(input: any): input is SessionTypes.Namespace {
  const { methods, events, chains } = input;
  return isValidArray(methods) && isValidArray(events) && isValidArray(chains);
}

export function isValidNamespaces(
  input: any,
  optional: boolean,
): input is SessionTypes.Namespace[] {
  let valid = false;

  if (optional && !input) valid = true;
  else if (input && isValidArray(input) && input.length) {
    input.forEach((namespace: SessionTypes.Namespace) => {
      valid = isValidNamespace(namespace);
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
    input.forEach((namespace: SessionTypes.Namespace) => {
      valid = isValidRelay(namespace);
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

export function areAccountsInNamespaces(
  accounts: SessionTypes.Accounts,
  namespaces: SessionTypes.Namespace[],
) {
  const accountChains = getChains(accounts);
  const namespacesChains = getNamespacesChains(namespaces);
  const mismatched: string[] = [];
  let valid = true;

  accountChains.forEach(chain => {
    if (!namespacesChains.includes(chain)) {
      mismatched.push(chain);
      valid = false;
    }
  });

  return {
    valid,
    mismatched,
  };
}

export function isValidExpiry(input: any): input is number {
  if (!isValidNumber(input, false)) return false;

  const MIN_FUTURE = calcExpiry(FIVE_MINUTES);
  const MAX_FUTURE = calcExpiry(SEVEN_DAYS);

  return input >= MIN_FUTURE && input <= MAX_FUTURE;
}

export function isValidEvent(event: any) {
  if (isUndefined(event)) return false;
  if (!isValidString(event.name, false)) return false;
  return true;
}

export function isValidNamespacesChainId(namespaces: SessionTypes.Namespace[], chainId?: string) {
  if (!isValidChainId(chainId, true)) return false;

  if (chainId) {
    const chains = getNamespacesChains(namespaces);
    if (!chains.includes(chainId)) return false;
  }

  return true;
}

export function isValidNamespacesEvent(
  namespaces: SessionTypes.Namespace[],
  chainId: string,
  eventName: string,
) {
  if (!isValidString(eventName, false)) return false;
  const events = getNamespacesEventsForChainId(namespaces, chainId);
  return events.includes(eventName);
}
