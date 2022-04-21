// import path from "path";
import { SessionTypes, ClientTypes } from "@walletconnect/types";
import { ONE_SECOND, THIRTY_SECONDS, toMiliseconds } from "@walletconnect/time";

import { CLIENT_SHORT_TIMEOUT, PAIRING_DEFAULT_TTL, SESSION_DEFAULT_TTL } from "../../src";

// import { ROOT_DIR } from "../../../../ops/js/shared";

export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://localhost:5555";

export const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID
  ? process.env.TEST_PROJECT_ID
  : undefined;

export const TEST_CLIENT_OPTIONS: ClientTypes.Options = {
  logger: "fatal",
  relayUrl: TEST_RELAY_URL,
  projectId: TEST_PROJECT_ID,
  storageOptions: {
    database: ":memory:",
  },
};

// export const TEST_CLIENT_DATABASE = path.join(ROOT_DIR, "packages", "client", "test", "test.db");

export const TEST_ETHEREUM_CHAIN_ID = "eip155:1";

export const TEST_PERMISSIONS_CHAINS: string[] = [TEST_ETHEREUM_CHAIN_ID];
export const TEST_PERMISSIONS_JSONRPC_METHODS: string[] = [
  "eth_accounts",
  "eth_sendTransaction",
  "eth_signTypedData",
  "personal_sign",
];

export const TEST_APP_METADATA_A: ClientTypes.Metadata = {
  name: "App A (Proposer)",
  description: "Description of Proposer App run by client A",
  url: "https://walletconnect.com",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

export const TEST_APP_METADATA_B: ClientTypes.Metadata = {
  name: "App B (Responder)",
  description: "Description of Responder App run by client B",
  url: "https://walletconnect.com",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

export const TEST_ETHEREUM_ACCOUNTS = ["0x1d85568eEAbad713fBB5293B45ea066e552A90De"];

export const TEST_SESSION_ACCOUNTS = TEST_ETHEREUM_ACCOUNTS.map(
  address => `${TEST_ETHEREUM_CHAIN_ID}:${address}`,
);

export const TEST_SESSION_STATE = {
  accounts: TEST_SESSION_ACCOUNTS,
};

export const TEST_ETHEREUM_REQUEST = { method: "eth_accounts" };
export const TEST_ETHEREUM_RESULT = TEST_ETHEREUM_ACCOUNTS;

export const TEST_RANDOM_REQUEST = { method: "random_method" };

export const TEST_TIMEOUT_SHORT = CLIENT_SHORT_TIMEOUT;
export const TEST_TIMEOUT_SAFEGUARD = toMiliseconds(ONE_SECOND);
export const TEST_TIMEOUT_DURATION = toMiliseconds(THIRTY_SECONDS);
export const TEST_PAIRING_TTL = toMiliseconds(PAIRING_DEFAULT_TTL);
export const TEST_SESSION_TTL = toMiliseconds(SESSION_DEFAULT_TTL);
