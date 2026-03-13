/**
 * API types for WalletConnect Pay SDK
 * These types match the Rust uniffi JSON interface
 */

// ==================== Enums ====================

/**
 * Payment status representing the lifecycle of a payment
 */
export type PaymentStatus =
  | "requires_action"
  | "processing"
  | "succeeded"
  | "failed"
  | "expired"
  | "cancelled";

/**
 * Type of data collection field
 */
export type CollectDataFieldType = "text" | "date" | "checkbox";

// ==================== Display Types ====================

/**
 * Display information for an amount
 */
export interface AmountDisplay {
  /** Ticker/symbol of the asset */
  assetSymbol: string;
  /** Full name of the asset */
  assetName: string;
  /** Number of minor decimals of the asset */
  decimals: number;
  /** URL of the icon of the asset (if token) */
  iconUrl?: string;
  /** URL of the network icon */
  networkIconUrl?: string;
  /** Name of the network of the asset (if token) */
  networkName?: string;
}

/**
 * Amount with unit and display information
 */
export interface PayAmount {
  /** Currency unit, prefixed with either "iso4217/" or "caip19/" */
  unit: string;
  /** Amount value, in the currency unit's minor units */
  value: string;
  /** Display information for the amount */
  display: AmountDisplay;
}

// ==================== Merchant & Buyer ====================

/**
 * Merchant information
 */
export interface MerchantInfo {
  /** Merchant name */
  name: string;
  /** Merchant icon URL */
  iconUrl?: string;
}

/**
 * Buyer information
 */
export interface BuyerInfo {
  /** Account CAIP-10 */
  accountCaip10: string;
  /** Account provider name */
  accountProviderName: string;
  /** Account provider icon URL */
  accountProviderIcon?: string;
}

// ==================== Actions ====================

/**
 * Wallet RPC action to be signed
 */
export interface WalletRpcAction {
  /** Chain ID in CAIP-2 format (e.g., "eip155:8453") */
  chainId: string;
  /** RPC method name (e.g., "eth_signTypedData_v4") */
  method: string;
  /** JSON-encoded params array */
  params: string;
}

/**
 * Action container
 */
export interface Action {
  walletRpc: WalletRpcAction;
}

// ==================== Collect Data ====================

/**
 * Field for data collection
 */
export interface CollectDataField {
  /** ID of the field for submission */
  id: string;
  /** Human readable name of the field */
  name: string;
  /** Whether the field is required */
  required: boolean;
  /** Type of the field */
  fieldType: CollectDataFieldType;
}

/**
 * Data collection action
 */
export interface CollectDataAction {
  fields: CollectDataField[];
  url?: string;
  schema?: string;
}

/**
 * Result of a collected data field
 */
export interface CollectDataFieldResult {
  id: string;
  value: string;
}

// ==================== Payment ====================

/**
 * Payment information
 */
export interface PaymentInfo {
  /** Payment status */
  status: PaymentStatus;
  /** Amount to be paid */
  amount: PayAmount;
  /** Payment expiration timestamp, in seconds since epoch */
  expiresAt: number;
  /** Merchant information */
  merchant: MerchantInfo;
  /** Buyer information (present if payment has been submitted) */
  buyer?: BuyerInfo;
}

/**
 * Payment option
 */
export interface PaymentOption {
  /** ID of the option */
  id: string;
  /** CAIP-10 account for this option */
  account: string;
  /** The option's token and amount */
  amount: PayAmount;
  /** Estimated time to complete the option, in seconds */
  etaS: number;
  /** Option expiration timestamp, in seconds since epoch */
  expiresAt?: number;
  /** Actions required to complete the option */
  actions: Action[];
  /** Option-specific data collection requirements */
  collectData?: CollectDataAction;
}

// ==================== Method Parameters ====================

/**
 * Parameters for getting payment options
 */
export interface GetPaymentOptionsParams {
  /** Payment link or ID */
  paymentLink: string;
  /** List of CAIP-10 accounts */
  accounts: string[];
  /** Whether to include payment info in response */
  includePaymentInfo?: boolean;
}

/**
 * Parameters for getting required payment actions
 */
export interface GetRequiredPaymentActionsParams {
  /** Payment ID */
  paymentId: string;
  /** Option ID */
  optionId: string;
}

/**
 * Parameters for confirming a payment
 */
export interface ConfirmPaymentParams {
  /** Payment ID */
  paymentId: string;
  /** Option ID */
  optionId: string;
  /** Signatures from wallet RPC calls */
  signatures: string[];
  /** Collected data fields (if required) */
  collectedData?: CollectDataFieldResult[];
}

// ==================== Response Types ====================

/**
 * Response from get payment options
 */
export interface PaymentOptionsResponse {
  /** Payment ID extracted from the payment link */
  paymentId: string;
  /** Payment information (if includePaymentInfo was true) */
  info?: PaymentInfo;
  /** Available payment options */
  options: PaymentOption[];
  /** Data collection requirements (if any) */
  collectData?: CollectDataAction;
}

/**
 * Transaction result info returned after payment confirmation
 */
export interface PaymentResultInfo {
  txId: string;
  optionAmount: PayAmount;
}

/**
 * Response from confirm payment
 */
export interface ConfirmPaymentResponse {
  /** Payment status */
  status: PaymentStatus;
  /** True if the payment is in a final state */
  isFinal: boolean;
  /** Time to poll for payment status, in milliseconds */
  pollInMs?: number;
  /** Transaction result info, present when payment succeeds */
  info?: PaymentResultInfo;
}
