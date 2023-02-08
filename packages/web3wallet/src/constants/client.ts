export const PROTOCOL = "wc";
export const PROTOCOL_VERSION = 2;
export const CLIENT_CONTEXT = "Web3Wallet";

export const CLIENT_STORAGE_PREFIX = `${PROTOCOL}@${PROTOCOL_VERSION}:${CLIENT_CONTEXT}:`;

export const CLIENT_STORAGE_OPTIONS = {
  database: ":memory:",
};
