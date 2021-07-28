import * as qs from "query-string";
import { getWindowMetadata } from "@walletconnect/window-metadata";
import { getDocument, getLocation, getNavigator } from "@walletconnect/window-getters";
import { RelayClientMetadata, AppMetadata } from "@walletconnect/types";

// -- env -----------------------------------------------//

export function isNode(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions !== "undefined" &&
    typeof process.versions.node !== "undefined"
  );
}

export function isReactNative(): boolean {
  return !getDocument() && !!getNavigator() && navigator.product === "ReactNative";
}

export function isBrowser(): boolean {
  return !isNode() && !!getNavigator();
}

export function getEnvironment(): string {
  if (isReactNative()) return "react-native";
  if (isNode()) return "node";
  if (isBrowser()) return "browser";
  return "unknown";
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

export function formatRelayRpcUrl(protocol: string, version: number, url: string): string {
  const splitUrl = url.split("?");
  const params = getRelayClientMetadata(protocol, version);
  const queryString = appendToQueryString(splitUrl[1] || "", params);
  return splitUrl[0] + "?" + queryString;
}

// -- assert ------------------------------------------------- //

export function assertType(obj: any, key: string, type: string) {
  if (!obj[key] || typeof obj[key] !== type) {
    throw new Error(`Missing or invalid "${key}" param`);
  }
}

// -- array ------------------------------------------------- //

export function hasOverlap(a: any[], b: any[]) {
  const matches = a.filter(x => b.includes(x));
  return matches.length === a.length;
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
    .split(" ")
    .map(w => capitalizeWord(w))
    .join(" ");
}
