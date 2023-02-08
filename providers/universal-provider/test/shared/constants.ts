import { RelayerTypes } from "@walletconnect/types";
import { utils } from "ethers";

export const CHAIN_ID = 123;
export const CHAIN_ID_B = 1234;

export const PORT = 8545;

export const RPC_URL = `http://localhost:${PORT}`;
export const RPC_URL_B = `http://localhost:${PORT}`;

export const ACCOUNTS = {
  a: {
    balance: utils.parseEther("5").toHexString(),
    address: "0xaaE062157B53077da1414ec3579b4CBdF7a4116f",
    privateKey: "0xa3dac6ca0b1c61f5f0a0b3a0acf93c9a52fd94e8e33d243d3b3a8b8c5dc37f0b",
  },
  b: {
    balance: utils.parseEther("1").toHexString(),
    address: "0xa5961EaaF8f5F1544c8bA79328A704bffb6e47CF",
    privateKey: "0xa647cd9040eddd8cd6e0bcbea3154f7c1729e3258ba8f6e555f1e516c9dbfbcc",
  },
  c: {
    balance: utils.parseEther("10").toHexString(),
    address: "0x874C1377Aa5a256de7554776e59cf01A5319502C",
    privateKey: "0x6c99734035225d3d34bd3b07a46594f8eb66269454c3f7a4a19ca505f2a46b15",
  },
  cosmos: {
    address: "cosmos19tzxudnklnmmr3l5vuhhttue7rkcpt78x0jqxr",
    privateKey: "e7343d082baa8e390dc7ebd65c891e4b42c044b5bb0cfa43d8cc0769c32c87aa",
  },
};

export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://0.0.0.0:5555";

export const TEST_APP_METADATA = {
  name: "Test App",
  description: "Test App for WalletConnect",
  url: "https://walletconnect.com/",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

export const TEST_WALLET_METADATA = {
  name: "Test Wallet",
  description: "Test Wallet for WalletConnect",
  url: "https://walletconnect.com/",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

export const TEST_PROVIDER_OPTS = {
  logger: "error",
  relayUrl: TEST_RELAY_URL,
  metadata: TEST_APP_METADATA,
  projectId: process.env.TEST_PROJECT_ID,
};

export const TEST_WALLET_CLIENT_OPTS = {
  chainId: CHAIN_ID,
  rpcUrl: RPC_URL,
  privateKey: ACCOUNTS.a.privateKey,
  relayUrl: TEST_RELAY_URL,
  metadata: TEST_WALLET_METADATA,
  projectId: process.env.TEST_PROJECT_ID,
};

export const EIP155_TEST_METHODS = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_signTypedData",
];

export const COSMOS_TEST_METHODS = ["cosmos_signDirect", "cosmos_signAmino"];

export const TEST_NAMESPACES_CONFIG = {
  namespaces: {
    eip155: {
      methods: EIP155_TEST_METHODS,
      chains: [`eip155:${CHAIN_ID}`, `eip155:${CHAIN_ID_B}`],
      events: ["chainChanged", "accountsChanged"],
      rpcMap: {
        [CHAIN_ID]: RPC_URL,
        [CHAIN_ID_B]: RPC_URL_B,
      },
    },
    cosmos: {
      methods: COSMOS_TEST_METHODS,
      chains: [`cosmos:${CHAIN_ID}`, `cosmos:${CHAIN_ID_B}`],
      events: ["chainChanged", "accountsChanged"],
      rpcMap: {
        [CHAIN_ID]: RPC_URL,
        [CHAIN_ID_B]: RPC_URL_B,
      },
    },
  },
};

export const TEST_ETH_TRANSFER = {
  from: ACCOUNTS.a.address,
  to: ACCOUNTS.b.address,
  value: utils.parseEther("1").toHexString(),
  data: "0x",
};

export const TEST_SIGN_TRANSACTION = {
  to: "0xF0109fC8DF283027b6285cc889F5aA624EaC1F55",
  value: "1000000000",
  gas: 2000000,
};

export const TEST_EVENTS = ["chainChanged", "accountsChanged"];

export const TEST_ETHEREUM_ADDRESS = "0x3c582121909DE92Dc89A36898633C1aE4790382b";

export const TEST_ETHEREUM_CHAIN = "eip155:1";

export const TEST_ETHEREUM_ACCOUNT = `${TEST_ETHEREUM_CHAIN}:${TEST_ETHEREUM_ADDRESS}`;

export const TEST_CHAINS = [TEST_ETHEREUM_CHAIN];

export const TEST_ACCOUNTS = [TEST_ETHEREUM_ACCOUNT];

export const TEST_RELAY_PROTOCOL = "irn";

export const TEST_RELAY_OPTIONS: RelayerTypes.ProtocolOptions = {
  protocol: TEST_RELAY_PROTOCOL,
};

export const TEST_REQUIRED_NAMESPACES = {
  eip155: {
    methods: EIP155_TEST_METHODS,
    chains: TEST_CHAINS,
    events: TEST_EVENTS,
  },
};

export const TEST_NAMESPACES = {
  eip155: {
    methods: EIP155_TEST_METHODS,
    accounts: TEST_ACCOUNTS,
    events: TEST_EVENTS,
  },
};
