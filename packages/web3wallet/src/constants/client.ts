export const PROTOCOL = "wc";
export const PROTOCOL_VERSION = 2;
export const WEB_3_WALLET_CONTEXT = "web3wallet";

export const CLIENT_STORAGE_PREFIX = `${PROTOCOL}@${PROTOCOL_VERSION}:${WEB_3_WALLET_CONTEXT}:`;

export const CLIENT_STORAGE_OPTIONS = {
  database: ":memory:",
};
