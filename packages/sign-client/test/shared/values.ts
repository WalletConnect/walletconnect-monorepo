import { SignClientTypes, RelayerTypes } from "@walletconnect/types";

export const PACKAGE_NAME = "sign-client";

export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://0.0.0.0:5555";

export const TEST_RELAY_URL_US = "wss://us-east-1.relay.walletconnect.com";
export const TEST_RELAY_URL_EU = "wss://eu-central-1.relay.walletconnect.com";
export const TEST_RELAY_URL_AP = "wss://ap-southeast-1.relay.walletconnect.com";

// See https://github.com/WalletConnect/push-webhook-test-server
export const TEST_WEBHOOK_ENDPOINT = "https://webhook-push-test.walletconnect.com/";

export const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID
  ? process.env.TEST_PROJECT_ID
  : undefined;

export const TEST_SIGN_CLIENT_OPTIONS: SignClientTypes.Options = {
  logger: "error",
  relayUrl: TEST_RELAY_URL,
  projectId: TEST_PROJECT_ID,
  storageOptions: {
    database: ":memory:",
  },
  metadata: {
    redirect: {
      universal: "App A (Proposer)",
    },
    name: "App A (Proposer)",
    description: "Description of Proposer App run by client A",
    url: "https://walletconnect.com",
    icons: ["https://avatars.githubusercontent.com/u/37784886"],
  },
};

export const TEST_SIGN_CLIENT_OPTIONS_USA: SignClientTypes.Options = {
  logger: "error",
  relayUrl: TEST_RELAY_URL_US,
  projectId: TEST_PROJECT_ID,
  storageOptions: {
    database: ":memory:",
  },
};

export const TEST_SIGN_CLIENT_OPTIONS_EU: SignClientTypes.Options = {
  logger: "error",
  relayUrl: TEST_RELAY_URL_EU,
  projectId: TEST_PROJECT_ID,
  storageOptions: {
    database: ":memory:",
  },
};

export const TEST_SIGN_CLIENT_OPTIONS_AP: SignClientTypes.Options = {
  logger: "error",
  relayUrl: TEST_RELAY_URL_AP,
  projectId: TEST_PROJECT_ID,
  storageOptions: {
    database: ":memory:",
  },
};

export const TEST_SIGN_CLIENT_NAME_A = "client_a";
export const TEST_APP_METADATA_A: SignClientTypes.Metadata = {
  name: "App A (Proposer)",
  description: "Description of Proposer App run by client A",
  url: "https://app.a.walletconnect.com",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
  redirect: {
    universal: "App A (Proposer)",
    native: "App A Native (Proposer)",
  },
};

export const TEST_SIGN_CLIENT_NAME_B = "client_b";
export const TEST_APP_METADATA_B: SignClientTypes.Metadata = {
  name: "App B (Responder)",
  description: "Description of Responder App run by client B",
  url: "https://app.b.walletconnect.com",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
  redirect: {
    universal: "App B (Responder)",
    native: "App B Native (Responder)",
  },
};

export const TEST_RELAY_PROTOCOL = "irn";
export const TEST_RELAY_OPTIONS: RelayerTypes.ProtocolOptions = {
  protocol: TEST_RELAY_PROTOCOL,
};

export const TEST_SIGN_CLIENT_OPTIONS_A = {
  ...TEST_SIGN_CLIENT_OPTIONS,
  name: TEST_SIGN_CLIENT_NAME_A,
  metadata: TEST_APP_METADATA_A,
};

export const TEST_SIGN_CLIENT_OPTIONS_B = {
  ...TEST_SIGN_CLIENT_OPTIONS,
  name: TEST_SIGN_CLIENT_NAME_B,
  metadata: TEST_APP_METADATA_B,
};

export const TEST_ETHEREUM_CHAIN = "eip155:1";
export const TEST_ARBITRUM_CHAIN = "eip155:42161";
export const TEST_AVALANCHE_CHAIN = "eip155:43114";
export const TEST_POLKADOT_CHAIN = "polkadot:91b171bb158e2d3848fa23a9f1c25182";

export const TEST_CHAINS = [TEST_ETHEREUM_CHAIN, TEST_ARBITRUM_CHAIN];
export const TEST_METHODS = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_signTypedData",
];
export const TEST_POLKADOT_METHODS = ["polkadot_signTransaction", "polkadot_signMessage"];
export const TEST_EVENTS = ["chainChanged", "accountsChanged"];

export const TEST_ETHEREUM_ADDRESS = "0x3c582121909DE92Dc89A36898633C1aE4790382b";
export const TEST_POLKADOT_ADDRESS = "8cGfbK9Q4zbsNzhZsZUtpsQgX5LG2UCPEDuXYV33whktGt7";
export const TEST_ETHEREUM_ACCOUNT = `${TEST_ETHEREUM_CHAIN}:${TEST_ETHEREUM_ADDRESS}`;
export const TEST_ARBITRUM_ACCOUNT = `${TEST_ARBITRUM_CHAIN}:${TEST_ETHEREUM_ADDRESS}`;
export const TEST_AVALANCHE_ACCOUNT = `${TEST_AVALANCHE_CHAIN}:${TEST_ETHEREUM_ADDRESS}`;
export const TEST_POLKADOT_ACCOUNT = `${TEST_POLKADOT_CHAIN}:${TEST_POLKADOT_ADDRESS}`;

