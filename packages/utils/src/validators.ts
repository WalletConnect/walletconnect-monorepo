import { SessionTypes, ProposalTypes } from "@walletconnect/types";
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

export function isValidAccountId(value: any) {
  if (isValidString(value) && value.includes(":")) {
    const split = value.split(":");
    if (split.length === 3) {
      const chainId = split[0] + ":" + split[1];
      return !!split[2] && isValidChainId(chainId);
    }
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

export function isProposalStruct(input: any): input is ProposalTypes.Struct {
  return input?.proposer?.publicKey;
}

export function isSessionStruct(input: any): input is SessionTypes.Struct {
  return input?.topic;
}
