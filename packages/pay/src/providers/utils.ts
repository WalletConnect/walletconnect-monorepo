/**
 * Shared utilities for Pay providers
 */

import type {
  GetPaymentOptionsParams,
  GetRequiredPaymentActionsParams,
  ConfirmPaymentParams,
  PaymentOptionsResponse,
  ConfirmPaymentResponse,
  Action,
} from "../types/index.js";
import { PayError } from "../types/index.js";

/**
 * Build JSON request string for getPaymentOptions
 */
export function buildPaymentOptionsRequest(params: GetPaymentOptionsParams): string {
  return JSON.stringify({
    paymentLink: params.paymentLink,
    accounts: params.accounts,
    includePaymentInfo: params.includePaymentInfo ?? false,
  });
}

/**
 * Build JSON request string for getRequiredPaymentActions
 */
export function buildRequiredActionsRequest(params: GetRequiredPaymentActionsParams): string {
  return JSON.stringify({
    paymentId: params.paymentId,
    optionId: params.optionId,
  });
}

/**
 * Build JSON request string for confirmPayment
 */
export function buildConfirmPaymentRequest(params: ConfirmPaymentParams): string {
  return JSON.stringify({
    paymentId: params.paymentId,
    optionId: params.optionId,
    signatures: params.signatures,
    collectedData: params.collectedData,
  });
}

/**
 * Parse payment options response from JSON
 */
export function parsePaymentOptionsResponse(responseJson: string): PaymentOptionsResponse {
  const parsed = JSON.parse(responseJson);
  if (!parsed || typeof parsed !== "object") {
    throw new PayError("JSON_PARSE", "Invalid payment options response format");
  }
  return parsed as PaymentOptionsResponse;
}

/**
 * Parse required actions response from JSON
 */
export function parseRequiredActionsResponse(responseJson: string): Action[] {
  const parsed = JSON.parse(responseJson);
  if (!Array.isArray(parsed)) {
    throw new PayError("JSON_PARSE", "Invalid required actions response format: expected array");
  }
  return parsed as Action[];
}

/**
 * Parse confirm payment response from JSON
 */
export function parseConfirmPaymentResponse(responseJson: string): ConfirmPaymentResponse {
  const parsed = JSON.parse(responseJson);
  if (!parsed || typeof parsed !== "object") {
    throw new PayError("JSON_PARSE", "Invalid confirm payment response format");
  }
  return parsed as ConfirmPaymentResponse;
}

/**
 * Wrap provider errors with PayError
 */
export function wrapProviderError(error: unknown): PayError {
  return PayError.fromNativeError(error);
}
