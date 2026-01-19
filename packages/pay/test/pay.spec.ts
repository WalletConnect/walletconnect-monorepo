/**
 * WalletConnect Pay SDK Tests
 *
 * Tests the WalletConnectPay with a mock provider simulating yttrium/pay responses
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  MockProvider,
  createMockPaymentOptionsResponse,
  createMockPaymentOptionsWithInfo,
  createMockPaymentOptionsWithCollectData,
  createMockActions,
  createMockConfirmResponse,
} from "./mocks/index.js";
import type {
  GetPaymentOptionsParams,
  GetRequiredPaymentActionsParams,
  ConfirmPaymentParams,
  PaymentOptionsResponse,
} from "../src/types/index.js";
import { PayError } from "../src/types/index.js";

describe("WalletConnectPay with MockProvider", () => {
  let mockProvider: MockProvider;

  beforeEach(() => {
    mockProvider = new MockProvider();
  });

  // ==================== getPaymentOptions Tests ====================

  describe("getPaymentOptions", () => {
    it("should return payment options for a valid payment link", async () => {
      const mockResponse = createMockPaymentOptionsResponse({
        paymentId: "pay_test_123",
      });
      mockProvider.setPaymentOptionsResponse("pay_test_123", mockResponse);

      const params: GetPaymentOptionsParams = {
        paymentLink: "https://pay.walletconnect.com/pay_test_123",
        accounts: ["eip155:8453:0x1234567890123456789012345678901234567890"],
      };

      const result = await mockProvider.getPaymentOptions(params);

      expect(result.paymentId).toBe("pay_test_123");
      expect(result.options).toHaveLength(1);
      expect(result.options[0].id).toBe("opt_1");
      expect(result.options[0].amount.unit).toContain("eip155:8453");
      expect(result.options[0].amount.display.assetSymbol).toBe("USDC");
    });

    it("should return payment options with payment info when requested", async () => {
      const mockResponse = createMockPaymentOptionsWithInfo({
        paymentId: "pay_with_info",
      });
      mockProvider.setPaymentOptionsResponse("pay_with_info", mockResponse);

      const params: GetPaymentOptionsParams = {
        paymentLink: "pay_with_info",
        accounts: ["eip155:8453:0xabc"],
        includePaymentInfo: true,
      };

      const result = await mockProvider.getPaymentOptions(params);

      expect(result.info).toBeDefined();
      expect(result.info?.status).toBe("requires_action");
      expect(result.info?.merchant.name).toBe("Test Merchant");
      expect(result.info?.amount.display.assetSymbol).toBe("USDC");
    });

    it("should return payment options with collect data fields", async () => {
      const mockResponse = createMockPaymentOptionsWithCollectData();
      mockProvider.setPaymentOptionsResponse("pay_123", mockResponse);

      const params: GetPaymentOptionsParams = {
        paymentLink: "pay_123",
        accounts: ["eip155:8453:0xabc"],
      };

      const result = await mockProvider.getPaymentOptions(params);

      expect(result.collectData).toBeDefined();
      expect(result.collectData?.fields).toHaveLength(3);
      expect(result.collectData?.fields[0].id).toBe("firstName");
      expect(result.collectData?.fields[0].required).toBe(true);
      expect(result.collectData?.fields[0].fieldType).toBe("text");
      expect(result.collectData?.fields[2].fieldType).toBe("date");
    });

    it("should throw error for non-existent payment", async () => {
      const params: GetPaymentOptionsParams = {
        paymentLink: "pay_not_found",
        accounts: ["eip155:1:0x123"],
      };

      await expect(mockProvider.getPaymentOptions(params)).rejects.toThrow(PayError);
    });

    it("should throw custom error when configured", async () => {
      const customError = new PayError("PAYMENT_OPTIONS", "Payment expired");
      mockProvider.setPaymentOptionsResponse("pay_expired", customError);

      const params: GetPaymentOptionsParams = {
        paymentLink: "pay_expired",
        accounts: ["eip155:1:0x123"],
      };

      await expect(mockProvider.getPaymentOptions(params)).rejects.toThrow("Payment expired");
    });

    it("should extract payment ID from various link formats", async () => {
      const mockResponse = createMockPaymentOptionsResponse({ paymentId: "pay_456" });

      // Test with full URL
      mockProvider.setPaymentOptionsResponse("pay_456", mockResponse);

      const params1: GetPaymentOptionsParams = {
        paymentLink: "https://pay.walletconnect.com/pay_456",
        accounts: ["eip155:1:0x123"],
      };
      const result1 = await mockProvider.getPaymentOptions(params1);
      expect(result1.paymentId).toBe("pay_456");

      // Test with just ID
      const params2: GetPaymentOptionsParams = {
        paymentLink: "pay_456",
        accounts: ["eip155:1:0x123"],
      };
      const result2 = await mockProvider.getPaymentOptions(params2);
      expect(result2.paymentId).toBe("pay_456");
    });

    it("should track getPaymentOptions calls", async () => {
      const mockResponse = createMockPaymentOptionsResponse();
      mockProvider.setPaymentOptionsResponse("pay_123", mockResponse);

      const params: GetPaymentOptionsParams = {
        paymentLink: "pay_123",
        accounts: ["eip155:8453:0xabc", "eip155:1:0xdef"],
        includePaymentInfo: true,
      };

      await mockProvider.getPaymentOptions(params);

      expect(mockProvider.calls.getPaymentOptions).toHaveLength(1);
      expect(mockProvider.calls.getPaymentOptions[0]).toEqual(params);
    });

    it("should return multiple payment options", async () => {
      const mockResponse: PaymentOptionsResponse = {
        paymentId: "pay_multi",
        options: [
          {
            id: "opt_usdc_base",
            amount: {
              unit: "caip19/eip155:8453/erc20:0xUSDC",
              value: "1000000",
              display: {
                assetSymbol: "USDC",
                assetName: "USD Coin",
                decimals: 6,
                networkName: "Base",
              },
            },
            etaS: 5,
            actions: [],
          },
          {
            id: "opt_usdc_ethereum",
            amount: {
              unit: "caip19/eip155:1/erc20:0xUSDC",
              value: "1000000",
              display: {
                assetSymbol: "USDC",
                assetName: "USD Coin",
                decimals: 6,
                networkName: "Ethereum",
              },
            },
            etaS: 30,
            actions: [],
          },
          {
            id: "opt_dai",
            amount: {
              unit: "caip19/eip155:1/erc20:0xDAI",
              value: "1000000000000000000",
              display: {
                assetSymbol: "DAI",
                assetName: "Dai Stablecoin",
                decimals: 18,
                networkName: "Ethereum",
              },
            },
            etaS: 30,
            actions: [],
          },
        ],
      };
      mockProvider.setPaymentOptionsResponse("pay_multi", mockResponse);

      const params: GetPaymentOptionsParams = {
        paymentLink: "pay_multi",
        accounts: ["eip155:8453:0xabc", "eip155:1:0xabc"],
      };

      const result = await mockProvider.getPaymentOptions(params);

      expect(result.options).toHaveLength(3);
      expect(result.options[0].amount.display.networkName).toBe("Base");
      expect(result.options[1].amount.display.networkName).toBe("Ethereum");
      expect(result.options[2].amount.display.assetSymbol).toBe("DAI");
    });
  });

  // ==================== getRequiredPaymentActions Tests ====================

  describe("getRequiredPaymentActions", () => {
    it("should return actions for a valid option", async () => {
      const mockActions = createMockActions(1);
      mockProvider.setActionsResponse("pay_123", "opt_1", mockActions);

      const params: GetRequiredPaymentActionsParams = {
        paymentId: "pay_123",
        optionId: "opt_1",
      };

      const result = await mockProvider.getRequiredPaymentActions(params);

      expect(result).toHaveLength(1);
      expect(result[0].walletRpc.chainId).toBe("eip155:8453");
      expect(result[0].walletRpc.method).toBe("eth_signTypedData_v4");
      expect(result[0].walletRpc.params).toContain("TransferWithAuthorization");
    });

    it("should return multiple actions when required", async () => {
      const mockActions = createMockActions(3);
      mockProvider.setActionsResponse("pay_multi_action", "opt_swap", mockActions);

      const params: GetRequiredPaymentActionsParams = {
        paymentId: "pay_multi_action",
        optionId: "opt_swap",
      };

      const result = await mockProvider.getRequiredPaymentActions(params);

      expect(result).toHaveLength(3);
      result.forEach((action, i) => {
        expect(action.walletRpc.chainId).toBe("eip155:8453");
        expect(action.walletRpc.method).toBe("eth_signTypedData_v4");
        // Each action should have a unique nonce
        const params = JSON.parse(action.walletRpc.params);
        expect(params[1].message.nonce).toContain(i.toString(16));
      });
    });

    it("should throw error for non-existent option", async () => {
      const params: GetRequiredPaymentActionsParams = {
        paymentId: "pay_123",
        optionId: "opt_not_found",
      };

      await expect(mockProvider.getRequiredPaymentActions(params)).rejects.toThrow(PayError);
    });

    it("should track getRequiredPaymentActions calls", async () => {
      const mockActions = createMockActions(1);
      mockProvider.setActionsResponse("pay_track", "opt_track", mockActions);

      const params: GetRequiredPaymentActionsParams = {
        paymentId: "pay_track",
        optionId: "opt_track",
      };

      await mockProvider.getRequiredPaymentActions(params);

      expect(mockProvider.calls.getRequiredPaymentActions).toHaveLength(1);
      expect(mockProvider.calls.getRequiredPaymentActions[0]).toEqual(params);
    });

    it("should parse action params as valid JSON", async () => {
      const mockActions = createMockActions(1);
      mockProvider.setActionsResponse("pay_json", "opt_1", mockActions);

      const params: GetRequiredPaymentActionsParams = {
        paymentId: "pay_json",
        optionId: "opt_1",
      };

      const result = await mockProvider.getRequiredPaymentActions(params);
      const parsedParams = JSON.parse(result[0].walletRpc.params);

      expect(parsedParams).toBeInstanceOf(Array);
      expect(parsedParams[0]).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(parsedParams[1]).toHaveProperty("domain");
      expect(parsedParams[1]).toHaveProperty("types");
      expect(parsedParams[1]).toHaveProperty("primaryType");
      expect(parsedParams[1]).toHaveProperty("message");
    });
  });

  // ==================== confirmPayment Tests ====================

  describe("confirmPayment", () => {
    it("should confirm payment successfully", async () => {
      const mockResponse = createMockConfirmResponse("succeeded", true);
      mockProvider.setConfirmResponse("pay_123", "opt_1", mockResponse);

      const params: ConfirmPaymentParams = {
        paymentId: "pay_123",
        optionId: "opt_1",
        signatures: ["0xsig1"],
      };

      const result = await mockProvider.confirmPayment(params);

      expect(result.status).toBe("succeeded");
      expect(result.isFinal).toBe(true);
      expect(result.pollInMs).toBeUndefined();
    });

    it("should return processing status with poll time", async () => {
      const mockResponse = createMockConfirmResponse("processing", false);
      mockProvider.setConfirmResponse("pay_processing", "opt_1", mockResponse);

      const params: ConfirmPaymentParams = {
        paymentId: "pay_processing",
        optionId: "opt_1",
        signatures: ["0xsig1"],
      };

      const result = await mockProvider.confirmPayment(params);

      expect(result.status).toBe("processing");
      expect(result.isFinal).toBe(false);
      expect(result.pollInMs).toBe(1000);
    });

    it("should handle failed payment", async () => {
      const mockResponse = createMockConfirmResponse("failed", true);
      mockProvider.setConfirmResponse("pay_fail", "opt_1", mockResponse);

      const params: ConfirmPaymentParams = {
        paymentId: "pay_fail",
        optionId: "opt_1",
        signatures: ["0xsig1"],
      };

      const result = await mockProvider.confirmPayment(params);

      expect(result.status).toBe("failed");
      expect(result.isFinal).toBe(true);
    });

    it("should handle expired payment", async () => {
      const mockResponse = createMockConfirmResponse("expired", true);
      mockProvider.setConfirmResponse("pay_expired", "opt_1", mockResponse);

      const params: ConfirmPaymentParams = {
        paymentId: "pay_expired",
        optionId: "opt_1",
        signatures: ["0xsig1"],
      };

      const result = await mockProvider.confirmPayment(params);

      expect(result.status).toBe("expired");
      expect(result.isFinal).toBe(true);
    });

    it("should pass multiple signatures", async () => {
      const mockResponse = createMockConfirmResponse("succeeded", true);
      mockProvider.setConfirmResponse("pay_multi_sig", "opt_swap", mockResponse);

      const params: ConfirmPaymentParams = {
        paymentId: "pay_multi_sig",
        optionId: "opt_swap",
        signatures: ["0xsig1", "0xsig2", "0xsig3"],
      };

      await mockProvider.confirmPayment(params);

      expect(mockProvider.calls.confirmPayment[0].signatures).toHaveLength(3);
    });

    it("should pass collected data", async () => {
      const mockResponse = createMockConfirmResponse("succeeded", true);
      mockProvider.setConfirmResponse("pay_kyc", "opt_1", mockResponse);

      const params: ConfirmPaymentParams = {
        paymentId: "pay_kyc",
        optionId: "opt_1",
        signatures: ["0xsig1"],
        collectedData: [
          { id: "firstName", value: "John" },
          { id: "lastName", value: "Doe" },
          { id: "dob", value: "1990-01-15" },
        ],
      };

      await mockProvider.confirmPayment(params);

      expect(mockProvider.calls.confirmPayment[0].collectedData).toHaveLength(3);
      expect(mockProvider.calls.confirmPayment[0].collectedData?.[0]).toEqual({
        id: "firstName",
        value: "John",
      });
    });

    it("should throw error for non-existent payment", async () => {
      const params: ConfirmPaymentParams = {
        paymentId: "pay_not_found",
        optionId: "opt_1",
        signatures: ["0xsig1"],
      };

      await expect(mockProvider.confirmPayment(params)).rejects.toThrow(PayError);
    });

    it("should track confirmPayment calls", async () => {
      const mockResponse = createMockConfirmResponse("succeeded", true);
      mockProvider.setConfirmResponse("pay_track", "opt_track", mockResponse);

      const params: ConfirmPaymentParams = {
        paymentId: "pay_track",
        optionId: "opt_track",
        signatures: ["0xsig1", "0xsig2"],
        collectedData: [{ id: "name", value: "Test" }],
      };

      await mockProvider.confirmPayment(params);

      expect(mockProvider.calls.confirmPayment).toHaveLength(1);
      expect(mockProvider.calls.confirmPayment[0]).toEqual(params);
    });
  });

  // ==================== Call Tracking Tests ====================

  describe("call tracking", () => {
    it("should reset all call tracking", async () => {
      // Setup mock responses
      const mockOptions = createMockPaymentOptionsResponse();
      const mockActions = createMockActions(1);
      const mockConfirm = createMockConfirmResponse("succeeded", true);

      mockProvider.setPaymentOptionsResponse("pay_123", mockOptions);
      mockProvider.setActionsResponse("pay_123", "opt_1", mockActions);
      mockProvider.setConfirmResponse("pay_123", "opt_1", mockConfirm);

      // Make some calls
      await mockProvider.getPaymentOptions({ paymentLink: "pay_123", accounts: ["eip155:1:0x1"] });
      await mockProvider.getRequiredPaymentActions({ paymentId: "pay_123", optionId: "opt_1" });
      await mockProvider.confirmPayment({
        paymentId: "pay_123",
        optionId: "opt_1",
        signatures: ["0x1"],
      });

      expect(mockProvider.calls.getPaymentOptions).toHaveLength(1);
      expect(mockProvider.calls.getRequiredPaymentActions).toHaveLength(1);
      expect(mockProvider.calls.confirmPayment).toHaveLength(1);

      // Reset
      mockProvider.resetCalls();

      expect(mockProvider.calls.getPaymentOptions).toHaveLength(0);
      expect(mockProvider.calls.getRequiredPaymentActions).toHaveLength(0);
      expect(mockProvider.calls.confirmPayment).toHaveLength(0);
    });
  });

  // ==================== Full Flow Tests ====================

  describe("full payment flow", () => {
    it("should complete a full payment flow", async () => {
      // Setup mock responses for full flow
      const mockOptions = createMockPaymentOptionsResponse({
        paymentId: "pay_flow_123",
      });
      const mockActions = createMockActions(1);
      const mockConfirm = createMockConfirmResponse("succeeded", true);

      mockProvider.setPaymentOptionsResponse("pay_flow_123", mockOptions);
      mockProvider.setActionsResponse("pay_flow_123", "opt_1", mockActions);
      mockProvider.setConfirmResponse("pay_flow_123", "opt_1", mockConfirm);

      // Step 1: Get payment options
      const options = await mockProvider.getPaymentOptions({
        paymentLink: "https://pay.walletconnect.com/pay_flow_123",
        accounts: ["eip155:8453:0xUserAddress"],
        includePaymentInfo: true,
      });

      expect(options.paymentId).toBe("pay_flow_123");
      expect(options.options).toHaveLength(1);

      // Step 2: Get required actions
      const actions = await mockProvider.getRequiredPaymentActions({
        paymentId: options.paymentId,
        optionId: options.options[0].id,
      });

      expect(actions).toHaveLength(1);
      expect(actions[0].walletRpc.method).toBe("eth_signTypedData_v4");

      // Step 3: Confirm payment (with mock signature)
      const result = await mockProvider.confirmPayment({
        paymentId: options.paymentId,
        optionId: options.options[0].id,
        signatures: ["0xMockSignature123"],
      });

      expect(result.status).toBe("succeeded");
      expect(result.isFinal).toBe(true);

      // Verify all calls were made
      expect(mockProvider.calls.getPaymentOptions).toHaveLength(1);
      expect(mockProvider.calls.getRequiredPaymentActions).toHaveLength(1);
      expect(mockProvider.calls.confirmPayment).toHaveLength(1);
    });

    it("should complete flow with multiple actions and collected data", async () => {
      // Setup mock responses
      const mockOptions = createMockPaymentOptionsWithCollectData();
      mockOptions.paymentId = "pay_complex";
      const mockActions = createMockActions(2); // Cross-chain swap requires 2 signatures
      const mockConfirm = createMockConfirmResponse("succeeded", true);

      mockProvider.setPaymentOptionsResponse("pay_complex", mockOptions);
      mockProvider.setActionsResponse("pay_complex", "opt_1", mockActions);
      mockProvider.setConfirmResponse("pay_complex", "opt_1", mockConfirm);

      // Step 1: Get options
      const options = await mockProvider.getPaymentOptions({
        paymentLink: "pay_complex",
        accounts: ["eip155:8453:0xUser", "eip155:1:0xUser"],
      });

      expect(options.collectData?.fields).toHaveLength(3);

      // Step 2: Get actions
      const actions = await mockProvider.getRequiredPaymentActions({
        paymentId: options.paymentId,
        optionId: options.options[0].id,
      });

      expect(actions).toHaveLength(2);

      // Step 3: Confirm with signatures and collected data
      const result = await mockProvider.confirmPayment({
        paymentId: options.paymentId,
        optionId: options.options[0].id,
        signatures: ["0xSig1", "0xSig2"],
        collectedData: [
          { id: "firstName", value: "John" },
          { id: "lastName", value: "Doe" },
        ],
      });

      expect(result.status).toBe("succeeded");
    });
  });
});
