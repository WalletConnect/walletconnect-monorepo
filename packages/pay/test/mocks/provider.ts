/**
 * Mock Provider for WalletConnect Pay SDK tests
 *
 * Simulates the uniffi native module responses from yttrium/pay
 */

import type {
  PayProvider,
  PaymentOptionsResponse,
  ConfirmPaymentResponse,
  Action,
  GetPaymentOptionsParams,
  GetRequiredPaymentActionsParams,
  ConfirmPaymentParams,
  PaymentStatus,
} from "../../src/types/index.js";
import { PayError } from "../../src/types/index.js";

/**
 * Mock response configuration
 */
export interface MockProviderConfig {
  /** Simulated responses for getPaymentOptions */
  paymentOptionsResponses?: Map<string, PaymentOptionsResponse | Error>;
  /** Simulated responses for getRequiredPaymentActions */
  actionsResponses?: Map<string, Action[] | Error>;
  /** Simulated responses for confirmPayment */
  confirmResponses?: Map<string, ConfirmPaymentResponse | Error>;
  /** Default delay in ms to simulate network latency */
  latencyMs?: number;
}

/**
 * Create a payment ID key for the mock maps
 */
function paymentKey(paymentLink: string): string {
  // Extract payment ID from link (similar to yttrium extract_payment_id)
  if (paymentLink.includes("?")) {
    const query = paymentLink.split("?")[1];
    const pidParam = query.split("&").find((p) => p.startsWith("pid="));
    if (pidParam) return pidParam.replace("pid=", "");
  }
  const parts = paymentLink.split("/");
  return parts[parts.length - 1] || paymentLink;
}

/**
 * Create a composite key for actions lookup
 */
function actionsKey(paymentId: string, optionId: string): string {
  return `${paymentId}:${optionId}`;
}

/**
 * Mock Provider implementation for testing
 */
export class MockProvider implements PayProvider {
  private paymentOptionsResponses: Map<string, PaymentOptionsResponse | Error>;
  private actionsResponses: Map<string, Action[] | Error>;
  private confirmResponses: Map<string, ConfirmPaymentResponse | Error>;
  private latencyMs: number;

  // Track calls for assertions
  public calls: {
    getPaymentOptions: GetPaymentOptionsParams[];
    getRequiredPaymentActions: GetRequiredPaymentActionsParams[];
    confirmPayment: ConfirmPaymentParams[];
  } = {
    getPaymentOptions: [],
    getRequiredPaymentActions: [],
    confirmPayment: [],
  };

  constructor(config: MockProviderConfig = {}) {
    this.paymentOptionsResponses = config.paymentOptionsResponses ?? new Map();
    this.actionsResponses = config.actionsResponses ?? new Map();
    this.confirmResponses = config.confirmResponses ?? new Map();
    this.latencyMs = config.latencyMs ?? 0;
  }

  /**
   * Set a mock response for getPaymentOptions
   */
  setPaymentOptionsResponse(paymentLink: string, response: PaymentOptionsResponse | Error): void {
    this.paymentOptionsResponses.set(paymentKey(paymentLink), response);
  }

  /**
   * Set a mock response for getRequiredPaymentActions
   */
  setActionsResponse(paymentId: string, optionId: string, response: Action[] | Error): void {
    this.actionsResponses.set(actionsKey(paymentId, optionId), response);
  }

  /**
   * Set a mock response for confirmPayment
   */
  setConfirmResponse(
    paymentId: string,
    optionId: string,
    response: ConfirmPaymentResponse | Error,
  ): void {
    this.confirmResponses.set(actionsKey(paymentId, optionId), response);
  }

  /**
   * Reset all call tracking
   */
  resetCalls(): void {
    this.calls = {
      getPaymentOptions: [],
      getRequiredPaymentActions: [],
      confirmPayment: [],
    };
  }

  private async simulateLatency(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
  }

  async getPaymentOptions(params: GetPaymentOptionsParams): Promise<PaymentOptionsResponse> {
    this.calls.getPaymentOptions.push(params);
    await this.simulateLatency();

    const key = paymentKey(params.paymentLink);
    const response = this.paymentOptionsResponses.get(key);

    if (!response) {
      throw new PayError("PAYMENT_OPTIONS", `Payment not found: ${key}`);
    }

    if (response instanceof Error) {
      throw response;
    }

    return response;
  }

