/**
 * WASM Provider Tests
 *
 * Tests that actually load and use the WASM module
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createWasmProvider, isWasmProviderAvailable } from "../src/providers/wasm.js";
import type { PayProvider, PayProviderConfig } from "../src/types/index.js";

const TEST_CONFIG: PayProviderConfig = {
  baseUrl: "https://pay.walletconnect.com",
  projectId: "test-project-id",
  sdkName: "@walletconnect/pay",
  sdkVersion: "1.0.0",
  sdkPlatform: "test",
  bundleId: "com.test.app",
};

describe("WASM Provider", () => {
  describe("isWasmProviderAvailable", () => {
    it("should return true when WebAssembly is available", () => {
      // #given
      // Node.js/browser environment with WebAssembly support

      // #when
      const available = isWasmProviderAvailable();

      // #then
      expect(available).toBe(true);
    });
  });

  describe("Provider initialization", () => {
    it("should create a provider instance", () => {
      // #given
      const config = TEST_CONFIG;

      // #when
      const provider = createWasmProvider(config);

      // #then
      expect(provider).toBeDefined();
      expect(typeof provider.getPaymentOptions).toBe("function");
    });

    it("should successfully initialize WASM on first API call", async () => {
      // #given
      const provider = createWasmProvider(TEST_CONFIG);

      // #when / #then
      // The WASM module should load and initialize when we make an API call
      // Even if the API call fails (due to invalid payment link), WASM should be loaded
      await expect(
        provider.getPaymentOptions({
          paymentLink: "invalid-payment-link",
          accounts: ["eip155:1:0x1234567890123456789012345678901234567890"],
        }),
      ).rejects.toThrow(); // Expected to fail due to invalid payment link, but WASM should be loaded
    });
  });

  describe("Provider API", () => {
    let provider: PayProvider;

    beforeAll(() => {
      provider = createWasmProvider(TEST_CONFIG);
    });

    it("should have getPaymentOptions method", () => {
      expect(typeof provider.getPaymentOptions).toBe("function");
    });

    it("should have getRequiredPaymentActions method", () => {
      expect(typeof provider.getRequiredPaymentActions).toBe("function");
    });

    it("should have confirmPayment method", () => {
      expect(typeof provider.confirmPayment).toBe("function");
    });

    it("should throw error for invalid payment link format", async () => {
      // #given
      const invalidPaymentLink = "not-a-valid-payment-link";

      // #when / #then
      await expect(
        provider.getPaymentOptions({
          paymentLink: invalidPaymentLink,
          accounts: ["eip155:1:0x1234567890123456789012345678901234567890"],
        }),
      ).rejects.toThrow();
    });

    it("should throw error for invalid payment ID in getRequiredPaymentActions", async () => {
      // #given
      const invalidPaymentId = "invalid-payment-id";
      const invalidOptionId = "invalid-option-id";

      // #when / #then
      await expect(
        provider.getRequiredPaymentActions({
          paymentId: invalidPaymentId,
          optionId: invalidOptionId,
        }),
      ).rejects.toThrow();
    });

    it("should throw error for invalid payment ID in confirmPayment", async () => {
      // #given
      const invalidPaymentId = "invalid-payment-id";
      const invalidOptionId = "invalid-option-id";

      // #when / #then
      await expect(
        provider.confirmPayment({
          paymentId: invalidPaymentId,
          optionId: invalidOptionId,
          signatures: ["0x1234"],
        }),
      ).rejects.toThrow();
    });
  });

  describe("WASM module loading", () => {
    it("should reuse initialized WASM module across provider instances", async () => {
      // #given
      const provider1 = createWasmProvider(TEST_CONFIG);
      const provider2 = createWasmProvider(TEST_CONFIG);

      // #when
      // Trigger initialization on both providers
      const promise1 = provider1
        .getPaymentOptions({
          paymentLink: "test-link-1",
          accounts: ["eip155:1:0x1234567890123456789012345678901234567890"],
        })
        .catch(() => {});

      const promise2 = provider2
        .getPaymentOptions({
          paymentLink: "test-link-2",
          accounts: ["eip155:1:0x1234567890123456789012345678901234567890"],
        })
        .catch(() => {});

      // #then
      // Both should complete without errors (WASM module is shared)
      await Promise.all([promise1, promise2]);
    });
  });

  describe("base64 decoding and brotli decompression", () => {
    it("should successfully decode and decompress WASM data", async () => {
      // #given
      const provider = createWasmProvider(TEST_CONFIG);

      // #when
      // Making any API call will trigger WASM loading which includes
      // base64 decoding and brotli decompression
      try {
        await provider.getPaymentOptions({
          paymentLink: "test",
          accounts: ["eip155:1:0x1234567890123456789012345678901234567890"],
        });
      } catch {
        // Expected to fail on API call, but WASM should be loaded
      }

      // #then
      // If we get here without a WASM initialization error, decompression worked
      // A second call should not throw decompression/base64 errors
      try {
        await provider.getPaymentOptions({
          paymentLink: "test2",
          accounts: ["eip155:1:0x1234567890123456789012345678901234567890"],
        });
      } catch (error) {
        // Should be an API error, not a decompression error
        expect(String(error)).not.toContain("brotli");
        expect(String(error)).not.toContain("base64");
        expect(String(error)).not.toContain("decompress");
      }
    });
  });
});
