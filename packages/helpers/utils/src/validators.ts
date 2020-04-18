import {
  IJsonRpcSubscription,
  IJsonRpcRequest,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IInternalEvent,
} from "@walletconnect/types";

import { signingMethods, reservedEvents } from "./constants";

export function isEmptyString(value: string): boolean {
  return value === "" || (typeof value === "string" && value.trim() === "");
}

export function isEmptyArray(array: any[]): boolean {
  return !(array && array.length);
}

export function isHexString(value: any, length?: number): boolean {
  if (typeof value !== "string" || !value.match(/^0x[0-9A-Fa-f]*$/)) {
    return false;
  }
  if (length && value.length !== 2 + 2 * length) {
    return false;
  }
  return true;
}

export function isJsonRpcSubscription(object: any): object is IJsonRpcSubscription {
  return typeof object.params === "object";
}

export function isJsonRpcRequest(object: any): object is IJsonRpcRequest {
  return typeof object.method !== "undefined";
}

export function isJsonRpcResponseSuccess(object: any): object is IJsonRpcResponseSuccess {
  return typeof object.result !== "undefined";
}

export function isJsonRpcResponseError(object: any): object is IJsonRpcResponseError {
  return typeof object.error !== "undefined";
}

export function isInternalEvent(object: any): object is IInternalEvent {
  return typeof object.event !== "undefined";
}

export function isReservedEvent(event: string) {
  return reservedEvents.includes(event) || event.startsWith("wc_");
}

export function isSilentPayload(request: IJsonRpcRequest): boolean {
  if (request.method.startsWith("wc_")) {
    return true;
  }
  if (signingMethods.includes(request.method)) {
    return false;
  }
  return true;
}
