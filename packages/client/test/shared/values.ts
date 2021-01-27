import path from "path";
import { ClientOptions, SessionTypes } from "@walletconnect/types";

import { ROOT_DIR } from "../../../../ops/js/shared";

export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://localhost:5555";

export const TEST_CLIENT_OPTIONS: ClientOptions = {
  logger: "fatal",
  relayProvider: TEST_RELAY_URL,
};

export const TEST_CLIENT_DATABASE = path.join(ROOT_DIR, "packages", "client", "test", "test.db");

export const TEST_ETHEREUM_CHAIN_ID = "eip155:1";

export const TEST_PERMISSIONS_CHAINS: string[] = [TEST_ETHEREUM_CHAIN_ID];
export const TEST_PERMISSIONS_JSONRPC_METHODS: string[] = [
  "eth_accounts",
  "eth_sendTransaction",
  "eth_signTypedData",
  "personal_sign",
];

export const TEST_PERMISSIONS: SessionTypes.BasePermissions = {
  blockchain: {
    chains: TEST_PERMISSIONS_CHAINS,
  },
  jsonrpc: {
    methods: TEST_PERMISSIONS_JSONRPC_METHODS,
  },
};

export const TEST_APP_METADATA_A: SessionTypes.Metadata = {
  name: "App A (Proposer)",
  description: "Description of Proposer App run by client A",
  url: "https://walletconnect.org",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

export const TEST_APP_METADATA_B: SessionTypes.Metadata = {
  name: "App B (Responder)",
  description: "Description of Responder App run by client B",
  url: "https://walletconnect.org",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

export const TEST_ETHEREUM_ACCOUNTS = ["0x1d85568eEAbad713fBB5293B45ea066e552A90De"];

export const TEST_SESSION_ACCOUNTS = TEST_ETHEREUM_ACCOUNTS.map(
  address => `${address}@${TEST_ETHEREUM_CHAIN_ID}`,
);

export const TEST_SESSION_STATE = {
  accounts: TEST_SESSION_ACCOUNTS,
};

export const TEST_ETHEREUM_REQUEST = { method: "eth_accounts" };
export const TEST_ETHEREUM_RESULT = TEST_ETHEREUM_ACCOUNTS;

export const TEST_RANDOM_REQUEST = { method: "random_method" };
