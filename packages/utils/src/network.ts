import { getDocument } from "@walletconnect/window-getters";
import { getEnvironment, ENV_MAP, isBrowser, isReactNative } from "./misc.js";

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
  /**
   * TODO: need to implement
   */
  return true;
}

export function subscribeToNetworkChange(
  callbackHandler: (connected: boolean) => void,
): () => void {
  const env = getEnvironment();
  switch (env) {
    case ENV_MAP.browser:
      return subscribeToBrowserNetworkChange(callbackHandler);
    case ENV_MAP.reactNative:
      return subscribeToReactNativeNetworkChange(callbackHandler);
    default:
      return () => undefined;
  }
}

export function subscribeToBrowserNetworkChange(
  callbackHandler: (connected: boolean) => void,
): () => void {
  if (!isReactNative() && isBrowser()) {
    const online = () => callbackHandler(true);
    const offline = () => callbackHandler(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }
  return () => undefined;
}

// global.NetInfo is set in react-native-compat
export function subscribeToReactNativeNetworkChange(
  callbackHandler: (connected: boolean) => void,
): () => void {
  if (isReactNative() && typeof global !== "undefined" && (global as any)?.NetInfo) {
    return (global as any).NetInfo.addEventListener((state: any) =>
      callbackHandler(state?.isConnected),
    );
  }
  return () => undefined;
}

export function isAppVisible(): boolean {
  if (isBrowser() && getDocument()) {
    return getDocument()?.visibilityState === "visible";
  }
  // TODO: implement reliable visibility check for react-native
  // node.js does not have a visibilityState
  return true;
}
