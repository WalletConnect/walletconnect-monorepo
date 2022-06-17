/**
 * Types
 */
type SdkErrorKey = keyof typeof SDK_ERRORS;
type InternalErrorKey = keyof typeof INTERNAL_ERRORS;

/**
 * Constants
 */
const SDK_ERRORS = {
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
  USER_REJECED: {
    message: "User rejected.",
    code: 5000,
  },
  USER_REJECED_CHAINS: {
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
  USER_DISCONNECTED: {
    message: "User disconnected.",
    code: 6000,
  },
  SESSION_SETTLEMENT_FAILED: {
    message: "Session settlement failed.",
    code: 7000,
  },
};

const INTERNAL_ERRORS = {
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
