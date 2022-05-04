import { SessionTypes, ProposalTypes, RelayerTypes } from "@walletconnect/types";
import { hasOverlap, isNamespaceEqual } from "./misc";

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

export function isValidNamespace(input: any): input is SessionTypes.Namespace {
  const { methods, events, chains } = input;
  return isValidArray(methods) && isValidArray(events) && isValidArray(chains);
}

export function isValidRelay(input: any): input is RelayerTypes.ProtocolOptions {
  return isValidString(input.protocol, true);
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
