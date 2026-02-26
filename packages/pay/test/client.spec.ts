/**
 * WalletConnectPay Tests
 *
 * Tests the WalletConnectPay class with an injected mock provider
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  MockProvider,
  createMockPaymentOptionsResponse,
  createMockPaymentOptionsWithInfo,
  createMockActions,
  createMockConfirmResponse,
} from "./mocks/index.js";
import {
  PayError,
  PaymentOptionsError,
  PaymentActionsError,
  ConfirmPaymentError,
} from "../src/types/index.js";

/**
 * Create a WalletConnectPay-like wrapper that uses a mock provider
 * This simulates how WalletConnectPay would work with the provider
 */
class TestableWalletConnectPay {
  private readonly provider: MockProvider;

  constructor(provider: MockProvider) {
    this.provider = provider;
  }

  async getPaymentOptions(params: {
    paymentLink: string;
    accounts: string[];
    includePaymentInfo?: boolean;
  }) {
    try {
      return await this.provider.getPaymentOptions({
        ...params,
        includePaymentInfo: params.includePaymentInfo ?? false,
      });
    } catch (error) {
      if (error instanceof PayError) throw error;
      throw new PaymentOptionsError(String(error));
    }
  }

  async getRequiredPaymentActions(params: { paymentId: string; optionId: string }) {
    try {
      return await this.provider.getRequiredPaymentActions(params);
    } catch (error) {
      if (error instanceof PayError) throw error;
      throw new PaymentActionsError(String(error));
    }
  }

  async confirmPayment(params: {
    paymentId: string;
    optionId: string;
    signatures: string[];
    collectedData?: { id: string; value: string }[];
  }) {
    try {
      return await this.provider.confirmPayment(params);
    } catch (error) {
      if (error instanceof PayError) throw error;
      throw new ConfirmPaymentError(String(error));
    }
  }
}

describe("WalletConnectPay", () => {
  let mockProvider: MockProvider;
  let client: TestableWalletConnectPay;

  beforeEach(() => {
    mockProvider = new MockProvider();
    client = new TestableWalletConnectPay(mockProvider);
  });

  describe("getPaymentOptions", () => {
    it("should call provider and return options", async () => {
      const mockResponse = createMockPaymentOptionsResponse({ paymentId: "pay_client_1" });
      mockProvider.setPaymentOptionsResponse("pay_client_1", mockResponse);

      const result = await client.getPaymentOptions({
        paymentLink: "https://pay.walletconnect.com/pay_client_1",
        accounts: ["eip155:8453:0xabc"],
      });

      expect(result.paymentId).toBe("pay_client_1");
      expect(result.options).toHaveLength(1);
    });

    it("should include payment info when requested", async () => {
      const mockResponse = createMockPaymentOptionsWithInfo({ paymentId: "pay_info" });
      mockProvider.setPaymentOptionsResponse("pay_info", mockResponse);

      const result = await client.getPaymentOptions({
        paymentLink: "pay_info",
        accounts: ["eip155:1:0xabc"],
        includePaymentInfo: true,
      });

      expect(result.info).toBeDefined();
      expect(result.info?.status).toBe("requires_action");
    });

    it("should throw PaymentOptionsError on failure", async () => {
      await expect(
        client.getPaymentOptions({
          paymentLink: "pay_not_found",
          accounts: ["eip155:1:0xabc"],
        }),
      ).rejects.toThrow(PayError);
    });
  });

  describe("getRequiredPaymentActions", () => {
    it("should call provider and return actions", async () => {
      const mockActions = createMockActions(2);
      mockProvider.setActionsResponse("pay_actions", "opt_1", mockActions);

      const result = await client.getRequiredPaymentActions({
        paymentId: "pay_actions",
        optionId: "opt_1",
      });

      expect(result).toHaveLength(2);
      expect(result[0].walletRpc.method).toBe("eth_signTypedData_v4");
    });

    it("should throw PaymentActionsError on failure", async () => {
      await expect(
        client.getRequiredPaymentActions({
          paymentId: "pay_not_found",
          optionId: "opt_1",
        }),
      ).rejects.toThrow(PayError);
    });
  });

  describe("confirmPayment", () => {
    it("should call provider and return confirmation", async () => {
      const mockConfirm = createMockConfirmResponse("succeeded", true);
      mockProvider.setConfirmResponse("pay_confirm", "opt_1", mockConfirm);

      const result = await client.confirmPayment({
        paymentId: "pay_confirm",
        optionId: "opt_1",
        signatures: ["0xsig1"],
      });

      expect(result.status).toBe("succeeded");
      expect(result.isFinal).toBe(true);
    });

    it("should pass all parameters to provider", async () => {
      const mockConfirm = createMockConfirmResponse("succeeded", true);
      mockProvider.setConfirmResponse("pay_full", "opt_full", mockConfirm);

      await client.confirmPayment({
        paymentId: "pay_full",
        optionId: "opt_full",
        signatures: ["0xsig1", "0xsig2"],
        collectedData: [{ id: "name", value: "Test" }],
      });

      const call = mockProvider.calls.confirmPayment[0];
      expect(call.signatures).toHaveLength(2);
      expect(call.collectedData).toHaveLength(1);
    });

    it("should throw ConfirmPaymentError on failure", async () => {
      await expect(
        client.confirmPayment({
          paymentId: "pay_not_found",
          optionId: "opt_1",
          signatures: ["0xsig"],
        }),
      ).rejects.toThrow(PayError);
    });
  });

  describe("end-to-end flow", () => {
    it("should complete full payment flow", async () => {
      // Setup
      const paymentId = "pay_e2e";
      const optionId = "opt_1";

      mockProvider.setPaymentOptionsResponse(
        paymentId,
        createMockPaymentOptionsResponse({ paymentId }),
      );
      mockProvider.setActionsResponse(paymentId, optionId, createMockActions(1));
      mockProvider.setConfirmResponse(
        paymentId,
        optionId,
        createMockConfirmResponse("succeeded", true),
      );

      // Flow
      const options = await client.getPaymentOptions({
        paymentLink: `https://pay.walletconnect.com/${paymentId}`,
        accounts: ["eip155:8453:0xUser"],
      });

      const actions = await client.getRequiredPaymentActions({
        paymentId: options.paymentId,
        optionId: options.options[0].id,
      });

      // Simulate signing
      const signatures = actions.map(() => "0xMockSignature");

      const result = await client.confirmPayment({
        paymentId: options.paymentId,
        optionId: options.options[0].id,
        signatures,
      });

      expect(result.status).toBe("succeeded");

      // Verify all provider methods were called
      expect(mockProvider.calls.getPaymentOptions).toHaveLength(1);
      expect(mockProvider.calls.getRequiredPaymentActions).toHaveLength(1);
      expect(mockProvider.calls.confirmPayment).toHaveLength(1);
    });
  });
});

