import path from "path";
import { ClientTypes, RelayerTypes } from "@walletconnect/types";
import { calcExpiry } from "@walletconnect/utils";
import { FIVE_MINUTES } from "@walletconnect/time";

// @ts-ignore
import { ROOT_DIR } from "../../../../ops/js/shared";

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

export const TEST_CLIENT_DATABASE = path.join(ROOT_DIR, "packages", "client", "test", "test.db");

export const TEST_CLIENT_NAME_A = "client_a";
export const TEST_APP_METADATA_A: ClientTypes.Metadata = {
  name: "App A (Proposer)",
  description: "Description of Proposer App run by client A",
  url: "https://walletconnect.com",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

export const TEST_CLIENT_NAME_B = "client_b";
export const TEST_APP_METADATA_B: ClientTypes.Metadata = {
  name: "App B (Responder)",
  description: "Description of Responder App run by client B",
  url: "https://walletconnect.com",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

export const TEST_RELAY_PROTOCOL = "waku";
export const TEST_RELAY_OPTIONS: RelayerTypes.ProtocolOptions = {
  protocol: TEST_RELAY_PROTOCOL,
};

export const TEST_CLIENT_OPTIONS_A = {
  ...TEST_CLIENT_OPTIONS,
  name: TEST_CLIENT_NAME_A,
  metadata: TEST_APP_METADATA_A,
};

export const TEST_CLIENT_OPTIONS_B = {
  ...TEST_CLIENT_OPTIONS,
  name: TEST_CLIENT_NAME_B,
  metadata: TEST_APP_METADATA_B,
};

export const TEST_ETHEREUM_CHAIN = "eip155:1";
export const TEST_ARBITRUM_CHAIN = "eip155:42161";
export const TEST_AVALANCHE_CHAIN = "eip155:43114";

export const TEST_CHAINS = [TEST_ETHEREUM_CHAIN, TEST_ARBITRUM_CHAIN, TEST_AVALANCHE_CHAIN];
export const TEST_METHODS = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_signTypedData",
];
export const TEST_EVENTS = ["chainChanged", "accountsChanged"];

export const TEST_NAMESPACES = [
  {
    methods: TEST_METHODS,
    chains: TEST_CHAINS,
    events: TEST_EVENTS,
  },
];

export const TEST_ETHEREUM_ADDRESS = "0x3c582121909DE92Dc89A36898633C1aE4790382b";

export const TEST_ETHEREUM_ACCOUNT = `${TEST_ETHEREUM_CHAIN}:${TEST_ETHEREUM_ADDRESS}`;

export const TEST_ACCOUNTS = [TEST_ETHEREUM_ACCOUNT];

export const TEST_MESSAGE = "My name is John Doe";
export const TEST_SIGNATURE =
  "0xc8906b32c9f74d0805226ffff5ecd6897ea55cdf58f54a53a2e5b5d5a21fb67f43ef1d4c2ed790a724a1549b4cc40137403048c4aed9825cfd5ba6c1d15bd0721c";

export const TEST_SIGN_METHOD = "personal_sign";
export const TEST_SIGN_PARAMS = [TEST_MESSAGE, TEST_ETHEREUM_ADDRESS];
export const TEST_SIGN_REQUEST = { method: TEST_SIGN_METHOD, params: TEST_SIGN_PARAMS };

export const TEST_RANDOM_REQUEST = { method: "random_method", params: [] };

export const TEST_CONNECT_PARAMS = {
  namespaces: TEST_NAMESPACES,
  relays: [TEST_RELAY_OPTIONS],
};

export const TEST_APPROVE_PARAMS = {
  id: 123,
  accounts: TEST_ACCOUNTS,
  namespaces: TEST_NAMESPACES,
};

export const TEST_REJECT_PARAMS = {
  id: 123,
  reason: {
    code: 0,
    message: "GENERIC",
  },
};

export const TEST_UPDATE_ACCOUNTS_PARAMS = {
  accounts: TEST_ACCOUNTS,
};

export const TEST_UPDATE_EXPIRY_PARAMS = {
  expiry: calcExpiry(FIVE_MINUTES),
};

export const TEST_EMIT_PARAMS = {
  event: TEST_EVENTS[0],
  chainId: TEST_CHAINS[0],
};

// export const TEST_TIMEOUT_SHORT = CLIENT_SHORT_TIMEOUT;
// export const TEST_TIMEOUT_SAFEGUARD = toMiliseconds(ONE_SECOND);
// export const TEST_TIMEOUT_DURATION = toMiliseconds(THIRTY_SECONDS);
// export const TEST_PAIRING_TTL = toMiliseconds(PAIRING_DEFAULT_TTL);
// export const TEST_SESSION_TTL = toMiliseconds(SESSION_DEFAULT_TTL);