export const TEST_ACCOUNTS = [TEST_ETHEREUM_ACCOUNT, TEST_ARBITRUM_ACCOUNT];

export const TEST_POLKADOT_CHAINS = ["polkadot:91b171bb158e2d3848fa23a9f1c25182"];
export const TEST_POLKADOT_ACCOUNTS = [TEST_POLKADOT_ACCOUNT];

export const TEST_REQUIRED_NAMESPACES = {
  eip155: {
    methods: TEST_METHODS,
    chains: TEST_CHAINS,
    events: TEST_EVENTS,
  },
};

export const TEST_REQUIRED_NAMESPACES_V2 = {
  eip155: {
    methods: TEST_METHODS,
    chains: TEST_CHAINS,
    events: TEST_EVENTS,
  },
  [TEST_AVALANCHE_CHAIN]: {
    methods: TEST_METHODS,
    events: TEST_EVENTS,
  },
};

export const TEST_OPTIONAL_NAMESPACES = {
  polkadot: {
    methods: TEST_POLKADOT_METHODS,
    chains: TEST_POLKADOT_CHAINS,
    events: TEST_EVENTS,
  },
};

export const TEST_NAMESPACES = {
  eip155: {
    chains: TEST_CHAINS,
    methods: TEST_METHODS,
    accounts: TEST_ACCOUNTS,
    events: TEST_EVENTS,
  },
  polkadot: {
    chains: TEST_POLKADOT_CHAINS,
    methods: TEST_POLKADOT_METHODS,
    accounts: TEST_POLKADOT_ACCOUNTS,
    events: TEST_EVENTS,
  },
};

export const TEST_NAMESPACES_V2 = {
  eip155: {
    methods: TEST_METHODS,
    accounts: [TEST_ETHEREUM_ACCOUNT, TEST_AVALANCHE_ACCOUNT, TEST_ARBITRUM_ACCOUNT],
    events: TEST_EVENTS,
  },
};

export const TEST_SESSION_PROPERTIES = {
  expiry: "2022-12-24T17:07:31+00:00",
  "caip154-mandatory": "true",
};

export const TEST_SESSION_PROPERTIES_APPROVE = {
  expiry: "2022-12-24T17:07:31+00:00",
};

export const TEST_NAMESPACES_INVALID_METHODS = {
  eip155: { ...TEST_NAMESPACES.eip155, methods: ["eth_invalid"] },
};
export const TEST_NAMESPACES_INVALID_CHAIN = { eip1111: { ...TEST_NAMESPACES.eip155 } };

export const TEST_MESSAGE = "My name is John Doe";
export const TEST_SIGNATURE =
  "0xc8906b32c9f74d0805226ffff5ecd6897ea55cdf58f54a53a2e5b5d5a21fb67f43ef1d4c2ed790a724a1549b4cc40137403048c4aed9825cfd5ba6c1d15bd0721c";

export const TEST_SIGN_METHOD = "personal_sign";
export const TEST_SIGN_PARAMS = [TEST_MESSAGE, TEST_ETHEREUM_ADDRESS];
export const TEST_SIGN_REQUEST = { method: TEST_SIGN_METHOD, params: TEST_SIGN_PARAMS };

export const TEST_RANDOM_REQUEST = { method: "random_method", params: [] };

export const TEST_CONNECT_PARAMS = {
  requiredNamespaces: TEST_REQUIRED_NAMESPACES,
  relays: [TEST_RELAY_OPTIONS],
};

export const TEST_APPROVE_PARAMS = {
  id: 123,
  namespaces: TEST_NAMESPACES,
};

export const TEST_REJECT_PARAMS = {
  id: 123,
  reason: {
    code: 0,
    message: "GENERIC",
  },
};

export const TEST_UPDATE_PARAMS = {
  namespaces: TEST_NAMESPACES,
};

export const TEST_REQUEST_PARAMS = {
  request: { method: TEST_METHODS[0], params: [] },
  chainId: TEST_CHAINS[0],
};

export const TEST_REQUEST_PARAMS_OPTIONAL_NAMESPACE = {
  request: { method: TEST_POLKADOT_METHODS[0], params: [] },
  chainId: TEST_POLKADOT_CHAIN,
};

export const TEST_RESPOND_PARAMS = {
  response: {
    id: 1,
    jsonrpc: "2.0",
    result: {},
  },
};

export const TEST_EMIT_PARAMS = {
  event: { name: TEST_EVENTS[0], data: "" },
  chainId: TEST_CHAINS[0],
};

type RelayerType = {
  value: string;
  label: string;
};

export const TEST_SIGN_REQUEST_PARAMS = {
  method: "eth_signTransaction",
  params: [
    {
      from: TEST_ETHEREUM_ACCOUNT,
      to: TEST_ETHEREUM_ACCOUNT,
      data: "0x",
      nonce: "0x01",
      gasPrice: "0x020a7ac094",
      gasLimit: "0x5208",
      value: "0x00",
    },
  ],
};

export const TESTS_CONNECT_RETRIES = 5;
export const TESTS_CONNECT_TIMEOUT = 60_000;
