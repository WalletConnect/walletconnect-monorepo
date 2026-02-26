/**
 * Client types for WalletConnect Pay SDK
 */

import type { Logger } from "@walletconnect/logger";

/**
 * Options for initializing the Pay client
 */
export interface WalletConnectPayOptions {
  /** App ID for authentication (either apiKey or appId required) */
  appId?: string;
  /** API key for authentication (either apiKey or appId required) */
  apiKey?: string;
  /** Custom base URL (defaults to production) */
  baseUrl?: string;
  clientId?: string;
  /** Custom logger instance or level */
  logger?: Logger | "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
}
