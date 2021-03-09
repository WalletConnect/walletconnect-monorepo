import {
  IInternalEvent,
  IJsonRpcRequest,
  IJsonRpcResponseError,
  IJsonRpcResponseSuccess,
  IJsonRpcSubscription,
} from "@walletconnect/types";
import * as encUtils from "enc-utils";

import { reservedEvents, signingMethods } from "./constants";

export function isEmptyString(value: string): boolean {
  return value === "" || (typeof value === "string" && value.trim() === "");
}

export function isEmptyArray(array: any[]): boolean {
  return !(array && array.length);
}

export function isBuffer(val: any) {
  return encUtils.isBuffer(val);
}

export function isTypedArray(val: any) {
  return encUtils.isTypedArray(val);
}

export function isArrayBuffer(val: any) {
  return encUtils.isArrayBuffer(val);
}

export function getType(val: any) {
  return encUtils.getType(val);
}

export function getEncoding(val: any) {
  return encUtils.getEncoding(val);
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