  async getRequiredPaymentActions(params: GetRequiredPaymentActionsParams): Promise<Action[]> {
    this.calls.getRequiredPaymentActions.push(params);
    await this.simulateLatency();

    const key = actionsKey(params.paymentId, params.optionId);
    const response = this.actionsResponses.get(key);

    if (!response) {
      throw new PayError("PAYMENT_REQUEST", `Actions not found for: ${key}`);
    }

    if (response instanceof Error) {
      throw response;
    }

    return response;
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResponse> {
    this.calls.confirmPayment.push(params);
    await this.simulateLatency();

    const key = actionsKey(params.paymentId, params.optionId);
    const response = this.confirmResponses.get(key);

    if (!response) {
      throw new PayError("CONFIRM_PAYMENT", `Confirm response not found for: ${key}`);
    }

    if (response instanceof Error) {
      throw response;
    }

    return response;
  }
}

// ==================== Mock Data Factories ====================

/**
 * Create a mock payment options response (matching yttrium format)
 */
export function createMockPaymentOptionsResponse(
  overrides: Partial<PaymentOptionsResponse> = {},
): PaymentOptionsResponse {
  return {
    paymentId: "pay_123",
    options: [
      {
        id: "opt_1",
        account: "eip155:8453:0x1234567890123456789012345678901234567890",
        amount: {
          unit: "caip19/eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          value: "1000000",
          display: {
            assetSymbol: "USDC",
            assetName: "USD Coin",
            decimals: 6,
            iconUrl: "https://example.com/usdc.png",
            networkIconUrl: "https://example.com/base.png",
            networkName: "Base",
          },
        },
        etaS: 5,
        actions: [],
      },
    ],
    ...overrides,
  };
}

/**
 * Create a mock payment options response with payment info
 */
export function createMockPaymentOptionsWithInfo(
  overrides: Partial<PaymentOptionsResponse> = {},
): PaymentOptionsResponse {
  return {
    ...createMockPaymentOptionsResponse(),
    info: {
      status: "requires_action" as PaymentStatus,
      amount: {
        unit: "caip19/eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        value: "1000000",
        display: {
          assetSymbol: "USDC",
          assetName: "USD Coin",
          decimals: 6,
          iconUrl: "https://example.com/usdc.png",
          networkIconUrl: "https://example.com/base.png",
          networkName: "Base",
        },
      },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      merchant: {
        name: "Test Merchant",
        iconUrl: "https://example.com/merchant.png",
      },
    },
    ...overrides,
  };
}

/**
 * Create mock actions (matching yttrium WalletRpcAction format)
 */
export function createMockActions(count = 1): Action[] {
  return Array.from({ length: count }, (_, i) => ({
    walletRpc: {
      chainId: "eip155:8453",
      method: "eth_signTypedData_v4",
      params: JSON.stringify([
        "0x1234567890123456789012345678901234567890",
        {
          domain: {
            name: "USD Coin",
            version: "2",
            chainId: "0x2105",
            verifyingContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          },
          types: {
            EIP712Domain: [
              { type: "string", name: "name" },
              { type: "string", name: "version" },
              { type: "uint256", name: "chainId" },
              { type: "address", name: "verifyingContract" },
            ],
            TransferWithAuthorization: [
              { type: "address", name: "from" },
              { type: "address", name: "to" },
              { type: "uint256", name: "value" },
              { type: "uint256", name: "validAfter" },
              { type: "uint256", name: "validBefore" },
              { type: "bytes32", name: "nonce" },
            ],
          },
          primaryType: "TransferWithAuthorization",
          message: {
            from: "0x1234567890123456789012345678901234567890",
            to: "0x0987654321098765432109876543210987654321",
            value: "1000000",
            validAfter: "0x0",
            validBefore: "0xffffffff",
            nonce: `0x${i.toString(16).padStart(64, "0")}`,
          },
        },
      ]),
    },
  }));
}

/**
 * Create a mock confirm payment response
 */
export function createMockConfirmResponse(
  status: PaymentStatus = "succeeded",
  isFinal = true,
): ConfirmPaymentResponse {
  return {
    status,
    isFinal,
    pollInMs: isFinal ? undefined : 1000,
  };
}

/**
 * Create a mock response with collect data fields
 */
export function createMockPaymentOptionsWithCollectData(): PaymentOptionsResponse {
  return {
    ...createMockPaymentOptionsResponse(),
    collectData: {
      fields: [
        {
          id: "firstName",
          name: "First Name",
          required: true,
          fieldType: "text",
        },
        {
          id: "lastName",
          name: "Last Name",
          required: true,
          fieldType: "text",
        },
        {
          id: "dob",
          name: "Date of Birth",
          required: false,
          fieldType: "date",
        },
      ],
    },
  };
}

/**
 * Create a mock response with per-option collect data fields
 */
export function createMockPaymentOptionsWithOptionCollectData(): PaymentOptionsResponse {
  return {
    paymentId: "pay_option_collect",
    options: [
      {
        id: "opt_with_collect",
        account: "eip155:8453:0x1234567890123456789012345678901234567890",
        amount: {
          unit: "caip19/eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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
        collectData: {
          fields: [
            {
              id: "email",
              name: "Email Address",
              required: true,
              fieldType: "text",
            },
            {
              id: "termsAccepted",
              name: "Accept Terms",
              required: true,
              fieldType: "checkbox",
            },
          ],
          url: "https://example.com/collect",
        },
      },
      {
        id: "opt_without_collect",
        account: "eip155:1:0x1234567890123456789012345678901234567890",
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
    ],
  };
}
