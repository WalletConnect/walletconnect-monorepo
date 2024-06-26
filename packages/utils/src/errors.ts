/**
 * Types
 */
export type SdkErrorKey = keyof typeof SDK_ERRORS;
export type InternalErrorKey = keyof typeof INTERNAL_ERRORS;

/**
 * Constants
 */
export const SDK_ERRORS = {
  /* ----- INVALID (1xxx) ----- */
  INVALID_METHOD: {
    message: "Invalid method.",
    code: 1001,
  },
  INVALID_EVENT: {
    message: "Invalid event.",
    code: 1002,
  },
  INVALID_UPDATE_REQUEST: {
    message: "Invalid update request.",
    code: 1003,
  },
  INVALID_EXTEND_REQUEST: {
    message: "Invalid extend request.",
    code: 1004,
  },
  INVALID_SESSION_SETTLE_REQUEST: {
    message: "Invalid session settle request.",
    code: 1005,
  },
  /* ----- UNAUTHORIZED (3xxx) ----- */
  UNAUTHORIZED_METHOD: {
    message: "Unauthorized method.",
    code: 3001,
  },
  UNAUTHORIZED_EVENT: {
    message: "Unauthorized event.",
    code: 3002,
  },
  UNAUTHORIZED_UPDATE_REQUEST: {
    message: "Unauthorized update request.",
    code: 3003,
  },
  UNAUTHORIZED_EXTEND_REQUEST: {
    message: "Unauthorized extend request.",
    code: 3004,
  },
  /* ----- REJECTED (5xxx) ----- */
  USER_REJECTED: {
    message: "User rejected.",
    code: 5000,
  },
  USER_REJECTED_CHAINS: {
    message: "User rejected chains.",
    code: 5001,
  },
  USER_REJECTED_METHODS: {
    message: "User rejected methods.",
    code: 5002,
  },
  USER_REJECTED_EVENTS: {
    message: "User rejected events.",
    code: 5003,
  },
  UNSUPPORTED_CHAINS: {
    message: "Unsupported chains.",
    code: 5100,
  },
  UNSUPPORTED_METHODS: {
    message: "Unsupported methods.",
    code: 5101,
  },
  UNSUPPORTED_EVENTS: {
    message: "Unsupported events.",
    code: 5102,
  },
  UNSUPPORTED_ACCOUNTS: {
    message: "Unsupported accounts.",
    code: 5103,
  },
  UNSUPPORTED_NAMESPACE_KEY: {
    message: "Unsupported namespace key.",
    code: 5104,
  },
  /* ----- REASON (6xxx) ----- */
  USER_DISCONNECTED: {
    message: "User disconnected.",
    code: 6000,
  },
  /* ----- FAILURE (7xxx) ----- */
  SESSION_SETTLEMENT_FAILED: {
    message: "Session settlement failed.",
    code: 7000,
  },
  /* ----- PAIRING (10xxx) ----- */
  WC_METHOD_UNSUPPORTED: {
    message: "Unsupported wc_ method.",
    code: 10001,
  },
};

export const INTERNAL_ERRORS = {
  NOT_INITIALIZED: {
    message: "Not initialized.",
    code: 1,
  },
  NO_MATCHING_KEY: {
    message: "No matching key.",
    code: 2,
  },
  RESTORE_WILL_OVERRIDE: {
    message: "Restore will override.",
    code: 3,
  },
  RESUBSCRIBED: {
    message: "Resubscribed.",
    code: 4,
  },
  MISSING_OR_INVALID: {
    message: "Missing or invalid.",
    code: 5,
  },
  EXPIRED: {
    message: "Expired.",
    code: 6,
  },
  UNKNOWN_TYPE: {
    message: "Unknown type.",
    code: 7,
  },
  MISMATCHED_TOPIC: {
    message: "Mismatched topic.",
    code: 8,
  },
  NON_CONFORMING_NAMESPACES: {
    message: "Non conforming namespaces.",
    code: 9,
  },
};

/**
 * Utilities
 */
export function getInternalError(key: InternalErrorKey, context?: string | number) {
  const { message, code } = INTERNAL_ERRORS[key];
  return {
    message: context ? `${message} ${context}` : message,
    code,
  };
}

export function getSdkError(key: SdkErrorKey, context?: string | number) {
  const { message, code } = SDK_ERRORS[key];
  return {
    message: context ? `${message} ${context}` : message,
    code,
  };
}
