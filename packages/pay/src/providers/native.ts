/**
 * Native Backend for WalletConnect Pay SDK
 *
 * Uses the React Native uniffi module for payment operations.
 */

import type { PayProvider, PayProviderConfig } from "../types/index.js";
import { NativeModuleNotFoundError, PayError } from "../types/index.js";
import { UnifiedProvider, type PayBackend } from "./provider.js";

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
  if (injectedModule) {
    return injectedModule;
  }

  if (cachedNativeModule !== undefined) {
    return cachedNativeModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reactNative = (globalThis as any).ReactNative;
    if (reactNative?.NativeModules?.RNWalletConnectPay) {
      cachedNativeModule = reactNative.NativeModules.RNWalletConnectPay as NativePayModule;
      return cachedNativeModule;
    }

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
 * Create native backend that wraps the React Native module
 */
function createNativeBackend(config: PayProviderConfig): PayBackend {
  const module = getNativeModule();

  if (!module) {
    throw new NativeModuleNotFoundError();
  }

  if (module.initialize) {
    try {
      module.initialize(JSON.stringify(config));
    } catch (error) {
      throw new PayError(
        "INITIALIZATION_ERROR",
        `Failed to initialize native Pay module: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    getPaymentOptions: (requestJson: string) => module.getPaymentOptions(requestJson),
    getRequiredPaymentActions: (requestJson: string) =>
      module.getRequiredPaymentActions(requestJson),
    confirmPayment: (requestJson: string) => module.confirmPayment(requestJson),
  };
}

/**
 * Create a native provider instance
 */
export function createNativeProvider(config: PayProviderConfig): PayProvider {
  const backend = createNativeBackend(config);
  return new UnifiedProvider(backend);
}
