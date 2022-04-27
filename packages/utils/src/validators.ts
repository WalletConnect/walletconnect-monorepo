import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import { SessionTypes, ProposalTypes } from "@walletconnect/types";
import { hasOverlap, isNamespaceEqual } from "./misc";

declare namespace Validation {
  export interface Valid {
    valid: true;
  }

  export interface Invalid {
    valid: false;
    error: ErrorResponse;
  }

  export type Result = Valid | Invalid;
}

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

export function isString(input: unknown): input is string {
  return typeof input === "string";
}

export function isUndefined(input: unknown): input is undefined | null {
  return typeof input !== "undefined" && input !== null;
}

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
  if (isValidString(value) && value.includes(":")) {
    const split = value.split(":");
    if (split.length === 3) {
      const chainId = split[0] + ":" + split[1];
      return !!split[2] && isValidChainId(chainId);
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

export function isValidationInvalid(
  validation: Validation.Result,
): validation is Validation.Invalid {
  return (
    "valid" in validation &&
    validation.valid === false &&
    "error" in validation &&
    typeof validation.error.code === "number" &&
    typeof validation.error.message === "string"
  );
}

export function formatValidResult(): Validation.Valid {
  return { valid: true };
}

export function formatInvalidResult(error: ErrorResponse): Validation.Invalid {
  return { valid: false, error };
}

export function isProposalStruct(input: any): input is ProposalTypes.Struct {
  return input?.proposer?.publicKey;
}

export function isSessionStruct(input: any): input is SessionTypes.Struct {
  return input?.topic;
}
