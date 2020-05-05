import * as encUtils from "enc-utils";
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

export function isTypedArray(val: any) {
  return !!val.buffer && !Buffer.isBuffer(val);
}

export function isArrayBuffer(val: any) {
  return !val.buffer && !Buffer.isBuffer(val) && val.length;
}

export function isType(val: any) {
  if (Buffer.isBuffer(val)) {
    return "buffer";
  } else if (Array.isArray(val)) {
    return "array";
  } else if (isTypedArray(val)) {
    return "typed-array";
  } else if (isArrayBuffer(val)) {
    return "array-buffer";
  } else {
    return typeof val;
  }
}

export function isHexString(value: any, length?: number): boolean {
  return encUtils.isHexString(value, length);
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
