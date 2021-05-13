import "mocha";
import { expect } from "chai";
import { SIGNER_EVENTS } from "@walletconnect/signer-connection";
import { Client, CLIENT_EVENTS } from "@walletconnect/client";
import { SessionTypes } from "@walletconnect/types";

import CosmosProvider from "./../src/index";

const CHAIN_ID = "cosmos:cosmoshub-4";
const RPC_URL = `https://rpc.cosmos.network/`;

const wallet = {} as any;

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
  it("Test enable", async () => {
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
          await walletClient.approve({
            proposal,
            response: {
              state: { accounts: [`${wallet.address}@${CHAIN_ID}`] },
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
