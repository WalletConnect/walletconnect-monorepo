import { WalletConnectHost } from "../types/index.js";

/**
 * Returns the wallet bridge when the app was launched by a wallet, otherwise `undefined`.
 * Synchronous and SSR-safe.
 */
export function getWalletConnectHost(): Required<WalletConnectHost> | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window.walletConnectHost;
  if (host?.autoConnect !== true || typeof host.postMessage !== "function") return undefined;
  return host as Required<WalletConnectHost>;
}

export function isWalletLaunch(): boolean {
  return getWalletConnectHost() !== undefined;
}
