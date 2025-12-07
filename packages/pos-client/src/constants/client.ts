export const PROTOCOL = "wc";
export const PROTOCOL_VERSION = 2;
export const CLIENT_CONTEXT = "POSClient";

export const CLIENT_STORAGE_PREFIX = `${PROTOCOL}@${PROTOCOL_VERSION}:${CLIENT_CONTEXT}:`;

export const CLIENT_STORAGE_OPTIONS = {
  database: ":memory:",
  customStoragePrefix: "@walletconnect/pos-client",
};

export const POS_CLIENT_VERSION = "1.0.0";

export const MAX_TRANSACTION_STATUS_CHECKS = 10;

export const DEFAULT_LOGGER_LEVEL = "error";
