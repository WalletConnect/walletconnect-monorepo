import "mocha";
import { expect } from "chai";
import JsonRpcProvider from "@json-rpc-tools/provider";
import { RequestArguments } from "@json-rpc-tools/types";
import { RELAY_JSONRPC, RelayJsonRpc } from "relay-provider";
import { formatJsonRpcRequest } from "@json-rpc-tools/utils";

// TODO: Relay Provider URL needs to be set from ops
export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://localhost:5555";

const TEST_TOPIC = "f5d3f03946b6a2a3b22661fae1385cd1639bfb6f6c070115699b0a2ec1decd8c";
const TEST_MESSAGE = "08ca02463e7c45383d43efaee4bbe33f700df0658e99726a755fd77f9a040988";

const TEST_PUB_REQUEST = formatJsonRpcRequest<RelayJsonRpc.PublishParams>(
  RELAY_JSONRPC.bridge.publish,
  {
    topic: TEST_TOPIC,
    message: TEST_MESSAGE,
    ttl: 86400,
  },
);

const TEST_SUB_REQUEST = formatJsonRpcRequest<RelayJsonRpc.SubscribeParams>(
  RELAY_JSONRPC.bridge.subscribe,
  {
    topic: TEST_TOPIC,
  },
);

describe("JSON-RPC", () => {
  it("A can publish to B subscribed to same topic", async () => {
    const providerA = new JsonRpcProvider(TEST_RELAY_URL);
    await providerA.connect();
    const providerB = new JsonRpcProvider(TEST_RELAY_URL);
    await providerB.connect();

    let subscriptionB: string;

    await Promise.all([
      new Promise<void>(async resolve => {
        subscriptionB = await providerB.request(TEST_SUB_REQUEST);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerA.request(TEST_PUB_REQUEST);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerB.on("message", ({ type, data }) => {
          expect(type).to.eql(RELAY_JSONRPC.bridge.subscription);
          if (subscriptionB) {
            expect(data.id).to.eql(subscriptionB);
          }
          expect(data.data.topic).to.eql(TEST_TOPIC);
          expect(data.data.message).to.eql(TEST_MESSAGE);
          resolve();
        });
      }),
    ]);
  });
  it("A can publish to B and C subscribed to same topic", async () => {
    const providerA = new JsonRpcProvider(TEST_RELAY_URL);
    await providerA.connect();
    const providerB = new JsonRpcProvider(TEST_RELAY_URL);
    await providerB.connect();
    const providerC = new JsonRpcProvider(TEST_RELAY_URL);
    await providerC.connect();

    let subscriptionB: string;
    let subscriptionC: string;

    await Promise.all([
      new Promise<void>(async resolve => {
        subscriptionB = await providerB.request(TEST_SUB_REQUEST);
        resolve();
      }),
      new Promise<void>(async resolve => {
        subscriptionC = await providerC.request(TEST_SUB_REQUEST);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerA.request(TEST_PUB_REQUEST);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerB.on("message", ({ type, data }) => {
          expect(type).to.eql(RELAY_JSONRPC.bridge.subscription);
          if (subscriptionB) {
            expect(data.id).to.eql(subscriptionB);
          }
          expect(data.data.topic).to.eql(TEST_TOPIC);
          expect(data.data.message).to.eql(TEST_MESSAGE);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        providerC.on("message", ({ type, data }) => {
          expect(type).to.eql(RELAY_JSONRPC.bridge.subscription);
          if (subscriptionC) {
            expect(data.id).to.eql(subscriptionC);
          }
          expect(data.data.topic).to.eql(TEST_TOPIC);
          expect(data.data.message).to.eql(TEST_MESSAGE);
          resolve();
        });
      }),
    ]);
  });
  it("B can receive pending messages published while offline", async () => {
    const providerA = new JsonRpcProvider(TEST_RELAY_URL);
    await providerA.connect();

    await providerA.request(TEST_PUB_REQUEST);

    const providerB = new JsonRpcProvider(TEST_RELAY_URL);
    await providerB.connect();

    let subscriptionB: string;

    await Promise.all([
      new Promise<void>(async resolve => {
        subscriptionB = await providerB.request(TEST_SUB_REQUEST);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerB.on("message", ({ type, data }) => {
          expect(type).to.eql(RELAY_JSONRPC.bridge.subscription);
          if (subscriptionB) {
            expect(data.id).to.eql(subscriptionB);
          }
          expect(data.data.topic).to.eql(TEST_TOPIC);
          expect(data.data.message).to.eql(TEST_MESSAGE);
          resolve();
        });
      }),
    ]);
  });
});
