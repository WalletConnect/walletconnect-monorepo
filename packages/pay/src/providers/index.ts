/**
 * Provider exports for WalletConnect Pay SDK
 */

import type { PayProvider, PayProviderConfig, PayProviderType } from "../types/index.js";
import { createNativeProvider, isNativeProviderAvailable } from "./native.js";
import { createHttpProvider, isHttpProviderAvailable } from "./http.js";

export * from "./native.js";
export * from "./http.js";

/**
 * Detect the best available provider type for the current environment
 */
export function detectProviderType(): PayProviderType | null {
  // Check for native module (React Native) - preferred when available
  if (isNativeProviderAvailable()) {
    return "native";
  }

  // Check for HTTP/fetch support (browser, Node.js, etc.)
  if (isHttpProviderAvailable()) {
    return "http";
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
      "No Pay provider available. Make sure you are running in an environment with fetch support.",
    );
  }

  switch (providerType) {
    case "native":
      return createNativeProvider(config);
    case "http":
      return createHttpProvider(config);
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
