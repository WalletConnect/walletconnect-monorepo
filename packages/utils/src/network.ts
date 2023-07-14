import { getEnvironment, ENV_MAP, isBrowser, isReactNative } from "./misc";

export function isOnline(): Promise<boolean> {
  const env = getEnvironment();
  return new Promise((resolve) => {
    switch (env) {
      case ENV_MAP.browser:
        resolve(getBrowserOnlineStatus());
        break;
      case ENV_MAP.reactNative:
        resolve(getReactNativeOnlineStatus());
        break;
      case ENV_MAP.node:
        resolve(getNodeOnlineStatus());
        break;
      default:
        resolve(true);
    }
  });
}

export function getBrowserOnlineStatus() {
  return isBrowser() && navigator?.onLine;
}

export async function getReactNativeOnlineStatus(): Promise<boolean> {
  // global.NetInfo is set in react-native-compat
  if (isReactNative() && typeof global !== "undefined" && (global as any)?.NetInfo) {
    const state = await (global as any)?.NetInfo.fetch();
    return state?.isConnected;
  }
  // fallback to true if global.NetInfo is undefined, meaning an older version of react-native-compat is used
  return true;
}

export function getNodeOnlineStatus() {
  // wip: may be send quick request to check?
  return true;
}

export function subscribeToNetworkChange(callBackHendler: (connected: boolean) => void) {
  const env = getEnvironment();
  switch (env) {
    case ENV_MAP.browser:
      subscribeToBrowserNetworkChange(callBackHendler);
      break;
    case ENV_MAP.reactNative:
      subscribeToReactNativeNetworkChange(callBackHendler);
      break;
    case ENV_MAP.node:
      // wip: need to implement
      break;
    default:
      break;
  }
}

export function subscribeToBrowserNetworkChange(callBackHendler: (connected: boolean) => void) {
  if (isBrowser()) {
    window.addEventListener("online", () => callBackHendler(true));
    window.addEventListener("offline", () => callBackHendler(false));
  }
}

// global.NetInfo is set in react-native-compat
export function subscribeToReactNativeNetworkChange(callBackHendler: (connected: boolean) => void) {
  if (isReactNative() && typeof global !== "undefined" && (global as any)?.NetInfo) {
    (global as any)?.NetInfo.addEventListener((state: any) => callBackHendler(state?.isConnected));
  }
}
