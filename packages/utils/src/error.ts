import { ErrorResponse } from "@walletconnect/jsonrpc-utils";

import { capitalize, enumify, fromMiliseconds } from "./misc";

export const ERROR_TYPE = enumify({
  // 0 (Generic)
  GENERIC: "GENERIC",
  // 1000 (Internal)
  MISSING_OR_INVALID: "MISSING_OR_INVALID",
  MISSING_RESPONSE: "MISSING_RESPONSE",
  MISSING_DECRYPT_PARAMS: "MISSING_DECRYPT_PARAMS",
  INVALID_UPDATE_REQUEST: "INVALID_UPDATE_REQUEST",
  INVALID_UPGRADE_REQUEST: "INVALID_UPGRADE_REQUEST",
  INVALID_STORAGE_KEY_NAME: "INVALID_STORAGE_KEY_NAME",
  RECORD_ALREADY_EXISTS: "RECORD_ALREADY_EXISTS",
  RESTORE_WILL_OVERRIDE: "RESTORE_WILL_OVERRIDE",
  NO_MATCHING_ID: "NO_MATCHING_ID",
  NO_MATCHING_TOPIC: "NO_MATCHING_TOPIC",
  NO_MATCHING_RESPONSE: "NO_MATCHING_RESPONSE",
  NO_MATCHING_KEY: "NO_MATCHING_KEY",
  UNKNOWN_JSONRPC_METHOD: "UNKNOWN_JSONRPC_METHOD",
  MISMATCHED_TOPIC: "MISMATCHED_TOPIC",
  MISMATCHED_ACCOUNTS: "MISMATCHED_ACCOUNTS",
  SETTLED: "SETTLED",
  NOT_APPROVED: "NOT_APPROVED",
  PROPOSAL_RESPONDED: "PROPOSAL_RESPONDED",
  RESPONSE_ACKNOWLEDGED: "RESPONSE_ACKNOWLEDGED",
  EXPIRED: "EXPIRED",
  DELETED: "DELETED",
  RESUBSCRIBED: "RESUBSCRIBED",
  // 2000 (Timeout)
  SETTLE_TIMEOUT: "SETTLE_TIMEOUT",
  JSONRPC_REQUEST_TIMEOUT: "JSONRPC_REQUEST_TIMEOUT",
  // 3000 (Unauthorized)
  UNAUTHORIZED_TARGET_CHAIN: "UNAUTHORIZED_TARGET_CHAIN",
  UNAUTHORIZED_JSON_RPC_METHOD: "UNAUTHORIZED_JSON_RPC_METHOD",
  UNAUTHORIZED_NOTIFICATION_TYPE: "UNAUTHORIZED_NOTIFICATION_TYPE",
  UNAUTHORIZED_UPDATE_REQUEST: "UNAUTHORIZED_UPDATE_REQUEST",
  UNAUTHORIZED_UPGRADE_REQUEST: "UNAUTHORIZED_UPGRADE_REQUEST",
  UNAUTHORIZED_MATCHING_CONTROLLER: "UNAUTHORIZED_MATCHING_CONTROLLER",
  // 4000 (EIP-1193)
  JSONRPC_REQUEST_METHOD_REJECTED: "JSONRPC_REQUEST_METHOD_REJECTED",
  JSONRPC_REQUEST_METHOD_UNAUTHORIZED: "JSONRPC_REQUEST_METHOD_UNAUTHORIZED",
  JSONRPC_REQUEST_METHOD_UNSUPPORTED: "JSONRPC_REQUEST_METHOD_UNSUPPORTED",
  DISCONNECTED_ALL_CHAINS: "DISCONNECTED_ALL_CHAINS",
  DISCONNECTED_TARGET_CHAIN: "DISCONNECTED_TARGET_CHAIN",
  // 5000 (CAIP-25)
  DISAPPROVED_CHAINS: "DISAPPROVED_CHAINS",
  DISAPPROVED_JSONRPC: "DISAPPROVED_JSONRPC",
  DISAPPROVED_NOTIFICATION: "DISAPPROVED_NOTIFICATION",
  UNSUPPORTED_CHAINS: "UNSUPPORTED_CHAINS",
  UNSUPPORTED_JSONRPC: "UNSUPPORTED_JSONRPC",
  UNSUPPORTED_NOTIFICATION: "UNSUPPORTED_NOTIFICATION",
  UNSUPPORTED_SIGNAL: "UNSUPPORTED_SIGNAL",
  USER_DISCONNECTED: "USER_DISCONNECTED",
  // 9000 (Unknown)
  UNKNOWN: "UNKNOWN",
});

