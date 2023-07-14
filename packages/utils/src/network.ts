import { getEnvironment, ENV_MAP, isBrowser, isReactNative } from "./misc";

export function isOnline() {
  const env = getEnvironment();
  if (env === ENV_MAP.browser) {
    return getBrowserOnlineStatus();
  } else if (env === ENV_MAP.reactNative) {
    return getReactNativeOnlineStatus();
  } else if (env === ENV_MAP.node) {
    return getNodeOnlineStatus();
  }
  return true;
}

export function getBrowserOnlineStatus() {
  return isBrowser() && navigator?.onLine;
}

export function getReactNativeOnlineStatus() {
  // global.isOnline is set in react-native-compat
  // fallback to true if global is undefined, meaning an older version of react-native-compat is used
  return isReactNative() && typeof global !== "undefined" ? (global as any)?.isOnline : true;
}

export function getNodeOnlineStatus() {
  // wip: may be send quick request to check?
  return true;
}
