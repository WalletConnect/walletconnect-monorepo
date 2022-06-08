import { FIVE_MINUTES, fromMiliseconds, toMiliseconds } from "@walletconnect/time";
import { SignClientTypes, RelayerClientMetadata, EngineTypes } from "@walletconnect/types";
import { getDocument, getLocation, getNavigator } from "@walletconnect/window-getters";
import { getWindowMetadata } from "@walletconnect/window-metadata";
import { ErrorResponse } from "@walletconnect/jsonrpc-utils";
import * as qs from "query-string";
import { isValidObject } from "./validators";

// -- constants -----------------------------------------//

export const REACT_NATIVE_PRODUCT = "ReactNative";

export const ENV_MAP = {
  reactNative: "react-native",
  node: "node",
  browser: "browser",
  unknown: "unknown",
};

export const EMPTY_SPACE = " ";

export const COLON = ":";

export const SLASH = "/";

export const DEFAULT_DEPTH = 2;

export const ONE_THOUSAND = 1000;

// -- env -----------------------------------------------//

export function isNode(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions !== "undefined" &&
    typeof process.versions.node !== "undefined"
  );
}

export function isReactNative(): boolean {
  return !getDocument() && !!getNavigator() && navigator.product === REACT_NATIVE_PRODUCT;
}

export function isBrowser(): boolean {
  return !isNode() && !!getNavigator();
}

export function getEnvironment(): string {
  if (isReactNative()) return ENV_MAP.reactNative;
  if (isNode()) return ENV_MAP.node;
  if (isBrowser()) return ENV_MAP.browser;
  return ENV_MAP.unknown;
}

// -- query -----------------------------------------------//

export function appendToQueryString(queryString: string, newQueryParams: any): string {
  let queryParams = qs.parse(queryString);

  queryParams = { ...queryParams, ...newQueryParams };

  queryString = qs.stringify(queryParams);

  return queryString;
}

// -- metadata ----------------------------------------------//

export function getAppMetadata(): SignClientTypes.Metadata {
  return (
    getWindowMetadata() || {
      name: "",
      description: "",
      url: "",
      icons: [""],
    }
  );
}

export function getRelayClientMetadata(protocol: string, version: number): RelayerClientMetadata {
  const env = getEnvironment();

  const metadata: RelayerClientMetadata = { protocol, version, env };
  if (env === "browser") {
    metadata.host = getLocation()?.host || "";
  }
  return metadata;
}

// -- rpcUrl ----------------------------------------------//

export function formatRelayRpcUrl(
  protocol: string,
  version: number,
  url: string,
  projectId?: string,
): string {
  const splitUrl = url.split("?");
  const metadata = getRelayClientMetadata(protocol, version);
  const params = projectId ? { ...metadata, projectId } : metadata;
  const queryString = appendToQueryString(splitUrl[1] || "", params);
  return splitUrl[0] + "?" + queryString;
}

// -- assert ------------------------------------------------- //

export function assertType(obj: any, key: string, type: string) {
  if (!obj[key] || typeof obj[key] !== type) {
    throw new Error(`Missing or invalid "${key}" param`);
  }
}

// -- context ------------------------------------------------- //

export function parseContextNames(context: string, depth = DEFAULT_DEPTH) {
  return getLastItems(context.split(SLASH), depth);
}

export function formatMessageContext(context: string): string {
  return parseContextNames(context).join(EMPTY_SPACE);
}

// -- array ------------------------------------------------- //

export function hasOverlap(a: any[], b: any[]): boolean {
  const matches = a.filter(x => b.includes(x));
  return matches.length === a.length;
}

export function getLastItems(arr: any[], depth = DEFAULT_DEPTH): any[] {
  return arr.slice(Math.max(arr.length - depth, 0));
}

// -- map ------------------------------------------------- //

export function mapToObj<T = any>(map: Map<string, T>): Record<string, T> {
  return Object.fromEntries(map.entries());
}

export function objToMap<T = any>(obj: Record<string, T>): Map<string, T> {
  return new Map<string, T>(Object.entries<T>(obj));
}

export function mapEntries<A = any, B = any>(
  obj: Record<string, A>,
  cb: (x: A) => B,
): Record<string, B> {
  const res = {};
  Object.keys(obj).forEach(key => {
    res[key] = cb(obj[key]);
  });
  return res;
}

// -- enum ------------------------------------------------- //

// source: https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275
export const enumify = <T extends { [index: string]: U }, U extends string>(x: T): T => x;

// -- string ------------------------------------------------- //

export function capitalizeWord(word: string) {
  return word.trim().replace(/^\w/, c => c.toUpperCase());
}

export function capitalize(str: string) {
  return str
    .split(EMPTY_SPACE)
    .map(w => capitalizeWord(w))
    .join(EMPTY_SPACE);
}

// -- time ------------------------------------------------- //

export function calcExpiry(ttl: number, now?: number): number {
  return fromMiliseconds((now || Date.now()) + toMiliseconds(ttl));
}

export function isExpired(expiry: number) {
  return fromMiliseconds(Date.now()) >= toMiliseconds(expiry);
}

// -- promises --------------------------------------------- //
export function createDelayedPromise<T>() {
  const timeout = toMiliseconds(FIVE_MINUTES);
  let cacheResolve: undefined | ((value?: T) => void);
  let cacheReject: undefined | ((value?: ErrorResponse) => void);
  let cacheTimeout: undefined | NodeJS.Timeout;

  const done = () =>
    new Promise<T>((promiseResolve, promiseReject) => {
      cacheTimeout = setTimeout(promiseReject, timeout);
      cacheResolve = promiseResolve;
      cacheReject = promiseReject;
    });
  const resolve = (value?: T) => {
    if (cacheTimeout && cacheResolve) {
      clearTimeout(cacheTimeout);
      cacheResolve(value);
    }
  };
  const reject = (value?: ErrorResponse) => {
    if (cacheTimeout && cacheReject) {
      clearTimeout(cacheTimeout);
      cacheReject(value);
    }
  };

  return {
    resolve,
    reject,
    done,
  };
}

// -- expirer --------------------------------------------- //

export function formatExpirerTarget(type: string, value: string | number): string {
  if (type.toLowerCase() === "topic") {
    if (typeof value !== "string")
      throw new Error(`Value must be "string" for expirer target type: topic`);
    return `topic:${value}`;
  } else if (type.toLowerCase() === "id") {
    if (typeof value !== "number")
      throw new Error(`Value must be "number" for expirer target type: id`);
    return `id:${value}`;
  }
  throw new Error(`Unknown expirer target type: ${type}`);
}

export function formatTopicTarget(topic: string): string {
  return formatExpirerTarget("topic", topic);
}

export function formatIdTarget(id: number): string {
  return formatExpirerTarget("id", id);
}

// -- events ---------------------------------------------- //

export function engineEvent(event: EngineTypes.Event, id?: number | string | undefined) {
  return `${event}${id ? `:${id}` : ""}`;
}

// -- objects --------------------------------------------- //

export function getDeletedDiff(lhs: Record<string, any>, rhs: Record<string, any>) {
  if (lhs === rhs || !isValidObject(lhs) || !isValidObject(rhs)) return {};

  return Object.keys(lhs).reduce((acc, key) => {
    if (rhs.hasOwnProperty(key)) {
      const difference = getDeletedDiff(lhs[key], rhs[key]);
      if (isValidObject(difference)) return acc;
      acc[key] = difference;
      return acc;
    }

    acc[key] = undefined;
    return acc;
  }, {});
}
