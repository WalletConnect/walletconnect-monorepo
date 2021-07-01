import "mocha";
import { expect } from "chai";
import { ethers } from "ethers";
import { TestNetwork } from "ethereum-test-network";
import { SignerConnection, SIGNER_EVENTS } from "@walletconnect/signer-connection";
import { Client, CLIENT_EVENTS } from "@walletconnect/client";
import { IClient, RequestEvent, SessionTypes } from "@walletconnect/types";

import EthereumProvider from "./../src/index";

const CHAIN_ID = 123;
const PORT = 8545;
const BLOCKCHAIN = "eip155";
const RPC_URL = `http://localhost:${PORT}`;
const DEFAULT_GENESIS_ACCOUNTS = [
  {
    balance: "0x295BE96E64066972000000",
    privateKey: "0xa3dac6ca0b1c61f5f0a0b3a0acf93c9a52fd94e8e33d243d3b3a8b8c5dc37f0b", // 0xaaE062157B53077da1414ec3579b4CBdF7a4116f
  },
];
const wallet = new ethers.Wallet(DEFAULT_GENESIS_ACCOUNTS[0].privateKey);

export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://localhost:5555";

const TEST_JSONRPC_METHOD = "test_method";
const TEST_JSONRPC_REQUEST = { method: TEST_JSONRPC_METHOD, params: [] };
const TEST_JSONRPC_RESULT = "it worked";

const TEST_CHAINS = [];
const TEST_METHODS = [TEST_JSONRPC_METHOD];

const TEST_APP_METADATA = {
  name: "Test App",
  description: "Test App for WalletConnect",
  url: "https://walletconnect.org/",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

const TEST_WALLET_METADATA = {
  name: "Test Wallet",
  description: "Test Wallet for WalletConnect",
  url: "https://walletconnect.org/",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

describe("@walletconnect/ethereum-provider", () => {
  let testNetwork: TestNetwork;

  before(async () => {
    testNetwork = await TestNetwork.init({
      chainId: CHAIN_ID,
      port: PORT,
      genesisAccounts: DEFAULT_GENESIS_ACCOUNTS,
    });
  });

  after(async () => {
    await testNetwork.close();
  });

  it("Test enable", async () => {
    const walletClient = await Client.init({
      controller: true,
      relayProvider: TEST_RELAY_URL,
      metadata: TEST_WALLET_METADATA,
    });
    const provider = new EthereumProvider({
      chainId: CHAIN_ID,
      rpc: {
        custom: {
          [CHAIN_ID]: RPC_URL,
        },
      },
      client: {
        relayProvider: TEST_RELAY_URL,
        metadata: TEST_APP_METADATA,
      },
    });

    // auto-pair
    provider.signer.connection.on(SIGNER_EVENTS.uri, ({ uri }) => walletClient.pair({ uri }));
    // connect
    let accounts: string[] = [];

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        walletClient.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          await walletClient.approve({
            proposal,
            response: {
              state: { accounts: [`${wallet.address}@${BLOCKCHAIN}:${CHAIN_ID}`] },
            },
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        accounts = await provider.enable();
        resolve();
      }),
    ]);
    expect(
      accounts[0].split("@")[0] === wallet.address,
      "Returned account address is equal to test address",
    ); // TODO Fails because of this, TypeError: Cannot read property 'split' of undefined
  });
});

function formatEIP155(address: string, blockchain: string, chainId: number) {
  return `${address}@${blockchain}:${chainId}`;
}
