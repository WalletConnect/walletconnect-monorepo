import { IClientMeta } from "@walletconnect/types";
import {
  BotInfo,
  BrowserInfo,
  detect,
  NodeInfo,
  ReactNativeInfo,
  SearchBotDeviceInfo,
} from "detect-browser";
import * as windowGetters from "window-getters";
import * as windowMetadata from "window-metadata";

export function detectEnv(
  userAgent?: string,
): BrowserInfo | BotInfo | NodeInfo | SearchBotDeviceInfo | ReactNativeInfo | null {
  return detect(userAgent);
}

export function detectOS() {
  const env = detectEnv();
  return env && env.os ? env.os : undefined;
}

export function isIOS(): boolean {
  const os = detectOS();
  return os ? os.toLowerCase().includes("ios") : false;
}

export function isMobile(): boolean {
  const os = detectOS();
  return os ? os.toLowerCase().includes("android") || os.toLowerCase().includes("ios") : false;
}

export function isNode(): boolean {
  const env = detectEnv();
  const result = env && env.name ? env.name.toLowerCase() === "node" : false;
  return result;
}

export function isBrowser(): boolean {
  const result = !isNode() && !!getNavigator();
  return result;
}

export const getFromWindow = windowGetters.getFromWindow;

export const getFromWindowOrThrow = windowGetters.getFromWindowOrThrow;

export const getDocumentOrThrow = windowGetters.getDocumentOrThrow;

export const getDocument = windowGetters.getDocument;

export const getNavigatorOrThrow = windowGetters.getNavigatorOrThrow;

export const getNavigator = windowGetters.getNavigator;

export const getLocationOrThrow = windowGetters.getLocationOrThrow;

export const getLocation = windowGetters.getLocation;

export const getCryptoOrThrow = windowGetters.getCryptoOrThrow;

export const getCrypto = windowGetters.getCrypto;

export const getLocalStorageOrThrow = windowGetters.getLocalStorageOrThrow;

export const getLocalStorage = windowGetters.getLocalStorage;

export function getClientMeta(): IClientMeta | null {
  return windowMetadata.getWindowMetadata();
}
