/**
 * Unified Pay Provider
 *
 * Single provider implementation that delegates to the appropriate backend (native or WASM).
 */

import type {
  PaymentOptionsResponse,
  ConfirmPaymentResponse,
  Action,
  PayProvider,
  GetPaymentOptionsParams,
  GetRequiredPaymentActionsParams,
  ConfirmPaymentParams,
} from "../types/index.js";
import {
  buildPaymentOptionsRequest,
  buildRequiredActionsRequest,
  buildConfirmPaymentRequest,
  parsePaymentOptionsResponse,
  parseRequiredActionsResponse,
  parseConfirmPaymentResponse,
  wrapProviderError,
} from "./utils.js";

/**
 * Backend interface - low-level JSON string transport layer
 */
export interface PayBackend {
  getPaymentOptions(requestJson: string): Promise<string>;
  getRequiredPaymentActions(requestJson: string): Promise<string>;
  confirmPayment(requestJson: string): Promise<string>;
}

/**
 * Unified provider that wraps a backend implementation
 */
export class UnifiedProvider implements PayProvider {
  private readonly backend: PayBackend;

  constructor(backend: PayBackend) {
    this.backend = backend;
  }

  async getPaymentOptions(params: GetPaymentOptionsParams): Promise<PaymentOptionsResponse> {
    try {
      const responseJson = await this.backend.getPaymentOptions(buildPaymentOptionsRequest(params));
      return parsePaymentOptionsResponse(responseJson);
    } catch (error) {
      throw wrapProviderError(error);
    }
  }

  async getRequiredPaymentActions(params: GetRequiredPaymentActionsParams): Promise<Action[]> {
    try {
      const responseJson = await this.backend.getRequiredPaymentActions(
        buildRequiredActionsRequest(params),
      );
      return parseRequiredActionsResponse(responseJson);
    } catch (error) {
      throw wrapProviderError(error);
    }
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResponse> {
    try {
      const responseJson = await this.backend.confirmPayment(buildConfirmPaymentRequest(params));
      return parseConfirmPaymentResponse(responseJson);
    } catch (error) {
      throw wrapProviderError(error);
    }
  }
}
