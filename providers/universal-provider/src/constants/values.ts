export const LOGGER = "error";

export const RELAY_URL = "wss://relay.walletconnect.org";

export const PROTOCOL = "wc";
export const WC_VERSION = 2;
export const CONTEXT = "universal_provider";

export const STORAGE = `${PROTOCOL}@${WC_VERSION}:${CONTEXT}:`;

export const RPC_URL = "https://rpc.walletconnect.org/v1/";

export const GENERIC_SUBPROVIDER_NAME = "generic";

export const BUNDLER_URL = `${RPC_URL}bundler`;

export const CALL_STATUS_STORAGE_KEY = "call_status";

export const CALL_STATUS_RESULT_EXPIRY = 86400; // 24 hours in seconds

// bumped by `scripts/update_relayer_sdk_version.sh`
export const UNIVERSAL_PROVIDER_SDK_VERSION = "2.25.0";

export const WALLET_FEE_API_URL = "https://api.walletconnect.com";

export const WALLET_FEE_TIMEOUT_MS = 3000;
