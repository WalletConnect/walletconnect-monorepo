import { JsonRpcProvider } from "@json-rpc-tools/provider";
import { formatJsonRpcResult } from "@json-rpc-tools/utils";
import { Client, CLIENT_EVENTS } from "@walletconnect/client";
import { PairingTypes, RequestEvent, SessionTypes } from "@walletconnect/types";

import { SignerConnection, SIGNER_EVENTS } from "../src";

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

describe("@walletconnect/signer-connection", () => {
  it("should connect and respond", async () => {
    const provider = new JsonRpcProvider(
      new SignerConnection({
        chains: TEST_CHAINS,
        methods: TEST_METHODS,
        client: {
          relayProvider: TEST_RELAY_URL,
          metadata: TEST_APP_METADATA,
        },
      }),
    );
    const client = await Client.init({
      relayProvider: TEST_RELAY_URL,
      metadata: TEST_WALLET_METADATA,
    });
    // connect
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        provider.connection.on(SIGNER_EVENTS.uri, async ({ uri }) => {
          console.log(uri); // eslint-disable-line no-console
          await client.pair({ uri });
          resolve();
        });
      }),
      new Promise<void>((resolve, reject) => {
        client.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          await client.approve({ proposal, response: { state: { accounts: [] } } });
          resolve();
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        const session = await provider.connect();
        resolve();
      }),
    ]);
    // request
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        client.on(CLIENT_EVENTS.session.request, async (requestEvent: RequestEvent) => {
          if (requestEvent.request.method === TEST_JSONRPC_METHOD) {
            await client.respond({
              topic: requestEvent.topic,
              response: formatJsonRpcResult(requestEvent.request.id, TEST_JSONRPC_RESULT),
            });
            resolve();
          } else {
            reject("UNKNOWN METHOD");
          }
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        const result = await provider.request(TEST_JSONRPC_REQUEST);
        if (result === TEST_JSONRPC_RESULT) {
          resolve();
        } else {
          reject("UNKNOWN RESULT");
        }
      }),
    ]);
  });
});
