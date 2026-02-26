/**
 * Provider interface for WalletConnect Pay SDK
 *
 * This abstraction allows different implementations:
 * - NativeProvider: React Native uniffi module
 * - WasmProvider: WebAssembly module (future)
 */

import type {
  PaymentOptionsResponse,
  ConfirmPaymentResponse,
  Action,
  GetPaymentOptionsParams,
  GetRequiredPaymentActionsParams,
  ConfirmPaymentParams,
} from "./api.js";

/**
 * Provider initialization options
 */
export interface PayProviderConfig {
  /** Base URL for the Pay API */
  baseUrl: string;
  /** WalletConnect Project ID */
  projectId?: string;
  /** API key for authentication (either apiKey or appId required) */
  apiKey?: string;
  /** App ID for authentication (either apiKey or appId required) */
  appId?: string;
  /** Client ID for tracking */
  clientId?: string;
  /** SDK name for tracking */
  sdkName: string;
  /** SDK version for tracking */
  sdkVersion: string;
  /** SDK platform (e.g., "react-native", "web") */
  sdkPlatform: string;
  /** Application bundle ID */
  bundleId: string;
}

/**
 * Provider interface that abstracts the underlying implementation
 * (native module, WASM, etc.)
 */
export interface PayProvider {
  /**
   * Get payment options for a payment link
   * @param params - Payment options parameters
   */
  getPaymentOptions(params: GetPaymentOptionsParams): Promise<PaymentOptionsResponse>;

  /**
   * Get required payment actions for a selected option
   * @param params - Required actions parameters
   */
  getRequiredPaymentActions(params: GetRequiredPaymentActionsParams): Promise<Action[]>;

  /**
   * Confirm a payment with signatures
   * @param params - Confirm payment parameters
   */
  confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResponse>;
}

/**
 * Provider type identifier
 */
export type PayProviderType = "native" | "wasm";

/**
 * Provider factory function type
 */
export type PayProviderFactory = (config: PayProviderConfig) => PayProvider;
