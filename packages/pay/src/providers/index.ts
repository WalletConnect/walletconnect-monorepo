/**
 * Provider exports for WalletConnect Pay SDK
 */

import type { PayProvider, PayProviderConfig, PayProviderType } from "../types/index.js";
import { createNativeProvider, isNativeProviderAvailable } from "./native.js";

export * from "./native.js";

/**
 * Detect the best available provider type for the current environment
 */
export function detectProviderType(): PayProviderType | null {
  // Check for native module (React Native)
  if (isNativeProviderAvailable()) {
    return "native";
  }

  // Future: Check for WASM support
  // if (isWasmProviderAvailable()) {
  //   return "wasm";
  // }

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
      "No Pay provider available. Make sure you are running in React Native with the native module installed, or in a browser with WASM support.",
    );
  }

  switch (providerType) {
    case "native":
      return createNativeProvider(config);
    case "wasm":
      // Future: return createWasmProvider(config);
      throw new Error("WASM provider not yet implemented");
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
