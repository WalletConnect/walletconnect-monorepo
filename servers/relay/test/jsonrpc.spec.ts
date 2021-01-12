import "mocha";
import { expect } from "chai";
import JsonRpcProvider from "@json-rpc-tools/provider";
import { RELAY_JSONRPC, RelayJsonRpc } from "relay-provider";
import { formatJsonRpcRequest } from "@json-rpc-tools/utils";

import { TEST_RELAY_URL, TEST_TOPIC, TEST_MESSAGE } from "./shared";

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

    let counter = 0;
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
          counter += 1;
          //eslint-disable-next-line
          // console.log("JSON-RPC", counter);
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

    let counter = 0;
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
          counter += 1;
          //eslint-disable-next-line
          // console.log("JSON-RPC", counter);
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

    let counter = 0;
    await Promise.all([
      new Promise<void>(async resolve => {
        subscriptionB = await providerB.request(TEST_SUB_REQUEST);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerB.on("message", ({ type, data }) => {
          counter += 1;
          //eslint-disable-next-line
          // console.log("JSON-RPC", counter);
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
