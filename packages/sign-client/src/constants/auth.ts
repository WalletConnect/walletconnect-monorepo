export const AUTH_PROTOCOL = "wc";
export const AUTH_VERSION = 1.5;
export const AUTH_CONTEXT = "auth";
export const AUTH_KEYS_CONTEXT = "authKeys";
export const AUTH_PAIRING_TOPIC_CONTEXT = "pairingTopics";
export const AUTH_REQUEST_CONTEXT = "requests";

export const AUTH_STORAGE_PREFIX = `${AUTH_PROTOCOL}@${AUTH_VERSION}:${AUTH_CONTEXT}:`;
export const AUTH_PUBLIC_KEY_NAME = `${AUTH_STORAGE_PREFIX}:PUB_KEY`;
