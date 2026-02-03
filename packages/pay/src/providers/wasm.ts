/**
 * WASM Backend for WalletConnect Pay SDK
 *
 * Uses the WebAssembly module for payment operations in browser environments.
 */

import type { PayProvider, PayProviderConfig } from "../types/index.js";
import { PayError } from "../types/index.js";
import { YTTRIUM_PAY } from "./wasm/wasm-data.js";
import { PayJson, initSync } from "./wasm/yttrium.js";
import { UnifiedProvider, type PayBackend } from "./provider.js";
// eslint-disable-next-line import/no-extraneous-dependencies
import decompress from "brotli/decompress";

// Cached state
let wasmInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Reset WASM state (for testing only)
 */
export function resetWasmState(): void {
  wasmInitialized = false;
  initPromise = null;
}

/**
 * Decode base64 string to Uint8Array
 */
function base64Decode(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  throw new PayError(
    "INITIALIZATION_ERROR",
    "No base64 decoder available (requires atob or Buffer)",
  );
}

/**
 * Decompress brotli data
 */
async function decompressBrotli(compressed: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      const decompressed = decompress(Buffer.from(compressed));
      resolve(new Uint8Array(decompressed));
    } catch (error) {
      reject(
        new PayError(
          "INITIALIZATION_ERROR",
          `Brotli decompression failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  });
}

/**
 * Initialize the WASM module
 */
async function initializeWasm(): Promise<void> {
  if (wasmInitialized) {
    return;
  }

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    const compressedWasm = base64Decode(YTTRIUM_PAY);
    const wasmBytes = await decompressBrotli(compressedWasm);
    // eslint-disable-next-line no-undef
    initSync({ module: wasmBytes as BufferSource });
    wasmInitialized = true;
  })();

  await initPromise;
}

/**
 * Check if WASM provider is available
 */
export function isWasmProviderAvailable(): boolean {
  return typeof WebAssembly !== "undefined";
}

/**
 * WASM backend wrapper that handles lazy initialization
 */
class WasmBackend implements PayBackend {
  private payJson: PayJson | null = null;
  private readonly config: PayProviderConfig;
  private initPromise: Promise<void> | null = null;

  constructor(config: PayProviderConfig) {
    this.config = config;
  }

  private async ensureInitialized(): Promise<PayJson> {
    if (this.payJson) {
      return this.payJson;
    }

    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }

    await this.initPromise;
    return this.payJson!;
  }

  private async initialize(): Promise<void> {
    try {
      await initializeWasm();

      const configJson = JSON.stringify({
        baseUrl: this.config.baseUrl,
        projectId: this.config.projectId,
        apiKey: this.config.apiKey,
        appId: this.config.appId,
        clientId: this.config.clientId,
        sdkName: this.config.sdkName,
        sdkVersion: this.config.sdkVersion,
        sdkPlatform: this.config.sdkPlatform,
        bundleId: this.config.bundleId,
      });

      this.payJson = new PayJson(configJson);
    } catch (error) {
      throw new PayError(
        "INITIALIZATION_ERROR",
        `Failed to initialize WASM Pay module: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getPaymentOptions(requestJson: string): Promise<string> {
    const payJson = await this.ensureInitialized();
    return payJson.get_payment_options(requestJson);
  }

  async getRequiredPaymentActions(requestJson: string): Promise<string> {
    const payJson = await this.ensureInitialized();
    return payJson.get_required_payment_actions(requestJson);
  }

  async confirmPayment(requestJson: string): Promise<string> {
    const payJson = await this.ensureInitialized();
    return payJson.confirm_payment(requestJson);
  }
}

/**
 * Create a WASM provider instance
 */
export function createWasmProvider(config: PayProviderConfig): PayProvider {
  const backend = new WasmBackend(config);
  return new UnifiedProvider(backend);
}

// Export for testing
export { WasmBackend };
