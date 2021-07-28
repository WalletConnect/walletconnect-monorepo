import "mocha";
import * as chai from "chai";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { Client, CLIENT_EVENTS } from "@walletconnect/client";
import { IClient, RequestEvent, SessionTypes } from "@walletconnect/types";

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

async function setup() {
  const connection = new SignerConnection({
    chains: TEST_CHAINS,
    methods: TEST_METHODS,
    client: {
      relayProvider: TEST_RELAY_URL,
      metadata: TEST_APP_METADATA,
    },
  });
  const provider = new JsonRpcProvider(connection);
  const clientB = await Client.init({
    controller: true,
    relayProvider: TEST_RELAY_URL,
    metadata: TEST_WALLET_METADATA,
  });
  return { provider, wallet: clientB };
}

async function testConnect(provider: JsonRpcProvider, wallet: IClient) {
  let topic = "";
  // auto-pair
  provider.connection.on(SIGNER_EVENTS.uri, async ({ uri }) => {
    await wallet.pair({ uri });
  });
  // connect
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      wallet.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
        await wallet.approve({ proposal, response: { state: { accounts: [] } } });
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      await provider.connect();
      resolve();
    }),
    new Promise<void>(async (resolve, reject) => {
      wallet.on(CLIENT_EVENTS.session.created, async (session: SessionTypes.Created) => {
        topic = session.topic;
        resolve();
      });
    }),
  ]);
  return topic;
}

async function testRequest(provider: JsonRpcProvider, wallet: IClient, topic: string) {
  // auto-respond
  wallet.on(CLIENT_EVENTS.session.request, async (requestEvent: RequestEvent) => {
    chai.expect(requestEvent.request.method).to.eql(TEST_JSONRPC_METHOD);
    await wallet.respond({
      topic: requestEvent.topic,
      response: formatJsonRpcResult(requestEvent.request.id, TEST_JSONRPC_RESULT),
    });
  });
  //request
  const result = await provider.request(TEST_JSONRPC_REQUEST);
  return result;
}

describe("@walletconnect/signer-connection", () => {
  it("should connect and request", async () => {
    const { provider, wallet } = await setup();
    const topic = await testConnect(provider, wallet);
    chai.expect(!!topic).to.be.true;
    const result = await testRequest(provider, wallet, topic);
    chai.expect(result).to.eql(TEST_JSONRPC_RESULT);
  });
});
