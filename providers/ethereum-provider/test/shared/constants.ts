import { utils } from "ethers";

export const CHAIN_ID = 123;

export const PORT = 8545;

export const RPC_URL = `http://localhost:${PORT}`;

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
  chainId: CHAIN_ID,
  rpcMap: {
    [CHAIN_ID]: RPC_URL,
  },
  client: {
    relayUrl: TEST_RELAY_URL,
    metadata: TEST_APP_METADATA,
  },
};

export const TEST_WALLET_CLIENT_OPTS = {
  chainId: CHAIN_ID,
  rpcUrl: RPC_URL,
  privateKey: ACCOUNTS.a.privateKey,
  relayUrl: TEST_RELAY_URL,
  projectId: process.env.TEST_PROJECT_ID,
  metadata: TEST_WALLET_METADATA,
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

export const TEST_ETHEREUM_METHODS_REQUIRED = ["eth_sendTransaction", "personal_sign"];

export const TEST_ETHEREUM_METHODS_OPTIONAL = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_signTypedData",
];
