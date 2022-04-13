export const TEST_PAIRING_TOPIC =
  "c9e6d30fb34afe70a15c14e9337ba8e4d5a35dd695c39b94884b0ee60c69d168";

export const TEST_SESSION_TOPIC =
  "f5d3f03946b6a2a3b22661fae1385cd1639bfb6f6c070115699b0a2ec1decd8c";

export const TEST_SYM_KEY = "587d5484ce2a2a6ee3ba1962fdd7e8588e06200c46823bd18fbd67def96ad303";

export const TEST_KEY_PAIRS = {
  A: {
    privateKey: "1fb63fca5c6ac731246f2f069d3bc2454345d5208254aa8ea7bffc6d110c8862",
    publicKey: "ff7a7d5767c362b0a17ad92299ebdb7831dcbd9a56959c01368c7404543b3342",
  },
  B: {
    privateKey: "36bf507903537de91f5e573666eaa69b1fa313974f23b2b59645f20fea505854",
    publicKey: "590c2c627be7af08597091ff80dd41f7fa28acd10ef7191d7e830e116d3a186a",
  },
};

export const TEST_SHARED_KEY = "9c87e48e69b33a613907515bcd5b1b4cc10bbaf15167b19804b00f0a9217e607";
export const TEST_HASHED_KEY = "a492906ccc809a411bb53a84572b57329375378c6ad7566f3e1c688200123e77";
export const TEST_SYM_KEY = "0653ca620c7b4990392e1c53c4a51c14a2840cd20f0f1524cf435b17b6fe988c";

export const TEST_RELAY_OPTIONS = {
  protocol: "waku",
  data: "",
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
