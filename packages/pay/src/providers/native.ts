/**
 * Native Provider for WalletConnect Pay SDK
 *
 * Uses the React Native uniffi module for payment operations.
 */

import type {
  PaymentOptionsResponse,
  ConfirmPaymentResponse,
  Action,
  PayProvider,
  PayProviderConfig,
  GetPaymentOptionsParams,
  GetRequiredPaymentActionsParams,
  ConfirmPaymentParams,
} from "../types/index.js";
import { NativeModuleNotFoundError, PayError } from "../types/index.js";

/**
 * Native module interface expected from React Native
 */
interface NativePayModule {
  getPaymentOptions(requestJson: string): Promise<string>;
  getRequiredPaymentActions(requestJson: string): Promise<string>;
  confirmPayment(requestJson: string): Promise<string>;
  initialize?(configJson: string): void;
}

// Cached native module reference
let cachedNativeModule: NativePayModule | null | undefined;

// Manually injected module reference
let injectedModule: NativePayModule | null = null;

/**
 * Try to get the native module from React Native
 */
function getNativeModule(): NativePayModule | null {
  // Return injected module if available
  if (injectedModule) {
    return injectedModule;
  }

  // Return cached result if already attempted
  if (cachedNativeModule !== undefined) {
    return cachedNativeModule;
  }

  try {
    // Access React Native's NativeModules via globalThis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reactNative = (globalThis as any).ReactNative;
    if (reactNative?.NativeModules?.RNWalletConnectPay) {
      cachedNativeModule = reactNative.NativeModules.RNWalletConnectPay as NativePayModule;
      return cachedNativeModule;
    }

    // Fallback: Try accessing via expo modules pattern
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expoModules = (globalThis as any).expo?.modules;
    if (expoModules?.RNWalletConnectPay) {
      cachedNativeModule = expoModules.RNWalletConnectPay as NativePayModule;
      return cachedNativeModule;
    }

    cachedNativeModule = null;
    return null;
  } catch {
    cachedNativeModule = null;
    return null;
  }
}

/**
 * Set a custom native module instance
 * Use this to manually inject the native module if auto-discovery doesn't work
 */
export function setNativeModule(module: NativePayModule): void {
  injectedModule = module;
  cachedNativeModule = module;
}

/**
 * Check if native provider is available
 */
export function isNativeProviderAvailable(): boolean {
  return getNativeModule() !== null;
}

/**
 * Reset the native module (for testing)
 */
export function resetNativeModule(): void {
  injectedModule = null;
  cachedNativeModule = undefined;
}

/**
 * Native provider implementation using React Native uniffi module
 */
export class NativeProvider implements PayProvider {
  private readonly module: NativePayModule;

  constructor(config: PayProviderConfig) {
    const module = getNativeModule();

    if (!module) {
      throw new NativeModuleNotFoundError();
    }

    // Initialize the module with config
    if (module.initialize) {
      try {
        const configJson = JSON.stringify(config);
        module.initialize(configJson);
      } catch (error) {
        throw new PayError(
          "INITIALIZATION_ERROR",
          `Failed to initialize native Pay module: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.module = module;
  }

  async getPaymentOptions(params: GetPaymentOptionsParams): Promise<PaymentOptionsResponse> {
    const request = {
      paymentLink: params.paymentLink,
      accounts: params.accounts,
      includePaymentInfo: params.includePaymentInfo ?? false,
    };

    try {
      const responseJson = await this.module.getPaymentOptions(JSON.stringify(request));
      return JSON.parse(responseJson) as PaymentOptionsResponse;
    } catch (error) {
      throw PayError.fromNativeError(error);
    }
  }

  async getRequiredPaymentActions(params: GetRequiredPaymentActionsParams): Promise<Action[]> {
    const request = {
      paymentId: params.paymentId,
      optionId: params.optionId,
    };

    try {
      const responseJson = await this.module.getRequiredPaymentActions(JSON.stringify(request));
      return JSON.parse(responseJson) as Action[];
    } catch (error) {
      throw PayError.fromNativeError(error);
    }
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResponse> {
    const request = {
      paymentId: params.paymentId,
      optionId: params.optionId,
      signatures: params.signatures,
      collectedData: params.collectedData,
    };

    try {
      const responseJson = await this.module.confirmPayment(JSON.stringify(request));
      return JSON.parse(responseJson) as ConfirmPaymentResponse;
    } catch (error) {
      throw PayError.fromNativeError(error);
    }
  }
}

/**
 * Create a native provider instance
 */
export function createNativeProvider(config: PayProviderConfig): PayProvider {
  return new NativeProvider(config);
}
