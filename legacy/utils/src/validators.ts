import * as encoding from "@walletconnect/encoding";
import {
  IJsonRpcSubscription,
  IJsonRpcRequest,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IInternalEvent,
  SIGNING_METHODS,
  RESERVED_EVENTS,
} from "@walletconnect/legacy-types";

export function isEmptyString(value: string): boolean {
  return value === "" || (typeof value === "string" && value.trim() === "");
}

export function isEmptyArray(array: any[]): boolean {
  return !(array && array.length);
}

export function isBuffer(val: any) {
  return encoding.isBuffer(val);
}

export function isTypedArray(val: any) {
  return encoding.isTypedArray(val);
}

export function isArrayBuffer(val: any) {
  return encoding.isArrayBuffer(val);
}

export function getType(val: any) {
  return encoding.getType(val);
}

export function getEncoding(val: any) {
  return encoding.getEncoding(val);
}

export function isHexString(value: any, length?: number): boolean {
  return encoding.isHexString(value, length);
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
  return RESERVED_EVENTS.includes(event) || event.startsWith("wc_");
}

export function isSilentPayload(request: IJsonRpcRequest): boolean {
  if (request.method.startsWith("wc_")) {
    return true;
  }
  if (SIGNING_METHODS.includes(request.method)) {
    return false;
  }
  return true;
}
