/**
 * HTTP Provider Tests
 *
 * Tests the HttpProvider with mocked fetch responses
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  HttpProvider,
  createHttpProvider,
  isHttpProviderAvailable,
} from "../src/providers/http.js";
import type { PayProviderConfig } from "../src/types/index.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/**
 * Create a mock Response object
 */
function createMockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    type: "basic",
    url: "",
    clone: () => createMockResponse(body, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

/**
 * Default provider config for tests
 */
const testConfig: PayProviderConfig = {
  baseUrl: "https://api.pay.walletconnect.com",
  projectId: "test-project-id",
  apiKey: "test-api-key",
  sdkName: "test-sdk",
  sdkVersion: "1.0.0",
  sdkPlatform: "test",
  bundleId: "com.test.app",
};

/**
 * Create mock API responses matching the Pay API format
 */
const mockApiResponses = {
  paymentOptions: (paymentId: string, includeInfo = false) => ({
    options: [
      {
        id: "opt_1",
        amount: {
          unit: "caip19/eip155:8453/erc20:0xUSDC",
          value: "1000000",
          display: {
            assetSymbol: "USDC",
            assetName: "USD Coin",
            decimals: 6,
            iconUrl: "https://example.com/usdc.png",
            networkName: "Base",
          },
        },
        etaS: 5,
        actions: [
          {
            type: "walletRpc",
            data: {
              chain_id: "eip155:8453",
              method: "eth_signTypedData_v4",
              params: ["0xabc123", { domain: {}, types: {}, message: {} }],
            },
          },
        ],
      },
    ],
    ...(includeInfo
      ? {
          info: {
            status: "requires_action",
            amount: {
              unit: "caip19/eip155:8453/erc20:0xUSDC",
              value: "1000000",
              display: {
                assetSymbol: "USDC",
                assetName: "USD Coin",
                decimals: 6,
              },
            },
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            merchant: { name: "Test Merchant" },
          },
        }
      : {}),
  }),

  paymentOptionsWithBuildAction: () => ({
    options: [
      {
        id: "opt_build",
        amount: {
          unit: "caip19/eip155:8453/erc20:0xUSDC",
          value: "1000000",
          display: {
            assetSymbol: "USDC",
            assetName: "USD Coin",
            decimals: 6,
          },
        },
        etaS: 5,
        actions: [
          {
            type: "build",
            data: { data: "build_data_123" },
          },
        ],
      },
    ],
  }),

  paymentOptionsWithCollectData: () => ({
    options: [],
    collectData: {
      fields: [
        { type: "text", id: "firstName", name: "First Name", required: true },
        { type: "date", id: "dob", name: "Date of Birth", required: false },
      ],
    },
  }),

  fetchResponse: () => ({
    actions: [
      {
        type: "walletRpc",
        data: {
          chain_id: "eip155:8453",
          method: "eth_signTypedData_v4",
          params: ["0xresolved", { resolved: true }],
        },
      },
    ],
  }),

  confirmResponse: (status = "succeeded", isFinal = true) => ({
    status,
    isFinal,
    pollInMs: isFinal ? null : 100,
  }),

  statusResponse: (status = "succeeded", isFinal = true) => ({
    status,
    isFinal,
    pollInMs: isFinal ? null : 100,
  }),

  errorResponse: (code: string, message: string) => ({
    code,
    message,
  }),
};

describe("HttpProvider", () => {
  let provider: HttpProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new HttpProvider(testConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("isHttpProviderAvailable", () => {
    it("should return true when fetch is available", () => {
      expect(isHttpProviderAvailable()).toBe(true);
    });
  });

  describe("createHttpProvider", () => {
    it("should create an HttpProvider instance", () => {
      const instance = createHttpProvider(testConfig);
      expect(instance).toBeInstanceOf(HttpProvider);
    });
  });

  describe("getPaymentOptions", () => {
    it("should fetch payment options successfully", async () => {
      const mockResponse = mockApiResponses.paymentOptions("pay_123");
      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await provider.getPaymentOptions({
        paymentLink: "https://pay.walletconnect.com/pay_123",
        accounts: ["eip155:8453:0xabc"],
      });

      expect(result.paymentId).toBe("pay_123");
      expect(result.options).toHaveLength(1);
      expect(result.options[0].id).toBe("opt_1");
      expect(result.options[0].amount.display.assetSymbol).toBe("USDC");
    });

    it("should include payment info when requested", async () => {
      const mockResponse = mockApiResponses.paymentOptions("pay_info", true);
      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await provider.getPaymentOptions({
        paymentLink: "pay_info",
        accounts: ["eip155:1:0xabc"],
        includePaymentInfo: true,
      });

      expect(result.info).toBeDefined();
      expect(result.info?.status).toBe("requires_action");
      expect(result.info?.merchant.name).toBe("Test Merchant");
    });

    it("should send correct headers", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.paymentOptions("pay_headers")),
      );

      await provider.getPaymentOptions({
        paymentLink: "pay_headers",
        accounts: ["eip155:1:0xabc"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/gateway/payment/pay_headers/options"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "Api-Key": "test-api-key",
            "Sdk-Name": "test-sdk",
            "Sdk-Version": "1.0.0",
            "Sdk-Platform": "test",
          }),
        }),
      );
    });

    it("should handle collect data fields", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.paymentOptionsWithCollectData()),
      );

      const result = await provider.getPaymentOptions({
        paymentLink: "pay_collect",
        accounts: ["eip155:1:0xabc"],
      });

      expect(result.collectData).toBeDefined();
      expect(result.collectData?.fields).toHaveLength(2);
      expect(result.collectData?.fields[0].id).toBe("firstName");
      expect(result.collectData?.fields[0].fieldType).toBe("text");
      expect(result.collectData?.fields[1].fieldType).toBe("date");
    });

    it("should throw error on API failure", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          mockApiResponses.errorResponse("payment_not_found", "Payment not found"),
          404,
        ),
      );

      await expect(
        provider.getPaymentOptions({
          paymentLink: "pay_not_found",
          accounts: ["eip155:1:0xabc"],
        }),
      ).rejects.toThrow("404");
    });

    it("should transform walletRpc actions correctly", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.paymentOptions("pay_transform")),
      );

      const result = await provider.getPaymentOptions({
        paymentLink: "pay_transform",
        accounts: ["eip155:1:0xabc"],
      });

      const action = result.options[0].actions[0];
      expect(action.walletRpc.chainId).toBe("eip155:8453");
      expect(action.walletRpc.method).toBe("eth_signTypedData_v4");
      expect(typeof action.walletRpc.params).toBe("string");
      expect(JSON.parse(action.walletRpc.params)).toBeInstanceOf(Array);
    });
  });

  describe("Payment ID extraction", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(createMockResponse(mockApiResponses.paymentOptions("test")));
    });

    it("should extract payment ID from URL path", async () => {
      await provider.getPaymentOptions({
        paymentLink: "https://pay.walletconnect.com/pay_path123",
        accounts: ["eip155:1:0xabc"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/payment/pay_path123/options"),
        expect.anything(),
      );
    });

    it("should extract payment ID from ?pid= query param", async () => {
      await provider.getPaymentOptions({
        paymentLink: "https://pay.walletconnect.com/?pid=pay_query456",
        accounts: ["eip155:1:0xabc"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/payment/pay_query456/options"),
        expect.anything(),
      );
    });

    it("should extract payment ID from plain ID string", async () => {
      await provider.getPaymentOptions({
        paymentLink: "pay_plain789",
        accounts: ["eip155:1:0xabc"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/payment/pay_plain789/options"),
        expect.anything(),
      );
    });

    it("should extract payment ID from URL-encoded link", async () => {
      await provider.getPaymentOptions({
        paymentLink: "https%3A%2F%2Fpay.walletconnect.com%2F%3Fpid%3Dpay_encoded123",
        accounts: ["eip155:1:0xabc"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/payment/pay_encoded123/options"),
        expect.anything(),
      );
    });

    it("should extract payment ID from wc: URI with pay param", async () => {
      await provider.getPaymentOptions({
        paymentLink:
          "wc:abc123@2?relay-protocol=irn&symKey=xyz&pay=https%3A%2F%2Fpay.walletconnect.com%2F%3Fpid%3Dpay_wc789",
        accounts: ["eip155:1:0xabc"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/payment/pay_wc789/options"),
        expect.anything(),
      );
    });

    it("should throw error for invalid payment link", async () => {
      await expect(
        provider.getPaymentOptions({
          paymentLink: "",
          accounts: ["eip155:1:0xabc"],
        }),
      ).rejects.toThrow("Invalid payment link");
    });
  });

  describe("getRequiredPaymentActions", () => {
    it("should return cached actions from getPaymentOptions", async () => {
      // First call getPaymentOptions to cache the actions
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.paymentOptions("pay_cached")),
      );

      await provider.getPaymentOptions({
        paymentLink: "pay_cached",
        accounts: ["eip155:1:0xabc"],
      });

      // Now getRequiredPaymentActions should use cached data
      const actions = await provider.getRequiredPaymentActions({
        paymentId: "pay_cached",
        optionId: "opt_1",
      });

      // Should only have made one fetch call (for getPaymentOptions)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(actions).toHaveLength(1);
      expect(actions[0].walletRpc.chainId).toBe("eip155:8453");
    });

    it("should fetch actions when not cached", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockApiResponses.fetchResponse()));

      const actions = await provider.getRequiredPaymentActions({
        paymentId: "pay_not_cached",
        optionId: "opt_fetch",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/payment/pay_not_cached/fetch"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("opt_fetch"),
        }),
      );
      expect(actions).toHaveLength(1);
    });

    it("should resolve build actions via fetch endpoint", async () => {
      // First, get payment options with a build action
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.paymentOptionsWithBuildAction()),
      );

      await provider.getPaymentOptions({
        paymentLink: "pay_build",
        accounts: ["eip155:1:0xabc"],
      });

      // Mock the fetch endpoint response
      mockFetch.mockResolvedValueOnce(createMockResponse(mockApiResponses.fetchResponse()));

      // Get actions - should call fetch to resolve build action
      const actions = await provider.getRequiredPaymentActions({
        paymentId: "pay_build",
        optionId: "opt_build",
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining("/fetch"),
        expect.objectContaining({
          body: expect.stringContaining("build_data_123"),
        }),
      );
      expect(actions).toHaveLength(1);
      expect(actions[0].walletRpc.params).toContain("resolved");
    });
  });

  describe("confirmPayment", () => {
    it("should confirm payment successfully", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockApiResponses.confirmResponse()));

      const result = await provider.confirmPayment({
        paymentId: "pay_confirm",
        optionId: "opt_1",
        signatures: ["0xsig1"],
      });

      expect(result.status).toBe("succeeded");
      expect(result.isFinal).toBe(true);
    });

    it("should send signatures in correct format", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockApiResponses.confirmResponse()));

      await provider.confirmPayment({
        paymentId: "pay_sigs",
        optionId: "opt_1",
        signatures: ["0xsig1", "0xsig2"],
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.results).toHaveLength(2);
      expect(requestBody.results[0]).toEqual({ type: "walletRpc", data: ["0xsig1"] });
      expect(requestBody.results[1]).toEqual({ type: "walletRpc", data: ["0xsig2"] });
    });

    it("should send collected data when provided", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockApiResponses.confirmResponse()));

      await provider.confirmPayment({
        paymentId: "pay_data",
        optionId: "opt_1",
        signatures: ["0xsig"],
        collectedData: [
          { id: "firstName", value: "John" },
          { id: "lastName", value: "Doe" },
        ],
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.collectedData).toBeDefined();
      expect(requestBody.collectedData.fields).toHaveLength(2);
      expect(requestBody.collectedData.fields[0]).toEqual({ id: "firstName", value: "John" });
    });

    it("should poll for status when not final", async () => {
      // First response: processing
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.confirmResponse("processing", false)),
      );
      // Second response (status poll): succeeded
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.statusResponse("succeeded", true)),
      );

      const result = await provider.confirmPayment({
        paymentId: "pay_poll",
        optionId: "opt_1",
        signatures: ["0xsig"],
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining("/payment/pay_poll/status"),
        expect.objectContaining({ method: "GET" }),
      );
      expect(result.status).toBe("succeeded");
      expect(result.isFinal).toBe(true);
    });

    it("should handle failed payment status", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.confirmResponse("failed", true)),
      );

      const result = await provider.confirmPayment({
        paymentId: "pay_failed",
        optionId: "opt_1",
        signatures: ["0xsig"],
      });

      expect(result.status).toBe("failed");
      expect(result.isFinal).toBe(true);
    });

    it("should handle expired payment status", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.confirmResponse("expired", true)),
      );

      const result = await provider.confirmPayment({
        paymentId: "pay_expired",
        optionId: "opt_1",
        signatures: ["0xsig"],
      });

      expect(result.status).toBe("expired");
      expect(result.isFinal).toBe(true);
    });

    it("should throw error on API failure", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          mockApiResponses.errorResponse("invalid_signature", "Invalid signature"),
          422,
        ),
      );

      await expect(
        provider.confirmPayment({
          paymentId: "pay_error",
          optionId: "opt_1",
          signatures: ["0xinvalid"],
        }),
      ).rejects.toThrow("422");
    });
  });

  describe("end-to-end flow", () => {
    it("should complete full payment flow", async () => {
      const paymentId = "pay_e2e";

      // 1. Get payment options
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.paymentOptions(paymentId, true)),
      );

      const options = await provider.getPaymentOptions({
        paymentLink: `https://pay.walletconnect.com/${paymentId}`,
        accounts: ["eip155:8453:0xUser"],
        includePaymentInfo: true,
      });

      expect(options.paymentId).toBe(paymentId);
      expect(options.info?.status).toBe("requires_action");

      // 2. Get required actions (from cache)
      const actions = await provider.getRequiredPaymentActions({
        paymentId: options.paymentId,
        optionId: options.options[0].id,
      });

      expect(actions).toHaveLength(1);

      // 3. Confirm payment
      mockFetch.mockResolvedValueOnce(createMockResponse(mockApiResponses.confirmResponse()));

      const result = await provider.confirmPayment({
        paymentId: options.paymentId,
        optionId: options.options[0].id,
        signatures: ["0xMockSignature"],
      });

      expect(result.status).toBe("succeeded");
      expect(result.isFinal).toBe(true);

      // Verify correct number of API calls
      expect(mockFetch).toHaveBeenCalledTimes(2); // options + confirm (actions from cache)
    });

    it("should complete flow with build action resolution", async () => {
      // 1. Get payment options with build action
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.paymentOptionsWithBuildAction()),
      );

      const options = await provider.getPaymentOptions({
        paymentLink: "pay_build_e2e",
        accounts: ["eip155:1:0xUser"],
      });

      // 2. Get actions (will need to fetch)
      mockFetch.mockResolvedValueOnce(createMockResponse(mockApiResponses.fetchResponse()));

      const actions = await provider.getRequiredPaymentActions({
        paymentId: "pay_build_e2e",
        optionId: options.options[0].id,
      });

      expect(actions).toHaveLength(1);
      expect(actions[0].walletRpc.params).toContain("resolved");

      // 3. Confirm payment
      mockFetch.mockResolvedValueOnce(createMockResponse(mockApiResponses.confirmResponse()));

      const result = await provider.confirmPayment({
        paymentId: "pay_build_e2e",
        optionId: options.options[0].id,
        signatures: ["0xSig"],
      });

      expect(result.status).toBe("succeeded");
      expect(mockFetch).toHaveBeenCalledTimes(3); // options + fetch + confirm
    });

    it("should complete flow with polling", async () => {
      // 1. Get payment options
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.paymentOptions("pay_poll_e2e")),
      );

      await provider.getPaymentOptions({
        paymentLink: "pay_poll_e2e",
        accounts: ["eip155:1:0xUser"],
      });

      // 2. Confirm payment - initially processing
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.confirmResponse("processing", false)),
      );

      // 3. Status poll - still processing
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.statusResponse("processing", false)),
      );

      // 4. Status poll - succeeded
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockApiResponses.statusResponse("succeeded", true)),
      );

      const result = await provider.confirmPayment({
        paymentId: "pay_poll_e2e",
        optionId: "opt_1",
        signatures: ["0xSig"],
      });

      expect(result.status).toBe("succeeded");
      expect(result.isFinal).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(4); // options + confirm + 2 status polls
    });
  });

  describe("error handling", () => {
    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        provider.getPaymentOptions({
          paymentLink: "pay_network_error",
          accounts: ["eip155:1:0xabc"],
        }),
      ).rejects.toThrow();
    });

    it("should handle malformed JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("Invalid JSON")),
      } as Response);

      await expect(
        provider.getPaymentOptions({
          paymentLink: "pay_bad_json",
          accounts: ["eip155:1:0xabc"],
        }),
      ).rejects.toThrow();
    });

    it("should include error message from API response", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { code: "rate_limited", message: "Too many requests, please try again later" },
          429,
        ),
      );

      await expect(
        provider.getPaymentOptions({
          paymentLink: "pay_rate_limit",
          accounts: ["eip155:1:0xabc"],
        }),
      ).rejects.toThrow("Too many requests");
    });
  });
});