describe("PayError", () => {
  it("should create error with code and message", () => {
    const error = new PayError("PAYMENT_OPTIONS", "Something went wrong");

    expect(error.code).toBe("PAYMENT_OPTIONS");
    expect(error.message).toBe("Something went wrong");
    expect(error.originalMessage).toBe("Something went wrong");
    expect(error.name).toBe("PayError");
  });

  it("should preserve original message", () => {
    const error = new PayError("CONFIRM_PAYMENT", "Wrapped error", "Original error text");

    expect(error.message).toBe("Wrapped error");
    expect(error.originalMessage).toBe("Original error text");
  });

  it("should create from native error", () => {
    const nativeError = new Error("JSON parse error: invalid syntax");
    const error = PayError.fromNativeError(nativeError);

    expect(error.code).toBe("JSON_PARSE");
    expect(error.message).toContain("JSON parse error");
  });

  it("should handle unknown errors", () => {
    const error = PayError.fromNativeError("some string error");

    expect(error.code).toBe("UNKNOWN");
    expect(error.message).toBe("some string error");
  });

  it("should return same error if already PayError", () => {
    const original = new PayError("PAYMENT_REQUEST", "Already pay error");
    const result = PayError.fromNativeError(original);

    expect(result).toBe(original);
  });
});

describe("Specific Error Classes", () => {
  it("PaymentOptionsError should have correct code", () => {
    const error = new PaymentOptionsError("Failed to fetch");

    expect(error.code).toBe("PAYMENT_OPTIONS");
    expect(error.name).toBe("PaymentOptionsError");
    expect(error.message).toContain("Failed to get payment options");
  });

  it("PaymentActionsError should have correct code", () => {
    const error = new PaymentActionsError("Option not found");

    expect(error.code).toBe("PAYMENT_REQUEST");
    expect(error.name).toBe("PaymentActionsError");
    expect(error.message).toContain("Failed to get payment actions");
  });

  it("ConfirmPaymentError should have correct code", () => {
    const error = new ConfirmPaymentError("Invalid signature");

    expect(error.code).toBe("CONFIRM_PAYMENT");
    expect(error.name).toBe("ConfirmPaymentError");
    expect(error.message).toContain("Failed to confirm payment");
  });
});
