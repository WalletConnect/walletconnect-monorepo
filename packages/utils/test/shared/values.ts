export const TEST_PAIRING_TOPIC =
  "c9e6d30fb34afe70a15c14e9337ba8e4d5a35dd695c39b94884b0ee60c69d168";

export const TEST_SESSION_TOPIC =
  "f5d3f03946b6a2a3b22661fae1385cd1639bfb6f6c070115699b0a2ec1decd8c";

export const TEST_KEY_PAIRS = {
  A: {
    privateKey: "0a857b942485fee18e4c55b6ec02fef6fc0c1c3872c10e669c7790f315fd3d0b",
    publicKey: "7ff3e362f825ab868e20e767fe580d0311181632707e7c878cbeca0238d45b8b",
  },
  B: {
    privateKey: "a2582f40f38e32546df2cd8f25f19265386820347237c234a223a0d4704f3940",
    publicKey: "45c59ad0c053925072f4503a39fe579ca8b7b8fa6bf0c7297e6db8f6585ee77f",
  },
};

export const TEST_SHARED_KEY = "1b665e13f74b54aa2401bb8762b6fe06b3fdcf4c248ff0bde8781c3b02f23b06";
export const TEST_HASHED_KEY = "08ca02463e7c45383d43efaee4bbe33f700df0658e99726a755fd77f9a040988";

export const TEST_RELAY_OPTIONS = {
  protocol: "waku",
  params: {},
};

export const TEST_SESSION_METADATA = {
  name: "My App",
  description: "App that requests wallet signature",
  url: "http://myapp.com",
  icons: ["http://myapp.com/logo.png"],
};

export const TEST_ETHEREUM_CHAIN_ID = "eip155:1";

export const TEST_PERMISSIONS_CHAINS: string[] = [TEST_ETHEREUM_CHAIN_ID];

export const TEST_BLOCKCHAIN_PERMISSIONS = {
  chains: TEST_PERMISSIONS_CHAINS,
};

export const TEST_JSONRPC_PERMISSIONS = {
  methods: ["personal_sign", "eth_signTypedData", "eth_sendTransaction"],
};

export const TEST_NOTIFICATIONS_PERMISSIONS = {
  types: [],
};

export const TEST_SESSION_PERMISSIONS = {
  blockchain: TEST_BLOCKCHAIN_PERMISSIONS,
  jsonrpc: TEST_JSONRPC_PERMISSIONS,
  notifications: TEST_NOTIFICATIONS_PERMISSIONS,
};

export const TEST_ETHEREUM_ACCOUNTS = ["0x1d85568eEAbad713fBB5293B45ea066e552A90De"];

export const TEST_SESSION_ACCOUNTS = TEST_ETHEREUM_ACCOUNTS.map(
  address => `${TEST_ETHEREUM_CHAIN_ID}:${address}`,
);

export const TEST_SESSION_STATE = {
  accounts: TEST_SESSION_ACCOUNTS,
};
