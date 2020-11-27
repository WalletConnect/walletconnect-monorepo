import { ClientOptions, SessionTypes } from "@walletconnect/types";

// TODO: Relay Provider URL needs to be set from ops
export const TEST_RELAY_PROVIDER_URL = "ws://localhost:5555";

export const TEST_CLIENT_OPTIONS: ClientOptions = {
  logger: "debug",
  relayProvider: TEST_RELAY_PROVIDER_URL,
};

export const TEST_ETHEREUM_CHAIN_ID = "eip155:1";

export const TEST_PERMISSIONS_CHAIN_IDS: string[] = [TEST_ETHEREUM_CHAIN_ID];
export const TEST_PERMISSIONS_JSONRPC_METHODS: string[] = [
  "eth_accounts",
  "eth_sendTransaction",
  "eth_signTypedData",
  "personal_sign",
];

export const TEST_PERMISSIONS: SessionTypes.Permissions = {
  blockchain: {
    chainIds: TEST_PERMISSIONS_CHAIN_IDS,
  },
  jsonrpc: {
    methods: TEST_PERMISSIONS_JSONRPC_METHODS,
  },
};

export const TEST_APP_METADATA_A: SessionTypes.Metadata = {
  name: "App A (Proposer)",
  description: "Description of Proposer App run by client A",
  url: "#",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

export const TEST_APP_METADATA_B: SessionTypes.Metadata = {
  name: "App B (Responder)",
  description: "Description of Responder App run by client B",
  url: "#",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

export const TEST_ETHEREUM_ACCOUNTS = ["0x1d85568eEAbad713fBB5293B45ea066e552A90De"];

export const TEST_SESSION_ACCOUNT_IDS = TEST_ETHEREUM_ACCOUNTS.map(
  address => `${address}@${TEST_ETHEREUM_CHAIN_ID}`,
);

export const TEST_SESSION_STATE = {
  accountIds: TEST_SESSION_ACCOUNT_IDS,
};
