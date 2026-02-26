import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { isReactNative } from "@walletconnect/utils";
import { detectProviderType, createProvider, isProviderAvailable } from "../src/providers/index.js";
import type { PayProviderConfig } from "../src/types/index.js";

vi.mock("@walletconnect/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@walletconnect/utils")>();
  return {
    ...actual,
    isReactNative: vi.fn(() => false),
  };
});

const mockedIsReactNative = vi.mocked(isReactNative);

const TEST_CONFIG: PayProviderConfig = {
  baseUrl: "https://pay.walletconnect.com",
  projectId: "test-project-id",
  sdkName: "@walletconnect/pay",
  sdkVersion: "1.0.0",
  sdkPlatform: "test",
  bundleId: "com.test.app",
};

describe("Provider detection", () => {
  beforeEach(() => {
    mockedIsReactNative.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when in React Native environment", () => {
    beforeEach(() => {
      mockedIsReactNative.mockReturnValue(true);
    });

    it("should not detect wasm as provider type", () => {
      // #given - React Native environment, no native module

      // #when
      const providerType = detectProviderType();

      // #then
      expect(providerType).not.toBe("wasm");
    });

    it("should report no provider available when native module is absent", () => {
      // #given - React Native environment, no native module

      // #when
      const available = isProviderAvailable();

      // #then
      expect(available).toBe(false);
    });

    it("should throw when creating provider without native module", () => {
      // #given - React Native environment, no native module

      // #when / #then
      expect(() => createProvider(TEST_CONFIG)).toThrow("No Pay provider available");
    });
  });

  describe("when in browser/Node.js environment", () => {
    beforeEach(() => {
      mockedIsReactNative.mockReturnValue(false);
    });

    it("should detect wasm as provider type", () => {
      // #given - non-RN environment with WebAssembly

      // #when
      const providerType = detectProviderType();

      // #then
      expect(providerType).toBe("wasm");
    });

    it("should report provider available", () => {
      // #given - non-RN environment

      // #when
      const available = isProviderAvailable();

      // #then
      expect(available).toBe(true);
    });

    it("should create wasm provider successfully", () => {
      // #given - non-RN environment

      // #when
      const provider = createProvider(TEST_CONFIG);

      // #then
      expect(provider).toBeDefined();
      expect(typeof provider.getPaymentOptions).toBe("function");
    });
  });
});
