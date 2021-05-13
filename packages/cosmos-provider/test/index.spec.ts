import "mocha";
import { expect } from "chai";
import { SIGNER_EVENTS } from "@walletconnect/signer-connection";
import { Client, CLIENT_EVENTS } from "@walletconnect/client";
import { SessionTypes } from "@walletconnect/types";

import CosmosProvider from "./../src/index";

const NAMESPACE = "cosmos";
const CHAIN_ID = "cosmoshub-4";
const RPC_URL = `https://rpc.cosmos.network/`;

const wallet = {
  address: "cosmos1t2uflqwqe0fsj0shcfkrvpukewcw40yjj6hdc0",
} as any;

export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://localhost:5555";

const TEST_JSONRPC_METHOD = "test_method";
const TEST_JSONRPC_REQUEST = { method: TEST_JSONRPC_METHOD, params: [] };
const TEST_JSONRPC_RESULT = "it worked";

const TEST_CHAINS = [CHAIN_ID];
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

describe("@walletconnect/cosmos-provider", () => {
  it("Test connect", async () => {
    const walletClient = await Client.init({
      controller: true,
      relayProvider: TEST_RELAY_URL,
      metadata: TEST_WALLET_METADATA,
    });
    const provider = new CosmosProvider({
      chains: TEST_CHAINS,
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
          const response = { state: { accounts: [`${wallet.address}@${NAMESPACE}:${CHAIN_ID}`] } };
          await walletClient.approve({
            proposal,
            response,
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        await provider.connect();
        accounts = provider.accounts;
        resolve();
      }),
    ]);
    expect(
      accounts[0].split("@")[0] === wallet.address,
      "Returned account address is equal to test address",
    ); // TODO Fails because of this, TypeError: Cannot read property 'split' of undefined
  });
});
