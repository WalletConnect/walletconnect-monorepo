import { WalletConnectHost } from "../types/index.js";

/**
 * Returns the bridge when a host launched the app and asked for a session offer, otherwise `undefined`.
 * Synchronous and SSR-safe.
 */
export function getWalletConnectHost(): Required<WalletConnectHost> | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window.walletConnectHost;
  if (host?.autoConnect !== true || typeof host.postMessage !== "function") return undefined;
  return host as Required<WalletConnectHost>;
}

export function isHostLaunch(): boolean {
  return getWalletConnectHost() !== undefined;
}
