import { ErrorResponse } from "@json-rpc-tools/utils";

import { capitalize, enumify } from "./misc";

export const ERROR = enumify({
  UNKNOWN: "UNKNOWN",
  GENERIC: "GENERIC",
  MISSING_OR_INVALID: "MISSING_OR_INVALID",
  NO_MATCHING_RESPONSE: "NO_MATCHING_RESPONSE",
  MISSING_RESPONSE: "MISSING_RESPONSE",
  RECORD_ALREADY_EXISTS: "RECORD_ALREADY_EXISTS",
  MISMATCHED_TOPIC: "MISMATCHED_TOPIC",
  NO_MATCHING_ID: "NO_MATCHING_ID",
  NO_MATCHING_TOPIC: "NO_MATCHING_TOPIC",
  RESTORE_WILL_OVERRIDE: "RESTORE_WILL_OVERRIDE",
  UNAUTHORIZED_JSON_RPC_METHOD: "UNAUTHORIZED_JSON_RPC_METHOD",
  UNKNOWN_JSONRPC_METHOD: "UNKNOWN_JSONRPC_METHOD",
  SETTLE_TIMEOUT: "SETTLE_TIMEOUT",
  JSONRPC_REQUEST_TIMEOUT: "JSONRPC_REQUEST_TIMEOUT",
  UNAUTHORIZED_UPDATE_REQUEST: "UNAUTHORIZED_UPDATE_REQUEST",
  INVALID_UPDATE_REQUEST: "INVALID_UPDATE_REQUEST",
  UNAUTHORIZED_UPGRADE_REQUEST: "UNAUTHORIZED_UPGRADE_REQUEST",
  UNAUTHORIZED_TARGET_CHAIN: "UNAUTHORIZED_TARGET_CHAIN",
  UNAUTHORIZED_NOTIFICATION_TYPE: "UNAUTHORIZED_NOTIFICATION_TYPE",
  MISSING_DECRYPT_PARAMS: "MISSING_DECRYPT_PARAMS",
  SETTLED: "SETTLED",
  NOT_APPROVED: "NOT_APPROVED",
  PROPOSAL_RESPONDED: "PROPOSAL_RESPONDED",
  RESPONSE_ACKNOWLEDGED: "RESPONSE_ACKNOWLEDGED",
  MATCHING_CONTROLLER: "MATCHING_CONTROLLER",
  MISMATCHED_ACCOUNTS: "MISMATCHED_ACCOUNTS",
  DISAPPROVED_CHAINS: "DISAPPROVED_CHAINS",
  DISAPPROVED_JSONRPC: "DISAPPROVED_JSONRPC",
  DISAPPROVED_NOTIFICATION: "DISAPPROVED_NOTIFICATION",
  UNSUPPORTED_CHAINS: "UNSUPPORTED_CHAINS",
  UNSUPPORTED_JSONRPC: "UNSUPPORTED_JSONRPC",
  UNSUPPORTED_NOTIFICATION: "UNSUPPORTED_NOTIFICATION",
});

export type ErrorType = keyof typeof ERROR;

export type ErrorFormatter = (params?: any) => ErrorResponse;

export interface ErrorFormats {
  [type: string]: ErrorFormatter;
}

