import { getNavigator } from "window-getters";
import {
  detect,
  BrowserInfo,
  BotInfo,
  NodeInfo,
  SearchBotDeviceInfo,
  ReactNativeInfo,
} from "detect-browser";

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
