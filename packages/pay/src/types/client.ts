/**
 * Client types for WalletConnect Pay SDK
 */

import type { Logger } from "@walletconnect/logger";

/**
 * Options for initializing the Pay client
 */
export interface WalletConnectPayOptions {
  /** WalletConnect Project ID */
  projectId: string;
  /** API key for Pay service */
  apiKey: string;
  /** Custom base URL (defaults to production) */
  baseUrl?: string;
  /** Custom logger instance */
  logger?: Logger | string;
}
