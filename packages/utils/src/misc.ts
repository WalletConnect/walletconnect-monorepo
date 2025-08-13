import { detect } from "detect-browser";
import { FIVE_MINUTES, fromMiliseconds, toMiliseconds } from "@walletconnect/time";
import {
  SignClientTypes,
  RelayerClientMetadata,
  EngineTypes,
  RelayerTypes,
} from "@walletconnect/types";
import { getDocument, getLocation, getNavigator } from "@walletconnect/window-getters";
import { getWindowMetadata } from "@walletconnect/window-metadata";
import { ErrorResponse } from "@walletconnect/jsonrpc-utils";
import { IKeyValueStorage } from "@walletconnect/keyvaluestorage";

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

export const SDK_TYPE = "js";

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

export function isAndroid(): boolean {
  return (
    isReactNative() &&
    typeof global !== "undefined" &&
    typeof (global as any)?.Platform !== "undefined" &&
    (global as any)?.Platform.OS === "android"
  );
}

export function isIos(): boolean {
  return (
    isReactNative() &&
    typeof global !== "undefined" &&
    typeof (global as any)?.Platform !== "undefined" &&
    (global as any)?.Platform.OS === "ios"
  );
}

export function isBrowser(): boolean {
  return !isNode() && !!getNavigator() && !!getDocument();
}

export function getEnvironment(): string {
  if (isReactNative()) return ENV_MAP.reactNative;
  if (isNode()) return ENV_MAP.node;
  if (isBrowser()) return ENV_MAP.browser;
  return ENV_MAP.unknown;
}

export function getAppId(): string | undefined {
  try {
    if (
      isReactNative() &&
      typeof global !== "undefined" &&
      typeof (global as any)?.Application !== "undefined"
    ) {
      return (global as any).Application?.applicationId;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// -- query -----------------------------------------------//

export function appendToQueryString(
  queryString: string,
  newQueryParams: Record<string, string | number | boolean | undefined>,
): string {
  const urlSearchParams = new URLSearchParams(queryString);

  Object.entries(newQueryParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlSearchParams.set(key, String(value));
      }
    });

  return urlSearchParams.toString();
}

// -- metadata ----------------------------------------------//

export function populateAppMetadata(metadata?: SignClientTypes.Metadata): SignClientTypes.Metadata {
  const appMetadata = getAppMetadata();
  try {
    if (metadata?.url && appMetadata.url) {
      if (new URL(metadata.url).host !== new URL(appMetadata.url).host) {
        console.warn(
          `The configured WalletConnect 'metadata.url':${metadata.url} differs from the actual page url:${appMetadata.url}. This is probably unintended and can lead to issues.`,
        );
        metadata.url = appMetadata.url;
      }
    }

    if (metadata?.icons?.length && metadata.icons.length > 0) {
      metadata.icons = metadata.icons.filter((icon) => icon !== "");
    }

    return {
      ...appMetadata,
      ...metadata,
      url: metadata?.url || appMetadata.url,
      name: metadata?.name || appMetadata.name,
      description: metadata?.description || appMetadata.description,
      icons:
        metadata?.icons?.length && metadata.icons.length > 0 ? metadata.icons : appMetadata.icons,
    };
  } catch (error) {
    console.warn("Error populating app metadata", error);
    return metadata || appMetadata;
  }
}

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
    metadata.host = getLocation()?.host || "unknown";
  }
  return metadata;
}

// -- rpcUrl ----------------------------------------------//

export function getJavascriptOS() {
  const env = getEnvironment();
  // global.Platform is set by react-native-compat
  if (
    env === ENV_MAP.reactNative &&
    typeof global !== "undefined" &&
    typeof (global as any)?.Platform !== "undefined"
  ) {
    const { OS, Version } = (global as any).Platform;
    return [OS, Version].join("-");
  }

  const info = detect();
  if (info === null) return "unknown";
  const os = info.os ? info.os.replace(" ", "").toLowerCase() : "unknown";
  if (info.type === "browser") {
    return [os, info.name, info.version].join("-");
  }
  return [os, info.version].join("-");
}

export function getJavascriptID() {
  const env = getEnvironment();
  return env === ENV_MAP.browser ? [env, getLocation()?.host || "unknown"].join(":") : env;
}