export type ErrorType = keyof typeof ERROR_TYPE;

export type ErroStringifier = (params?: any) => string;

export type ErrorFormatter = (params?: any) => ErrorResponse;

export type Error = {
  type: ErrorType;
  code: number;
  stringify: ErroStringifier;
  format: ErrorFormatter;
};

const defaultParams = {
  topic: "undefined",
  message: "Something went wrong",
  name: "parameter",
  context: "session",
  blockchain: "Ethereum",
};

export const ERROR: Record<ErrorType, Error> = {
  // 0 (Generic)
  [ERROR_TYPE.GENERIC]: {
    type: ERROR_TYPE.GENERIC,
    code: 0,
    stringify: (params?: any) => params?.message || defaultParams.message,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.GENERIC].code,
      message: ERROR[ERROR_TYPE.GENERIC].stringify(params),
    }),
  },
  // 1000 (Internal)
  [ERROR_TYPE.MISSING_OR_INVALID]: {
    type: ERROR_TYPE.MISSING_OR_INVALID,
    code: 1000,
    stringify: (params?: any) => `Missing or invalid ${params?.name || defaultParams.name}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.MISSING_OR_INVALID].code,
      message: ERROR[ERROR_TYPE.MISSING_OR_INVALID].stringify(params),
    }),
  },
  [ERROR_TYPE.MISSING_RESPONSE]: {
    type: ERROR_TYPE.MISSING_RESPONSE,
    code: 1001,
    stringify: (params?: any) =>
      `Response is required for approved ${params?.context || defaultParams.context} proposals`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.MISSING_RESPONSE].code,
      message: ERROR[ERROR_TYPE.MISSING_RESPONSE].stringify(params),
    }),
  },
  [ERROR_TYPE.MISSING_DECRYPT_PARAMS]: {
    type: ERROR_TYPE.MISSING_DECRYPT_PARAMS,
    code: 1002,
    stringify: (params?: any) =>
      `Decrypt params required for ${params?.context || defaultParams.context}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.MISSING_DECRYPT_PARAMS].code,
      message: ERROR[ERROR_TYPE.MISSING_DECRYPT_PARAMS].stringify(params),
    }),
  },
  [ERROR_TYPE.INVALID_UPDATE_REQUEST]: {
    type: ERROR_TYPE.INVALID_UPDATE_REQUEST,
    code: 1003,
    stringify: (params?: any) =>
      `Invalid ${params?.context || defaultParams.context} update request`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.INVALID_UPDATE_REQUEST].code,
      message: ERROR[ERROR_TYPE.INVALID_UPDATE_REQUEST].stringify(params),
    }),
  },
  [ERROR_TYPE.INVALID_UPGRADE_REQUEST]: {
    type: ERROR_TYPE.INVALID_UPGRADE_REQUEST,
    code: 1004,
    stringify: (params?: any) =>
      `Invalid ${params?.context || defaultParams.context} upgrade request`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.INVALID_UPGRADE_REQUEST].code,
      message: ERROR[ERROR_TYPE.INVALID_UPGRADE_REQUEST].stringify(params),
    }),
  },
  [ERROR_TYPE.INVALID_STORAGE_KEY_NAME]: {
    type: ERROR_TYPE.INVALID_STORAGE_KEY_NAME,
    code: 1005,
    stringify: (params?: any) => `Invalid storage key name: ${params?.name || defaultParams.name}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.INVALID_STORAGE_KEY_NAME].code,
      message: ERROR[ERROR_TYPE.INVALID_STORAGE_KEY_NAME].stringify(params),
    }),
  },
  [ERROR_TYPE.RECORD_ALREADY_EXISTS]: {
    type: ERROR_TYPE.RECORD_ALREADY_EXISTS,
    code: 1100,
    stringify: (params?: any) =>
      `Record already exists for ${params?.context || defaultParams.context} matching id: ${
        params?.id
      }`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.RECORD_ALREADY_EXISTS].code,
      message: ERROR[ERROR_TYPE.RECORD_ALREADY_EXISTS].stringify(params),
    }),
  },
  [ERROR_TYPE.RESTORE_WILL_OVERRIDE]: {
    type: ERROR_TYPE.RESTORE_WILL_OVERRIDE,
    code: 1200,
    stringify: (params?: any) =>
      `Restore will override already set ${params?.context || defaultParams.context}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.RESTORE_WILL_OVERRIDE].code,
      message: ERROR[ERROR_TYPE.RESTORE_WILL_OVERRIDE].stringify(params),
    }),
  },
  [ERROR_TYPE.NO_MATCHING_ID]: {
    type: ERROR_TYPE.NO_MATCHING_ID,
    code: 1300,
    stringify: (params?: any) =>
      `No matching ${params?.context || defaultParams.context} with id: ${params?.id}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.NO_MATCHING_ID].code,
      message: ERROR[ERROR_TYPE.NO_MATCHING_ID].stringify(params),
    }),
  },
  [ERROR_TYPE.NO_MATCHING_TOPIC]: {
    type: ERROR_TYPE.NO_MATCHING_TOPIC,
    code: 1301,
    stringify: (params?: any) =>
      `No matching ${params?.context || defaultParams.context} with topic: ${params?.topic}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.NO_MATCHING_TOPIC].code,
      message: ERROR[ERROR_TYPE.NO_MATCHING_TOPIC].stringify(params),
    }),
  },
  [ERROR_TYPE.NO_MATCHING_RESPONSE]: {
    type: ERROR_TYPE.NO_MATCHING_RESPONSE,
    code: 1302,
    stringify: (params?: any) =>
      `No response found in pending ${params?.context || defaultParams.context} proposal`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.NO_MATCHING_RESPONSE].code,
      message: ERROR[ERROR_TYPE.NO_MATCHING_RESPONSE].stringify(params),
    }),
  },
  [ERROR_TYPE.NO_MATCHING_KEY]: {
    type: ERROR_TYPE.NO_MATCHING_KEY,
    code: 1303,
    stringify: (params?: any) => `No matching key with tag: ${params?.tag}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.NO_MATCHING_KEY].code,
      message: ERROR[ERROR_TYPE.NO_MATCHING_KEY].stringify(params),
    }),
  },
  [ERROR_TYPE.UNKNOWN_JSONRPC_METHOD]: {
    type: ERROR_TYPE.UNKNOWN_JSONRPC_METHOD,
    code: 1400,
    stringify: (params?: any) => `Unknown JSON-RPC Method Requested: ${params?.method}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNKNOWN_JSONRPC_METHOD].code,
      message: ERROR[ERROR_TYPE.UNKNOWN_JSONRPC_METHOD].stringify(params),
    }),
  },
  [ERROR_TYPE.MISMATCHED_TOPIC]: {
    type: ERROR_TYPE.MISMATCHED_TOPIC,
    code: 1500,
    stringify: (params?: any) =>
      `Mismatched topic for ${params?.context || defaultParams.context} with id: ${params?.id}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.MISMATCHED_TOPIC].code,
      message: ERROR[ERROR_TYPE.MISMATCHED_TOPIC].stringify(params),
    }),
  },
  [ERROR_TYPE.MISMATCHED_ACCOUNTS]: {
    type: ERROR_TYPE.MISMATCHED_ACCOUNTS,
    code: 1501,
    stringify: (params?: any) =>
      `Invalid accounts with mismatched chains: ${params?.mismatched.toString()}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.MISMATCHED_ACCOUNTS].code,
      message: ERROR[ERROR_TYPE.MISMATCHED_ACCOUNTS].stringify(params),
    }),
  },
  [ERROR_TYPE.SETTLED]: {
    type: ERROR_TYPE.SETTLED,
    code: 1600,
    stringify: (params?: any) => `${capitalize(params?.context || defaultParams.context)} settled`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.SETTLED].code,
      message: ERROR[ERROR_TYPE.SETTLED].stringify(params),
    }),
  },
  [ERROR_TYPE.NOT_APPROVED]: {
    type: ERROR_TYPE.NOT_APPROVED,
    code: 1601,
    stringify: (params?: any) =>
      `${capitalize(params?.context || defaultParams.context)} not approved`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.NOT_APPROVED].code,
      message: ERROR[ERROR_TYPE.NOT_APPROVED].stringify(params),
    }),
  },
  [ERROR_TYPE.PROPOSAL_RESPONDED]: {
    type: ERROR_TYPE.PROPOSAL_RESPONDED,
    code: 1602,
    stringify: (params?: any) =>
      `${capitalize(params?.context || defaultParams.context)} proposal responded`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.PROPOSAL_RESPONDED].code,
      message: ERROR[ERROR_TYPE.PROPOSAL_RESPONDED].stringify(params),
    }),
  },
  [ERROR_TYPE.RESPONSE_ACKNOWLEDGED]: {
    type: ERROR_TYPE.RESPONSE_ACKNOWLEDGED,
    code: 1603,
    stringify: (params?: any) =>
      `${capitalize(params?.context || defaultParams.context)} response acknowledge`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.RESPONSE_ACKNOWLEDGED].code,
      message: ERROR[ERROR_TYPE.RESPONSE_ACKNOWLEDGED].stringify(params),
    }),
  },
  [ERROR_TYPE.EXPIRED]: {
    type: ERROR_TYPE.EXPIRED,
    code: 1604,
    stringify: (params?: any) => `${capitalize(params?.context || defaultParams.context)} expired`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.EXPIRED].code,
      message: ERROR[ERROR_TYPE.EXPIRED].stringify(params),
    }),
  },
  [ERROR_TYPE.DELETED]: {
    type: ERROR_TYPE.DELETED,
    code: 1605,
    stringify: (params?: any) => `${capitalize(params?.context || defaultParams.context)} deleted`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.DELETED].code,
      message: ERROR[ERROR_TYPE.DELETED].stringify(params),
    }),
  },
  [ERROR_TYPE.RESUBSCRIBED]: {
    type: ERROR_TYPE.RESUBSCRIBED,
    code: 1606,
    stringify: (params?: any) =>
      `Subscription resubscribed with topic: ${params.topic || defaultParams.topic}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.RESUBSCRIBED].code,
      message: ERROR[ERROR_TYPE.RESUBSCRIBED].stringify(params),
    }),
  },
  // 2000 (Timeout)
  [ERROR_TYPE.SETTLE_TIMEOUT]: {
    type: ERROR_TYPE.SETTLE_TIMEOUT,
    code: 2000,
    stringify: (params?: any) =>
      `${capitalize(
        params?.context || defaultParams.context,
      )} failed to settle after ${fromMiliseconds(params?.timeout)} seconds`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.SETTLE_TIMEOUT].code,
      message: ERROR[ERROR_TYPE.SETTLE_TIMEOUT].stringify(params),
    }),
  },
  [ERROR_TYPE.JSONRPC_REQUEST_TIMEOUT]: {
    type: ERROR_TYPE.JSONRPC_REQUEST_TIMEOUT,
    code: 2001,
    stringify: (params?: any) =>
      `JSON-RPC Request timeout after ${fromMiliseconds(params?.timeout)} seconds: ${
        params?.method
      }`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.JSONRPC_REQUEST_TIMEOUT].code,
      message: ERROR[ERROR_TYPE.JSONRPC_REQUEST_TIMEOUT].stringify(params),
    }),
  },
  // 3000 (Unauthorized)
  [ERROR_TYPE.UNAUTHORIZED_TARGET_CHAIN]: {
    type: ERROR_TYPE.UNAUTHORIZED_TARGET_CHAIN,
    code: 3000,
    stringify: (params?: any) => `Unauthorized Target ChainId Requested: ${params?.chainId}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNAUTHORIZED_TARGET_CHAIN].code,
      message: ERROR[ERROR_TYPE.UNAUTHORIZED_TARGET_CHAIN].stringify(params),
    }),
  },
  [ERROR_TYPE.UNAUTHORIZED_JSON_RPC_METHOD]: {
    type: ERROR_TYPE.UNAUTHORIZED_JSON_RPC_METHOD,
    code: 3001,
    stringify: (params?: any) => `Unauthorized JSON-RPC Method Requested: ${params?.method}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNAUTHORIZED_JSON_RPC_METHOD].code,
      message: ERROR[ERROR_TYPE.UNAUTHORIZED_JSON_RPC_METHOD].stringify(params),
    }),
  },
  [ERROR_TYPE.UNAUTHORIZED_NOTIFICATION_TYPE]: {
    type: ERROR_TYPE.UNAUTHORIZED_NOTIFICATION_TYPE,
    code: 3002,
    stringify: (params?: any) => `Unauthorized Notification Type Requested: ${params?.type}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNAUTHORIZED_NOTIFICATION_TYPE].code,
      message: ERROR[ERROR_TYPE.UNAUTHORIZED_NOTIFICATION_TYPE].stringify(params),
    }),
  },
  [ERROR_TYPE.UNAUTHORIZED_UPDATE_REQUEST]: {
    type: ERROR_TYPE.UNAUTHORIZED_UPDATE_REQUEST,
    code: 3003,
    stringify: (params?: any) =>
      `Unauthorized ${params?.context || defaultParams.context} update request`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNAUTHORIZED_UPDATE_REQUEST].code,
      message: ERROR[ERROR_TYPE.UNAUTHORIZED_UPDATE_REQUEST].stringify(params),
    }),
  },
  [ERROR_TYPE.UNAUTHORIZED_UPGRADE_REQUEST]: {
    type: ERROR_TYPE.UNAUTHORIZED_UPGRADE_REQUEST,
    code: 3004,
    stringify: (params?: any) =>
      `Unauthorized ${params?.context || defaultParams.context} upgrade request`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNAUTHORIZED_UPGRADE_REQUEST].code,
      message: ERROR[ERROR_TYPE.UNAUTHORIZED_UPGRADE_REQUEST].stringify(params),
    }),
  },
  [ERROR_TYPE.UNAUTHORIZED_MATCHING_CONTROLLER]: {
    type: ERROR_TYPE.UNAUTHORIZED_MATCHING_CONTROLLER,
    code: 3005,
    stringify: (params?: any) =>
      `Unauthorized: peer is also ${params?.controller ? "" : "not "}controller`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNAUTHORIZED_MATCHING_CONTROLLER].code,
      message: ERROR[ERROR_TYPE.UNAUTHORIZED_MATCHING_CONTROLLER].stringify(params),
    }),
  },
  // 4000 (EIP-1193)
  [ERROR_TYPE.JSONRPC_REQUEST_METHOD_REJECTED]: {
    type: ERROR_TYPE.JSONRPC_REQUEST_METHOD_REJECTED,
    code: 4001,
    stringify: (params?: any) => "User rejected the request.",
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.JSONRPC_REQUEST_METHOD_REJECTED].code,
      message: ERROR[ERROR_TYPE.JSONRPC_REQUEST_METHOD_REJECTED].stringify(params),
    }),
  },
  [ERROR_TYPE.JSONRPC_REQUEST_METHOD_UNAUTHORIZED]: {
    type: ERROR_TYPE.JSONRPC_REQUEST_METHOD_UNAUTHORIZED,
    code: 4100,
    stringify: (params?: any) =>
      "The requested account and/or method has not been authorized by the user.",
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.JSONRPC_REQUEST_METHOD_UNAUTHORIZED].code,
      message: ERROR[ERROR_TYPE.JSONRPC_REQUEST_METHOD_UNAUTHORIZED].stringify(params),
    }),
  },
  [ERROR_TYPE.JSONRPC_REQUEST_METHOD_UNSUPPORTED]: {
    type: ERROR_TYPE.JSONRPC_REQUEST_METHOD_UNSUPPORTED,
    code: 4200,
    stringify: (params?: any) =>
      `The requested method is not supported by this ${params?.blockhain ||
        defaultParams.blockchain} provider.`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.JSONRPC_REQUEST_METHOD_UNSUPPORTED].code,
      message: ERROR[ERROR_TYPE.JSONRPC_REQUEST_METHOD_UNSUPPORTED].stringify(params),
    }),
  },
  [ERROR_TYPE.DISCONNECTED_ALL_CHAINS]: {
    type: ERROR_TYPE.DISCONNECTED_ALL_CHAINS,
    code: 4900,
    stringify: (params?: any) => "The provider is disconnected from all chains.",
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.DISCONNECTED_ALL_CHAINS].code,
      message: ERROR[ERROR_TYPE.DISCONNECTED_ALL_CHAINS].stringify(params),
    }),
  },
  [ERROR_TYPE.DISCONNECTED_TARGET_CHAIN]: {
    type: ERROR_TYPE.DISCONNECTED_TARGET_CHAIN,
    code: 4901,
    stringify: (params?: any) => "The provider is disconnected from the specified chain.",
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.DISCONNECTED_TARGET_CHAIN].code,
      message: ERROR[ERROR_TYPE.DISCONNECTED_TARGET_CHAIN].stringify(params),
    }),
  },
  // 5000 (CAIP-25)
  [ERROR_TYPE.DISAPPROVED_CHAINS]: {
    type: ERROR_TYPE.DISAPPROVED_CHAINS,
    code: 5000,
    stringify: (params?: any) => `User disapproved requested chains`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.DISAPPROVED_CHAINS].code,
      message: ERROR[ERROR_TYPE.DISAPPROVED_CHAINS].stringify(params),
    }),
  },
  [ERROR_TYPE.DISAPPROVED_JSONRPC]: {
    type: ERROR_TYPE.DISAPPROVED_JSONRPC,
    code: 5001,
    stringify: (params?: any) => `User disapproved requested json-rpc methods`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.DISAPPROVED_JSONRPC].code,
      message: ERROR[ERROR_TYPE.DISAPPROVED_JSONRPC].stringify(params),
    }),
  },
  [ERROR_TYPE.DISAPPROVED_NOTIFICATION]: {
    type: ERROR_TYPE.DISAPPROVED_NOTIFICATION,
    code: 5002,
    stringify: (params?: any) => `User disapproved requested notification types`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.DISAPPROVED_NOTIFICATION].code,
      message: ERROR[ERROR_TYPE.DISAPPROVED_NOTIFICATION].stringify(params),
    }),
  },
  [ERROR_TYPE.UNSUPPORTED_CHAINS]: {
    type: ERROR_TYPE.UNSUPPORTED_CHAINS,
    code: 5100,
    stringify: (params?: any) => `Requested chains are not supported: ${params?.chains.toString()}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNSUPPORTED_CHAINS].code,
      message: ERROR[ERROR_TYPE.UNSUPPORTED_CHAINS].stringify(params),
    }),
  },
  [ERROR_TYPE.UNSUPPORTED_JSONRPC]: {
    type: ERROR_TYPE.UNSUPPORTED_JSONRPC,
    code: 5101,
    stringify: (params?: any) =>
      `Requested json-rpc methods are not supported: ${params?.methods.toString()}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNSUPPORTED_JSONRPC].code,
      message: ERROR[ERROR_TYPE.UNSUPPORTED_JSONRPC].stringify(params),
    }),
  },
  [ERROR_TYPE.UNSUPPORTED_NOTIFICATION]: {
    type: ERROR_TYPE.UNSUPPORTED_NOTIFICATION,
    code: 5102,
    stringify: (params?: any) =>
      `Requested notification types are not supported: ${params?.types.toString()}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNSUPPORTED_NOTIFICATION].code,
      message: ERROR[ERROR_TYPE.UNSUPPORTED_NOTIFICATION].stringify(params),
    }),
  },
  [ERROR_TYPE.UNSUPPORTED_SIGNAL]: {
    type: ERROR_TYPE.UNSUPPORTED_SIGNAL,
    code: 5103,
    stringify: (params?: any) =>
      `Proposed ${params?.context || defaultParams.context} signal is unsupported`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNSUPPORTED_SIGNAL].code,
      message: ERROR[ERROR_TYPE.UNSUPPORTED_SIGNAL].stringify(params),
    }),
  },

  [ERROR_TYPE.USER_DISCONNECTED]: {
    type: ERROR_TYPE.USER_DISCONNECTED,
    code: 5900,
    stringify: (params?: any) => `User disconnected ${params?.context || defaultParams.context}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.USER_DISCONNECTED].code,
      message: ERROR[ERROR_TYPE.USER_DISCONNECTED].stringify(params),
    }),
  },
  // 9000 (Unknown)
  [ERROR_TYPE.UNKNOWN]: {
    type: ERROR_TYPE.UNKNOWN,
    code: 9000,
    stringify: (params?: any) => `Unknown error${params ? `: ${params?.toString()}` : ""}`,
    format: (params?: any) => ({
      code: ERROR[ERROR_TYPE.UNKNOWN].code,
      message: ERROR[ERROR_TYPE.UNKNOWN].stringify(params),
    }),
  },
};