export const ERROR_FORMATS: ErrorFormats = {
  // 1000
  [ERROR.NO_MATCHING_RESPONSE]: (params: any) => ({
    code: 1000,
    message: `No response found in pending ${params.context} proposal`,
  }),
  [ERROR.MISSING_RESPONSE]: (params: any) => ({
    code: 1001,
    message: `Response is required for approved ${params.context} proposals`,
  }),
  [ERROR.RECORD_ALREADY_EXISTS]: (params: any) => ({
    code: 1002,
    message: `Record already exists for ${params.context} matching id: ${params.id}`,
  }),
  [ERROR.MISMATCHED_TOPIC]: (params: any) => ({
    code: 1003,
    message: `Mismatched topic for ${params.context} with id: ${params.id}`,
  }),
  [ERROR.NO_MATCHING_ID]: (params: any) => ({
    code: 1004,
    message: `No matching ${params.context} with id: ${params.id}`,
  }),
  [ERROR.NO_MATCHING_TOPIC]: (params: any) => ({
    code: 1005,
    message: `No matching ${params.context} with topic: ${params.topic}`,
  }),
  [ERROR.RESTORE_WILL_OVERRIDE]: (params: any) => ({
    code: 1006,
    message: `Restore will override already set ${params.context}`,
  }),
  [ERROR.UNKNOWN_JSONRPC_METHOD]: (params: any) => ({
    code: 1007,
    message: `Unknown JSON-RPC Method Requested: ${params.method}`,
  }),
  [ERROR.MISSING_DECRYPT_PARAMS]: (params: any) => ({
    code: 1008,
    message: `Decrypt params required for ${params.context}`,
  }),
  // 2000
  [ERROR.SETTLE_TIMEOUT]: (params: any) => ({
    code: 2000,
    message: `${capitalize(params.context)} failed to settle after ${params.timeout /
      1000} seconds`,
  }),
  [ERROR.JSONRPC_REQUEST_TIMEOUT]: (params: any) => ({
    code: 2001,
    message: `JSON-RPC Request timeout after ${params.timeout / 1000} seconds: ${params.method}`,
  }),
  // 3000
  [ERROR.UNAUTHORIZED_TARGET_CHAIN]: (params: any) => ({
    code: 3000,
    message: `Unauthorized Target ChainId Requested: ${params.chainId}`,
  }),
  [ERROR.UNAUTHORIZED_JSON_RPC_METHOD]: (params: any) => ({
    code: 3001,
    message: `Unauthorized JSON-RPC Method Requested: ${params.method}`,
  }),
  [ERROR.UNAUTHORIZED_NOTIFICATION_TYPE]: (params: any) => ({
    code: 3002,
    message: `Unauthorized Notification Type Requested: ${params.type}`,
  }),
  [ERROR.UNAUTHORIZED_UPDATE_REQUEST]: (params: any) => ({
    code: 3003,
    message: `Unauthorized ${params.context} update request`,
  }),
  [ERROR.UNAUTHORIZED_UPGRADE_REQUEST]: (params: any) => ({
    code: 3004,
    message: `Unauthorized ${params.context} upgrade request`,
  }),
  // 4000
  [ERROR.SETTLED]: (params: any) => ({
    code: 4000,
    message: `${capitalize(params.context)} settled`,
  }),
  [ERROR.NOT_APPROVED]: (params: any) => ({
    code: 4001,
    message: `${capitalize(params.context)} not approved`,
  }),
  [ERROR.PROPOSAL_RESPONDED]: (params: any) => ({
    code: 4002,
    message: `${capitalize(params.context)} proposal responded`,
  }),
  [ERROR.RESPONSE_ACKNOWLEDGED]: (params: any) => ({
    code: 4003,
    message: `${capitalize(params.context)} response acknowledge`,
  }),
  // 5000
  [ERROR.MATCHING_CONTROLLER]: (params: any) => ({
    code: 5000,
    message: `Peer is also ${params.controller ? "" : "not "}controller`,
  }),
  // 6000
  [ERROR.MISSING_OR_INVALID]: (params: any) => ({
    code: 6000,
    message: `Missing or invalid ${params.name}`,
  }),
  [ERROR.INVALID_UPDATE_REQUEST]: (params: any) => ({
    code: 6001,
    message: `Invalid ${params.context} update request`,
  }),
  [ERROR.MISMATCHED_ACCOUNTS]: (params: any) => ({
    code: 6002,
    message: `Invalid accounts with mismatched chains: ${params.mismatched.toString()}`,
  }),
  // 7000
  [ERROR.DISAPPROVED_CHAINS]: (params: any) => ({
    code: 7000,
    message: `User disapproved requested chains`,
  }),
  [ERROR.DISAPPROVED_JSONRPC]: (params: any) => ({
    code: 7001,
    message: `User disapproved requested json-rpc methods`,
  }),
  [ERROR.DISAPPROVED_NOTIFICATION]: (params: any) => ({
    code: 7002,
    message: `User disapproved requested notification types`,
  }),
  // 8000
  [ERROR.UNSUPPORTED_CHAINS]: (params: any) => ({
    code: 8000,
    message: `Requested chains are not supported: ${params.chains.toString()}`,
  }),
  [ERROR.UNSUPPORTED_JSONRPC]: (params: any) => ({
    code: 8001,
    message: `Requested json-rpc methods are not supported: ${params.methods.toString()}`,
  }),
  [ERROR.UNSUPPORTED_NOTIFICATION]: (params: any) => ({
    code: 8002,
    message: `Requested notification types are not supported: ${params.types.toString()}`,
  }),
  // 9000
  [ERROR.UNKNOWN]: (params: any) => ({
    code: 9000,
    message: `Unknown error${params ? `: ${params.toString()}` : ""}`,
  }),
  [ERROR.GENERIC]: (params: any) => ({
    code: 9001,
    message: params.message,
  }),
};

export function getError(type: ErrorType, params?: any): ErrorResponse {
  const formatter = ERROR_FORMATS[type];
  if (typeof formatter === "undefined") return getError(ERROR.UNKNOWN, params);
  return formatter(params);
}