export function formatUA(protocol: string, version: number, sdkVersion: string) {
  const os = getJavascriptOS();
  const id = getJavascriptID();
  return [[protocol, version].join("-"), [SDK_TYPE, sdkVersion].join("-"), os, id].join("/");
}
console;

export function formatRelayRpcUrl({
  protocol,
  version,
  relayUrl,
  sdkVersion,
  auth,
  projectId,
  useOnCloseEvent,
  bundleId,
  packageName,
}: RelayerTypes.RpcUrlParams) {
  const splitUrl = relayUrl.split("?");
  const ua = formatUA(protocol, version, sdkVersion);
  const params = {
    auth,
    ua,
    projectId,
    useOnCloseEvent: useOnCloseEvent || undefined,
    packageName: packageName || undefined,
    bundleId: bundleId || undefined,
  };
  const queryString = appendToQueryString(splitUrl[1] || "", params);
  return splitUrl[0] + "?" + queryString;
}

export function getHttpUrl(url: string) {
  // regex from https://stackoverflow.com/questions/3883871/regexp-to-grab-protocol-from-url
  const matches = url.match(/^[^:]+(?=:\/\/)/gi) || [];
  let protocol = matches[0];
  const domain = typeof protocol !== "undefined" ? url.split("://")[1] : url;
  protocol = protocol === "wss" ? "https" : "http";
  return [protocol, domain].join("://");
}

// -- assert ------------------------------------------------- //

export function assertType(obj: any, key: string, type: string) {
  // eslint-disable-next-line valid-typeof
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
  const matches = a.filter((x) => b.includes(x));
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
  const res: any = {};
  Object.keys(obj).forEach((key) => {
    res[key] = cb(obj[key]);
  });
  return res;
}

// -- enum ------------------------------------------------- //

// source: https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275
export const enumify = <T extends { [index: string]: U }, U extends string>(x: T): T => x;

// -- string ------------------------------------------------- //

export function capitalizeWord(word: string) {
  return word.trim().replace(/^\w/, (c) => c.toUpperCase());
}

export function capitalize(str: string) {
  return str
    .split(EMPTY_SPACE)
    .map((w) => capitalizeWord(w))
    .join(EMPTY_SPACE);
}

// -- promises --------------------------------------------- //
export function createDelayedPromise<T>(
  expiry: number = FIVE_MINUTES,
  expireErrorMessage?: string,
) {
  const timeout = toMiliseconds(expiry || FIVE_MINUTES);
  let cacheResolve: undefined | ((value: T | PromiseLike<T>) => void);
  let cacheReject: undefined | ((value?: ErrorResponse) => void);
  let cacheTimeout: undefined | NodeJS.Timeout;
  let result: Promise<Awaited<T>> | Promise<T> | undefined;

  const done = () =>
    new Promise<T>((promiseResolve, promiseReject) => {
      if (result) {
        return promiseResolve(result);
      }
      cacheTimeout = setTimeout(() => {
        const err = new Error(expireErrorMessage);
        result = Promise.reject(err);
        promiseReject(err);
      }, timeout);
      cacheResolve = promiseResolve;
      cacheReject = promiseReject;
    });
  const resolve = (value?: T) => {
    if (cacheTimeout && cacheResolve) {
      clearTimeout(cacheTimeout);
      cacheResolve(value as T);
      result = Promise.resolve(value) as Promise<Awaited<T>>;
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

export function createExpiringPromise<T>(
  promise: Promise<T>,
  expiry: number,
  expireErrorMessage?: string,
) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(expireErrorMessage)), expiry);
    try {
      const result = await promise;
      resolve(result);
    } catch (error) {
      reject(error);
    }
    clearTimeout(timeout);
  });
}

// -- expirer --------------------------------------------- //

