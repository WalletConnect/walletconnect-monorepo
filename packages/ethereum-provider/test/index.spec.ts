import "mocha";
import EthereumProvider from "./../src/index";
import { SignerConnection, SIGNER_EVENTS } from "@walletconnect/signer-connection";
import { TestNetwork } from "ethereum-test-network";
import { expect } from "chai";
import { Client, CLIENT_EVENTS } from "@walletconnect/client";
import { IClient, RequestEvent, SessionTypes } from "@walletconnect/types";

const CHAIN_ID = 123;
const PORT = 8545;
const RPC_URL = `http://localhost:${PORT}`;
const DEFAULT_GENESIS_ACCOUNTS = [
  {
    balance: "0x295BE96E64066972000000",
    privateKey: "0xa3dac6ca0b1c61f5f0a0b3a0acf93c9a52fd94e8e33d243d3b3a8b8c5dc37f0b", // 0xaaE062157B53077da1414ec3579b4CBdF7a4116f
  },
];

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
  let testnetwork: TestNetwork;

  before(async () => {
    testnetwork = await TestNetwork.init({
      chainId: CHAIN_ID,
      port: PORT,
      genesisAccounts: DEFAULT_GENESIS_ACCOUNTS,
    });
  });

  after(async () => {
    await testnetwork.close();
  });

  it("Test enable", async () => {
    const wallet = await Client.init({
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
    provider.signer.connection.on(SIGNER_EVENTS.uri, ({ uri }) => wallet.pair({ uri }));
    // connect
    let accounts: string[] = [];

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        wallet.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          await wallet.approve({ proposal, response: { state: { accounts: [] } } });
          resolve();
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        accounts = await provider.enable();
        resolve();
      }),
    ]);
    // eslint-disable-next-line no-console
    console.log(accounts);
    // console.log(provider.accounts);
    expect(accounts.length > 0, "Accounts is array and more then 0");
  });
});
