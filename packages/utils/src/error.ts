import { ErrorResponse } from "@json-rpc-tools/utils";

import { capitalize, enumify } from "./misc";

export const ERROR = enumify({
  // 0 (Generic)
  GENERIC: "GENERIC",
  // 1000 (Internal)
  MISSING_OR_INVALID: "MISSING_OR_INVALID",
  MISSING_RESPONSE: "MISSING_RESPONSE",
  MISSING_DECRYPT_PARAMS: "MISSING_DECRYPT_PARAMS",
  INVALID_UPDATE_REQUEST: "INVALID_UPDATE_REQUEST",
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
  USER_DISCONNECTED: "USER_DISCONNECTED",
  // 9000 (Unknown)
  UNKNOWN: "UNKNOWN",
});

export type ErrorType = keyof typeof ERROR;

export type ErrorFormatter = (params?: any) => ErrorResponse;

export interface ErrorFormats {
  [type: string]: ErrorFormatter;
}

const defaultParams = {
  message: "Something went wrong",
  name: "parameter",
  context: "session",
  blockchain: "Ethereum",
};

export const ERROR_FORMATS: ErrorFormats = {
  // 0 (Generic)
  [ERROR.GENERIC]: (params?: any) => ({
    code: 0,
    message: params?.message || defaultParams.message,
  }),
  // 1000 (Internal)
  [ERROR.MISSING_OR_INVALID]: (params?: any) => ({
    code: 1000,
    message: `Missing or invalid ${params?.name || defaultParams.name}`,
  }),
  [ERROR.MISSING_RESPONSE]: (params?: any) => ({
    code: 1001,
    message: `Response is required for approved ${params?.context ||
      defaultParams.context} proposals`,
  }),
  [ERROR.MISSING_DECRYPT_PARAMS]: (params?: any) => ({
    code: 1002,
    message: `Decrypt params required for ${params?.context || defaultParams.context}`,
  }),
  [ERROR.INVALID_UPDATE_REQUEST]: (params?: any) => ({
    code: 1003,
    message: `Invalid ${params?.context || defaultParams.context} update request`,
  }),
  [ERROR.RECORD_ALREADY_EXISTS]: (params?: any) => ({
    code: 1100,
    message: `Record already exists for ${params?.context || defaultParams.context} matching id: ${
      params?.id
    }`,
  }),
  [ERROR.RESTORE_WILL_OVERRIDE]: (params?: any) => ({
    code: 1200,
    message: `Restore will override already set ${params?.context || defaultParams.context}`,
  }),
  [ERROR.NO_MATCHING_ID]: (params?: any) => ({
    code: 1300,
    message: `No matching ${params?.context || defaultParams.context} with id: ${params?.id}`,
  }),
  [ERROR.NO_MATCHING_TOPIC]: (params?: any) => ({
    code: 1301,
    message: `No matching ${params?.context || defaultParams.context} with topic: ${params?.topic}`,
  }),
  [ERROR.NO_MATCHING_RESPONSE]: (params?: any) => ({
    code: 1302,
    message: `No response found in pending ${params?.context || defaultParams.context} proposal`,
  }),
  [ERROR.NO_MATCHING_KEY]: (params?: any) => ({
    code: 1303,
    message: `No matching key with tag: ${params?.tag}`,
  }),
  [ERROR.UNKNOWN_JSONRPC_METHOD]: (params?: any) => ({
    code: 1400,
    message: `Unknown JSON-RPC Method Requested: ${params?.method}`,
  }),
  [ERROR.MISMATCHED_TOPIC]: (params?: any) => ({
    code: 1500,
    message: `Mismatched topic for ${params?.context || defaultParams.context} with id: ${
      params?.id
    }`,
  }),
  [ERROR.MISMATCHED_ACCOUNTS]: (params?: any) => ({
    code: 1501,
    message: `Invalid accounts with mismatched chains: ${params?.mismatched.toString()}`,
  }),
  [ERROR.SETTLED]: (params?: any) => ({
    code: 1600,
    message: `${capitalize(params?.context || defaultParams.context)} settled`,
  }),
  [ERROR.NOT_APPROVED]: (params?: any) => ({
    code: 1601,
    message: `${capitalize(params?.context || defaultParams.context)} not approved`,
  }),
  [ERROR.PROPOSAL_RESPONDED]: (params?: any) => ({
    code: 1602,
    message: `${capitalize(params?.context || defaultParams.context)} proposal responded`,
  }),
  [ERROR.RESPONSE_ACKNOWLEDGED]: (params?: any) => ({
    code: 1603,
    message: `${capitalize(params?.context || defaultParams.context)} response acknowledge`,
  }),
  [ERROR.EXPIRED]: (params?: any) => ({
    code: 1603,
    message: `${capitalize(params?.context || defaultParams.context)} expired`,
  }),
  // 2000 (Timeout)
  [ERROR.SETTLE_TIMEOUT]: (params?: any) => ({
    code: 2000,
    message: `${capitalize(
      params?.context || defaultParams.context,
    )} failed to settle after ${params?.timeout / 1000} seconds`,
  }),
  [ERROR.JSONRPC_REQUEST_TIMEOUT]: (params?: any) => ({
    code: 2001,
    message: `JSON-RPC Request timeout after ${params?.timeout / 1000} seconds: ${params?.method}`,
  }),
  // 3000 (Unauthorized)
  [ERROR.UNAUTHORIZED_TARGET_CHAIN]: (params?: any) => ({
    code: 3000,
    message: `Unauthorized Target ChainId Requested: ${params?.chainId}`,
  }),
  [ERROR.UNAUTHORIZED_JSON_RPC_METHOD]: (params?: any) => ({
    code: 3001,
    message: `Unauthorized JSON-RPC Method Requested: ${params?.method}`,
  }),
  [ERROR.UNAUTHORIZED_NOTIFICATION_TYPE]: (params?: any) => ({
    code: 3002,
    message: `Unauthorized Notification Type Requested: ${params?.type}`,
  }),
  [ERROR.UNAUTHORIZED_UPDATE_REQUEST]: (params?: any) => ({
    code: 3003,
    message: `Unauthorized ${params?.context || defaultParams.context} update request`,
  }),
  [ERROR.UNAUTHORIZED_UPGRADE_REQUEST]: (params?: any) => ({
    code: 3004,
    message: `Unauthorized ${params?.context || defaultParams.context} upgrade request`,
  }),
  [ERROR.UNAUTHORIZED_MATCHING_CONTROLLER]: (params?: any) => ({
    code: 3005,
    message: `Unauthorized: peer is also ${params?.controller ? "" : "not "}controller`,
  }),
  // 4000 (EIP-1193)
  [ERROR.JSONRPC_REQUEST_METHOD_REJECTED]: () => ({
    code: 4001,
    message: "User rejected the request.",
  }),
  [ERROR.JSONRPC_REQUEST_METHOD_UNAUTHORIZED]: (params?: any) => ({
    code: 4100,
    message: "The requested account and/or method has not been authorized by the user.",
  }),
  [ERROR.JSONRPC_REQUEST_METHOD_UNSUPPORTED]: (params?: any) => ({
    code: 4200,
    message: `The requested method is not supported by this ${params?.blockhain ||
      defaultParams.blockchain} provider.`,
  }),
  [ERROR.DISCONNECTED_ALL_CHAINS]: () => ({
    code: 4900,
    message: "The provider is disconnected from all chains.",
  }),
  [ERROR.DISCONNECTED_TARGET_CHAIN]: () => ({
    code: 4901,
    message: "The provider is disconnected from the specified chain.",
  }),
  // 5000 (CAIP-25)
  [ERROR.DISAPPROVED_CHAINS]: (params?: any) => ({
    code: 5000,
    message: `User disapproved requested chains`,
  }),
  [ERROR.DISAPPROVED_JSONRPC]: (params?: any) => ({
    code: 5001,
    message: `User disapproved requested json-rpc methods`,
  }),
  [ERROR.DISAPPROVED_NOTIFICATION]: (params?: any) => ({
    code: 5002,
    message: `User disapproved requested notification types`,
  }),
  [ERROR.UNSUPPORTED_CHAINS]: (params?: any) => ({
    code: 5100,
    message: `Requested chains are not supported: ${params?.chains.toString()}`,
  }),
  [ERROR.UNSUPPORTED_JSONRPC]: (params?: any) => ({
    code: 5101,
    message: `Requested json-rpc methods are not supported: ${params?.methods.toString()}`,
  }),
  [ERROR.UNSUPPORTED_NOTIFICATION]: (params?: any) => ({
    code: 5102,
    message: `Requested notification types are not supported: ${params?.types.toString()}`,
  }),
  [ERROR.USER_DISCONNECTED]: (params?: any) => ({
    code: 5900,
    message: `User disconnected ${params?.context || defaultParams.context}`,
  }),
  // 9000 (Unknown)
  [ERROR.UNKNOWN]: (params?: any) => ({
    code: 9000,
    message: `Unknown error${params ? `: ${params?.toString()}` : ""}`,
  }),
};

export function getError(type: ErrorType, params?: any): ErrorResponse {
  const formatter = ERROR_FORMATS[type];
  if (typeof formatter === "undefined") return getError(ERROR.UNKNOWN, params);
  return formatter(params);
}
