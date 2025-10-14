import { RelayerTypes } from "@walletconnect/types";
import { parseEther, toBeHex } from "ethers";

export const CHAIN_ID = 31337;
export const CHAIN_ID_B = 1234;

export const PORT = 8545;

export const RPC_URL = `http://localhost:${PORT}`;
export const RPC_URL_B = `http://localhost:${PORT}`;

export const ACCOUNTS = {
  a: {
    balance: toBeHex(parseEther("5")),
    address: "0xaaE062157B53077da1414ec3579b4CBdF7a4116f",
    privateKey: "0xa3dac6ca0b1c61f5f0a0b3a0acf93c9a52fd94e8e33d243d3b3a8b8c5dc37f0b",
  },
  b: {
    balance: toBeHex(parseEther("1")),
    address: "0xa5961EaaF8f5F1544c8bA79328A704bffb6e47CF",
    privateKey: "0xa647cd9040eddd8cd6e0bcbea3154f7c1729e3258ba8f6e555f1e516c9dbfbcc",
  },
  c: {
    balance: toBeHex(parseEther("10")),
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
  disableProviderPing: true,
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
  "wallet_switchEthereumChain",
];

export const ALGORAND_TEST_METHODS = ["algo_signTxn"];
export const COSMOS_TEST_METHODS = ["cosmos_signDirect", "cosmos_signAmino"];
export const ELROND_TEST_METHODS = ["erd_signTransaction", "erd_signLoginToken"];
export const MULTIVERSX_TEST_METHODS = ["multiversx_signTransaction", "multiversx_signMessage"];
export const TEZOS_TEST_METHODS = ["tezos_send", "tezos_sign"];

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
    algorand: {
      methods: ALGORAND_TEST_METHODS,
      chains: [`algorand:${CHAIN_ID}`, `algorand:${CHAIN_ID_B}`],
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
    elrond: {
      methods: ELROND_TEST_METHODS,
      chains: [`elrond:${CHAIN_ID}`, `elrond:${CHAIN_ID_B}`],
      events: ["chainChanged", "accountsChanged"],
      rpcMap: {
        [CHAIN_ID]: RPC_URL,
        [CHAIN_ID_B]: RPC_URL_B,
      },
    },
    multiversx: {
      methods: MULTIVERSX_TEST_METHODS,
      chains: [`multiversx:${CHAIN_ID}`, `multiversx:${CHAIN_ID_B}`],
      events: ["chainChanged", "accountsChanged"],
      rpcMap: {
        [CHAIN_ID]: RPC_URL,
        [CHAIN_ID_B]: RPC_URL_B,
      },
    },
    tezos: {
      methods: TEZOS_TEST_METHODS,
      chains: [`tezos:${CHAIN_ID}`, `tezos:${CHAIN_ID_B}`],
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
  value: toBeHex(parseEther("1")),
  data: "0x",
};

export const TEST_SIGN_TRANSACTION = {
  to: "0xF0109fC8DF283027b6285cc889F5aA624EaC1F55",
  value: "1000000000",
  gas: 2000000,
  gasPrice: 20000000000,
};

export const TEST_EVENTS = ["chainChanged", "accountsChanged"];

export const TEST_ETHEREUM_ADDRESS = "0x3c582121909DE92Dc89A36898633C1aE4790382b";

export const TEST_ETHEREUM_CHAIN = "eip155:1";

export const TEST_GOERLI_CHAIN = "eip155:5";

export const TEST_OPTIMISM_CHAIN = "eip155:10";

export const TEST_ETHEREUM_ACCOUNT = `${TEST_ETHEREUM_CHAIN}:${TEST_ETHEREUM_ADDRESS}`;

export const TEST_GOERLI_ACCOUNT = `${TEST_GOERLI_CHAIN}:${TEST_ETHEREUM_ADDRESS}`;

export const TEST_OPTIMISM_ACCOUNT = `${TEST_OPTIMISM_CHAIN}:${TEST_ETHEREUM_ADDRESS}`;

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

export const TEST_OPTIONAL_NAMESPACES = {
  eip155: {
    methods: EIP155_TEST_METHODS,
    chains: [TEST_GOERLI_CHAIN, TEST_OPTIMISM_CHAIN],
    events: TEST_EVENTS,
  },
};

export const TEST_NAMESPACES = {
  [TEST_ETHEREUM_CHAIN]: {
    methods: EIP155_TEST_METHODS,
    accounts: [TEST_ETHEREUM_ACCOUNT, TEST_GOERLI_ACCOUNT, TEST_OPTIMISM_ACCOUNT],
    events: TEST_EVENTS,
  },
};