export function formatExpirerTarget(type: "topic" | "id", value: string | number): string {
  if (typeof value === "string" && value.startsWith(`${type}:`)) return value;
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

export function parseExpirerTarget(target: string) {
  const [type, value] = target.split(":");
  const parsed: { id?: number; topic?: string } = { id: undefined, topic: undefined };
  if (type === "topic" && typeof value === "string") {
    parsed.topic = value;
  } else if (type === "id" && Number.isInteger(Number(value))) {
    parsed.id = Number(value);
  } else {
    throw new Error(`Invalid target, expected id:number or topic:string, got ${type}:${value}`);
  }

  return parsed;
}

export function calcExpiry(ttl: number, now?: number): number {
  return fromMiliseconds((now || Date.now()) + toMiliseconds(ttl));
}

export function isExpired(expiry: number) {
  return Date.now() >= toMiliseconds(expiry);
}

// -- events ---------------------------------------------- //

export function engineEvent(event: EngineTypes.Event, id?: number | string | undefined) {
  return `${event}${id ? `:${id}` : ""}`;
}

export function mergeArrays<T>(a: T[] = [], b: T[] = []): T[] {
  return [...new Set([...a, ...b])];
}

export async function handleDeeplinkRedirect({
  id,
  topic,
  wcDeepLink,
}: {
  id: number;
  topic: string;
  wcDeepLink: string;
}) {
  try {
    if (!wcDeepLink) return;

    const json = typeof wcDeepLink === "string" ? JSON.parse(wcDeepLink) : wcDeepLink;
    const deeplink = json?.href;
    if (typeof deeplink !== "string") return;
    const link = formatDeeplinkUrl(deeplink, id, topic);
    const env = getEnvironment();

    if (env === ENV_MAP.browser) {
      if (!getDocument()?.hasFocus()) {
        console.warn("Document does not have focus, skipping deeplink.");
        return;
      }

      openDeeplink(link);
    } else if (env === ENV_MAP.reactNative) {
      // global.Linking is set by react-native-compat
      if (typeof (global as any)?.Linking !== "undefined") {
        await (global as any).Linking.openURL(link);
      }
    }
  } catch (err) {
    // Silent error, just log in console
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

export function formatDeeplinkUrl(deeplink: string, requestId: number, sessionTopic: string) {
  const payload = `requestId=${requestId}&sessionTopic=${sessionTopic}`;
  if (deeplink.endsWith("/")) deeplink = deeplink.slice(0, -1);
  let link = `${deeplink}`;
  if (deeplink.startsWith("https://t.me")) {
    const startApp = deeplink.includes("?") ? "&startapp=" : "?startapp=";
    link = `${link}${startApp}${toBase64(payload, true)}`;
  } else {
    link = `${link}/wc?${payload}`;
  }
  return link;
}

export function openDeeplink(url: string) {
  let target = "_self";
  if (isIframe()) {
    target = "_top";
  } else if (isTelegram() || url.startsWith("https://") || url.startsWith("http://")) {
    target = "_blank";
  }

  window.open(url, target, "noreferrer noopener");
}

export async function getDeepLink(storage: IKeyValueStorage, key: string) {
  let link: string | undefined = "";
  try {
    if (isBrowser()) {
      link = localStorage.getItem(key) as string;
      if (link) return link;
    }
    link = await storage.getItem(key);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  return link;
}

export function getCommonValuesInArrays<T = string | number | boolean>(arr1: T[], arr2: T[]): T[] {
  return arr1.filter((value) => arr2.includes(value));
}

export function getSearchParamFromURL(url: string, param: any) {
  const include = url.includes(param);
  if (!include) return null;
  const params = url.split(/([&,?,=])/);
  const index = params.indexOf(param);
  const value = params[index + 2];
  return value;
}

export function uuidv4() {
  if (typeof crypto !== "undefined" && crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/gu, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;

    return v.toString(16);
  });
}

export function isTestRun() {
  return typeof process !== "undefined" && process.env.IS_VITEST === "true";
}

export function isTelegram() {
  return (
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Boolean((window as any).TelegramWebviewProxy) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Boolean((window as any).Telegram) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Boolean((window as any).TelegramWebviewProxyProto))
  );
}

export function isIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return false;
  }
}

export function toBase64(input: string, removePadding = false): string {
  const encoded = Buffer.from(input).toString("base64");
  return removePadding ? encoded.replace(/[=]/g, "") : encoded;
}

export function fromBase64(encodedString: string): string {
  return Buffer.from(encodedString, "base64").toString("utf-8");
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class LimitedSet<T> {
  private limit: number;
  private set: Set<T>;

  constructor({ limit }: { limit: number }) {
    this.limit = limit;
    this.set = new Set<T>();
  }

  add(item: T) {
    if (this.set.has(item)) return;

    if (this.set.size >= this.limit) {
      // Remove the oldest entry (FIFO)
      const firstKey = this.set.values().next().value;
      if (firstKey) {
        this.set.delete(firstKey);
      }
    }

    this.set.add(item);
  }

  has(item: T) {
    return this.set.has(item);
  }
}
