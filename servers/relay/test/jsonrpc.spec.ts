import "mocha";
import { expect } from "chai";
import JsonRpcProvider from "@json-rpc-tools/provider";
import { RELAY_JSONRPC } from "relay-provider";

import { TEST_RELAY_URL, getTestJsonRpc, Counter } from "./shared";

describe("JSON-RPC", () => {
  it("A can publish to B subscribed to same topic", async () => {
    const { pub, sub } = getTestJsonRpc();

    const providerA = new JsonRpcProvider(TEST_RELAY_URL);
    await providerA.connect();
    const providerB = new JsonRpcProvider(TEST_RELAY_URL);
    await providerB.connect();

    let subscriptionB: string;

    const counterB = new Counter();

    await Promise.all([
      new Promise<void>(async resolve => {
        subscriptionB = await providerB.request(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerA.request(pub);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerB.on("message", ({ type, data }) => {
          counterB.add();
          expect(type).to.eql(RELAY_JSONRPC.bridge.subscription);
          if (subscriptionB) expect(data.id).to.eql(subscriptionB);
          expect(data.data.topic).to.eql(pub.params.topic);
          expect(data.data.message).to.eql(pub.params.message);
          resolve();
        });
      }),
    ]);

    expect(counterB.value).to.eql(1);
  });
  it("A can publish to B and C subscribed to same topic", async () => {
    const { pub, sub } = getTestJsonRpc();

    const providerA = new JsonRpcProvider(TEST_RELAY_URL);
    await providerA.connect();
    const providerB = new JsonRpcProvider(TEST_RELAY_URL);
    await providerB.connect();
    const providerC = new JsonRpcProvider(TEST_RELAY_URL);
    await providerC.connect();

    let subscriptionB: string;
    let subscriptionC: string;

    const counterB = new Counter();
    const counterC = new Counter();

    await Promise.all([
      new Promise<void>(async resolve => {
        subscriptionB = await providerB.request(sub);
        resolve();
      }),
      new Promise<void>(async resolve => {
        subscriptionC = await providerC.request(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerA.request(pub);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerB.on("message", ({ type, data }) => {
          counterB.add();
          expect(type).to.eql(RELAY_JSONRPC.bridge.subscription);
          if (subscriptionB) expect(data.id).to.eql(subscriptionB);
          expect(data.data.topic).to.eql(pub.params.topic);
          expect(data.data.message).to.eql(pub.params.message);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        providerC.on("message", ({ type, data }) => {
          counterC.add();
          expect(type).to.eql(RELAY_JSONRPC.bridge.subscription);
          if (subscriptionC) expect(data.id).to.eql(subscriptionC);
          expect(data.data.topic).to.eql(pub.params.topic);
          expect(data.data.message).to.eql(pub.params.message);
          resolve();
        });
      }),
    ]);
    expect(counterB.value).to.eql(1);
    expect(counterC.value).to.eql(1);
  });
  it("B can receive pending messages published while offline", async () => {
    const { pub, sub } = getTestJsonRpc();

    const providerA = new JsonRpcProvider(TEST_RELAY_URL);
    await providerA.connect();

    await providerA.request(pub);

    const providerB = new JsonRpcProvider(TEST_RELAY_URL);
    await providerB.connect();

    let subscriptionB: string;

    const counterB = new Counter();

    await Promise.all([
      new Promise<void>(async resolve => {
        subscriptionB = await providerB.request(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerB.on("message", ({ type, data }) => {
          counterB.add();
          expect(type).to.eql(RELAY_JSONRPC.bridge.subscription);
          if (subscriptionB) expect(data.id).to.eql(subscriptionB);
          expect(data.data.topic).to.eql(pub.params.topic);
          expect(data.data.message).to.eql(pub.params.message);
          resolve();
        });
      }),
    ]);

    expect(counterB.value).to.eql(1);

    const providerC = new JsonRpcProvider(TEST_RELAY_URL);
    await providerC.connect();

    let subscriptionC: string;

    const counterC = new Counter();

    await Promise.all([
      new Promise<void>(async resolve => {
        subscriptionC = await providerC.request(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        providerC.on("message", ({ type, data }) => {
          counterC.add();
          expect(type).to.eql(RELAY_JSONRPC.bridge.subscription);
          if (subscriptionC) expect(data.id).to.eql(subscriptionC);
          expect(data.data.topic).to.eql(pub.params.topic);
          expect(data.data.message).to.eql(pub.params.message);
          resolve();
        });
      }),
    ]);

    expect(counterC.value).to.eql(1);
  });
});
