/**
 * Error types for WalletConnect Pay SDK
 */

/**
 * Error codes from the native module
 */
export type PayErrorCode =
  | "JSON_PARSE"
  | "JSON_SERIALIZE"
  | "PAYMENT_OPTIONS"
  | "PAYMENT_REQUEST"
  | "CONFIRM_PAYMENT"
  | "NATIVE_MODULE_NOT_FOUND"
  | "INITIALIZATION_ERROR"
  | "UNKNOWN";

/**
 * Base error class for Pay SDK
 */
export class PayError extends Error {
  public readonly code: PayErrorCode;
  public readonly originalMessage: string;

  constructor(code: PayErrorCode, message: string, originalMessage?: string) {
    super(message);
    this.name = "PayError";
    this.code = code;
    this.originalMessage = originalMessage ?? message;
    Object.setPrototypeOf(this, PayError.prototype);
  }

  static fromNativeError(error: unknown): PayError {
    if (error instanceof PayError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    // Try to parse error code from message
    if (message.includes("JSON parse error")) {
      return new PayError("JSON_PARSE", message);
    }
    if (message.includes("JSON serialize error")) {
      return new PayError("JSON_SERIALIZE", message);
    }
    if (message.includes("Payment options error")) {
      return new PayError("PAYMENT_OPTIONS", message);
    }
    if (message.includes("Payment request error")) {
      return new PayError("PAYMENT_REQUEST", message);
    }
    if (message.includes("Confirm payment error")) {
      return new PayError("CONFIRM_PAYMENT", message);
    }

    return new PayError("UNKNOWN", message);
  }
}

/**
 * Error thrown when native module is not available
 */
export class NativeModuleNotFoundError extends PayError {
  constructor() {
    super(
      "NATIVE_MODULE_NOT_FOUND",
      "WalletConnect Pay native module not found. Make sure @walletconnect/react-native-compat is installed and linked.",
    );
    this.name = "NativeModuleNotFoundError";
    Object.setPrototypeOf(this, NativeModuleNotFoundError.prototype);
  }
}

/**
 * Error thrown when payment options request fails
 */
export class PaymentOptionsError extends PayError {
  constructor(message: string) {
    super("PAYMENT_OPTIONS", `Failed to get payment options: ${message}`, message);
    this.name = "PaymentOptionsError";
    Object.setPrototypeOf(this, PaymentOptionsError.prototype);
  }
}

/**
 * Error thrown when payment actions request fails
 */
export class PaymentActionsError extends PayError {
  constructor(message: string) {
    super("PAYMENT_REQUEST", `Failed to get payment actions: ${message}`, message);
    this.name = "PaymentActionsError";
    Object.setPrototypeOf(this, PaymentActionsError.prototype);
  }
}

/**
 * Error thrown when payment confirmation fails
 */
export class ConfirmPaymentError extends PayError {
  constructor(message: string) {
    super("CONFIRM_PAYMENT", `Failed to confirm payment: ${message}`, message);
    this.name = "ConfirmPaymentError";
    Object.setPrototypeOf(this, ConfirmPaymentError.prototype);
  }
}
