/**
 * Provider exports for WalletConnect Pay SDK
 */

import { isReactNative } from "@walletconnect/utils";
import type { PayProvider, PayProviderConfig, PayProviderType } from "../types/index.js";
import { createNativeProvider, isNativeProviderAvailable } from "./native.js";
import { createWasmProvider, isWasmProviderAvailable } from "./wasm.js";

export * from "./native.js";
export * from "./wasm.js";

/**
 * Detect the best available provider type for the current environment
 * Priority: Native (React Native) > WASM (Browser/Node.js)
 */
export function detectProviderType(): PayProviderType | null {
  if (isNativeProviderAvailable()) {
    return "native";
  }

  if (!isReactNative() && isWasmProviderAvailable()) {
    return "wasm";
  }

  return null;
}

/**
 * Create a provider based on auto-detection
 * @param config - Provider configuration
 */
export function createProvider(config: PayProviderConfig): PayProvider {
  const providerType = detectProviderType();

  if (!providerType) {
    throw new Error(
      "No Pay provider available. Make sure you are running in React Native with the native module installed, or in a browser/Node.js environment with WebAssembly support.",
    );
  }

  switch (providerType) {
    case "native":
      return createNativeProvider(config);
    case "wasm":
      return createWasmProvider(config);
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

/**
 * Check if any provider is available
 */
export function isProviderAvailable(): boolean {
  return detectProviderType() !== null;
}
