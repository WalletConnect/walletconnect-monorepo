import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

/**
 * TurboModule spec for WalletConnect Pay native module
 *
 * This module wraps the uniffi-generated WalletConnectPayJson Rust client
 * and provides a JSON-based interface for payment operations.
 */
export interface Spec extends TurboModule {
  /**
   * Initialize the Pay client with SDK configuration
   * @param configJson JSON string containing SDK config:
   *   {
   *     "baseUrl": string,
   *     "projectId": string,
   *     "apiKey": string,
   *     "sdkName": string,
   *     "sdkVersion": string,
   *     "sdkPlatform": string,
   *     "bundleId": string
   *   }
   */
  initialize(configJson: string): void;

  /**
   * Get payment options for a payment link
   * @param requestJson JSON string:
   *   { "paymentLink": string, "accounts": string[], "includePaymentInfo"?: boolean }
   * @returns Promise resolving to JSON string of PaymentOptionsResponse
   */
  getPaymentOptions(requestJson: string): Promise<string>;

  /**
   * Get required payment actions for a selected option
   * @param requestJson JSON string:
   *   { "paymentId": string, "optionId": string }
   * @returns Promise resolving to JSON string array of Action
   */
  getRequiredPaymentActions(requestJson: string): Promise<string>;

  /**
   * Confirm a payment with signatures
   * @param requestJson JSON string:
   *   {
   *     "paymentId": string,
   *     "optionId": string,
   *     "signatures": string[],
   *     "collectedData"?: [{ "id": string, "value": string }]
   *   }
   * @returns Promise resolving to JSON string of ConfirmPaymentResponse
   */
  confirmPayment(requestJson: string): Promise<string>;
}

export default TurboModuleRegistry.get<Spec>("RNWalletConnectPay");
