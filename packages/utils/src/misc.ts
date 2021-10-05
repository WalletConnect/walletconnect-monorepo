import union from "lodash.union";
import * as qs from "query-string";
import { getWindowMetadata } from "@walletconnect/window-metadata";
import { getDocument, getLocation, getNavigator } from "@walletconnect/window-getters";
import { RelayClientMetadata, AppMetadata } from "@walletconnect/types";

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

export function getAppMetadata(): AppMetadata | undefined {
  return getWindowMetadata() || undefined;
}

export function getRelayClientMetadata(protocol: string, version: number): RelayClientMetadata {
  const env = getEnvironment();

  const metadata: RelayClientMetadata = { protocol, version, env };
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
  apiKey?: string,
): string {
  const splitUrl = url.split("?");
  const metadata = getRelayClientMetadata(protocol, version);
  const params = apiKey ? { ...metadata, apiKey } : metadata;
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

export function formatStorageKeyName(context: string): string {
  return parseContextNames(context).join(COLON);
}

// -- array ------------------------------------------------- //

export function hasOverlap(a: any[], b: any[]): boolean {
  const matches = a.filter(x => b.includes(x));
  return matches.length === a.length;
}

export function getLastItems(arr: any[], depth = DEFAULT_DEPTH): any[] {
  return arr.slice(Math.max(arr.length - depth, 0));
}

export function mergeArrays(a: any[], b: any[]): any[] {
  return union(a, b);
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

export function toMiliseconds(seconds: number): number {
  return seconds * ONE_THOUSAND;
}

export function fromMiliseconds(miliseconds: number): number {
  return Math.floor(miliseconds / ONE_THOUSAND);
}

export function calcExpiry(ttl: number, now?: number): number {
  return fromMiliseconds((now || Date.now()) + toMiliseconds(ttl));
}
