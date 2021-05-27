import "mocha";
import { expect } from "chai";
import JsonRpcProvider from "@json-rpc-tools/provider";
import WsConnection from "@json-rpc-tools/ws-connection";
import { RELAY_JSONRPC } from "relay-provider";

import { TEST_RELAY_URL, getTestJsonRpc, Counter } from "./shared";
import { JsonRpcPayload } from "@json-rpc-tools/types";
import { formatJsonRpcResult } from "@json-rpc-tools/utils";
import { generateRandomBytes32 } from "../src/utils";

describe("JSON-RPC", () => {
  it("A can publish to B subscribed to same topic", async () => {
    const { pub, sub } = getTestJsonRpc();

    const providerA = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerA.connect();
    const providerB = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerB.connect();

    let subscriptionB: string;

    const counterB = new Counter();

    await Promise.all([
      new Promise<void>(async resolve => {
        // subscribing to topics
        subscriptionB = await providerB.request(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        // publishing to topics
        providerA.request(pub);
        resolve();
      }),
      new Promise<void>(resolve => {
        // acknowledging received payloads
        providerB.on("payload", (payload: JsonRpcPayload) => {
          const response = formatJsonRpcResult(payload.id, true);
          providerB.connection.send(response);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        // evaluating incoming subscriptions
        providerB.on("message", ({ type, data }) => {
          counterB.tick();
          expect(type).to.eql(RELAY_JSONRPC.waku.subscription);
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

    const providerA = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerA.connect();
    const providerB = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerB.connect();
    const providerC = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerC.connect();

    let subscriptionB: string;
    let subscriptionC: string;

    const counterB = new Counter();
    const counterC = new Counter();

    await Promise.all([
      new Promise<void>(async resolve => {
        // subscribing to topics
        subscriptionB = await providerB.request(sub);
        resolve();
      }),
      new Promise<void>(async resolve => {
        // subscribing to topics
        subscriptionC = await providerC.request(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        // publishing to topics
        providerA.request(pub);
        resolve();
      }),
      new Promise<void>(resolve => {
        // acknowledging received payloads
        providerB.on("payload", (payload: JsonRpcPayload) => {
          const response = formatJsonRpcResult(payload.id, true);
          providerB.connection.send(response);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        // evaluating incoming subscriptions
        providerB.on("message", ({ type, data }) => {
          counterB.tick();
          expect(type).to.eql(RELAY_JSONRPC.waku.subscription);
          if (subscriptionB) expect(data.id).to.eql(subscriptionB);
          expect(data.data.topic).to.eql(pub.params.topic);
          expect(data.data.message).to.eql(pub.params.message);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        // acknowledging received payloads
        providerC.on("payload", (payload: JsonRpcPayload) => {
          const response = formatJsonRpcResult(payload.id, true);
          providerC.connection.send(response);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        // evaluating incoming subscriptions
        providerC.on("message", ({ type, data }) => {
          counterC.tick();
          expect(type).to.eql(RELAY_JSONRPC.waku.subscription);
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

    const providerA = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerA.connect();

    // publishing to topics
    await providerA.request(pub);

    const providerB = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerB.connect();

    let subscriptionB: string;

    const counterB = new Counter();

    await Promise.all([
      new Promise<void>(async resolve => {
        // subscribing to topics
        subscriptionB = await providerB.request(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        // acknowledging received payloads
        providerB.on("payload", (payload: JsonRpcPayload) => {
          const response = formatJsonRpcResult(payload.id, true);
          providerB.connection.send(response);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        // evaluating incoming subscriptions
        providerB.on("message", ({ type, data }) => {
          counterB.tick();
          expect(type).to.eql(RELAY_JSONRPC.waku.subscription);
          if (subscriptionB) expect(data.id).to.eql(subscriptionB);
          expect(data.data.topic).to.eql(pub.params.topic);
          expect(data.data.message).to.eql(pub.params.message);
          resolve();
        });
      }),
    ]);

    expect(counterB.value).to.eql(1);

    const providerC = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerC.connect();

    let subscriptionC: string;

    const counterC = new Counter();

    await Promise.all([
      new Promise<void>(async resolve => {
        // subscribing to topics
        subscriptionC = await providerC.request(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        // acknowledging received payloads
        providerC.on("payload", (payload: JsonRpcPayload) => {
          const response = formatJsonRpcResult(payload.id, true);
          providerC.connection.send(response);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        // evaluating incoming subscriptions
        providerC.on("message", ({ type, data }) => {
          counterC.tick();
          expect(type).to.eql(RELAY_JSONRPC.waku.subscription);
          if (subscriptionC) expect(data.id).to.eql(subscriptionC);
          expect(data.data.topic).to.eql(pub.params.topic);
          expect(data.data.message).to.eql(pub.params.message);
          resolve();
        });
      }),
    ]);

    expect(counterC.value).to.eql(1);
  });
  it("A can publish to B through Provider A to Provider B", async function() {
    const { pub, sub } = getTestJsonRpc(generateRandomBytes32());

    const providerA = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerA.connect();
    const providerB = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerB.connect();

    let subscriptionB: string;

    const counterB = new Counter();

    await Promise.all([
      new Promise<void>(async resolve => {
        // subscribing to topics
        subscriptionB = await providerB.request(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        // publishing to topics
        providerA.request(pub);
        resolve();
      }),
      new Promise<void>(resolve => {
        // acknowledging received payloads
        providerB.on("payload", (payload: JsonRpcPayload) => {
          const response = formatJsonRpcResult(payload.id, true);
          providerB.connection.send(response);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        // evaluating incoming subscriptions
        providerB.on("message", ({ type, data }) => {
          counterB.tick();
          expect(type).to.eql(RELAY_JSONRPC.waku.subscription);
          if (subscriptionB) expect(data.id).to.eql(subscriptionB);
          expect(data.data.topic).to.eql(pub.params.topic);
          expect(data.data.message).to.eql(pub.params.message);
          resolve();
        });
      }),
    ]);

    expect(counterB.value).to.eql(1);
  });
  it("C can receive pending messages published on other providers while offline", async function() {
    this.timeout(5000);
    const { pub, sub } = getTestJsonRpc(generateRandomBytes32());
    const providerA = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerA.connect();
    await providerA.request(pub);
    const providerB = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
    await providerB.connect();
    let subscriptionB: string;
    const counterB = new Counter();
    await Promise.all([
      new Promise<void>(async resolve => {
        // subscribing to topics
        subscriptionB = await providerB.request(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        // acknowledging received payloads
        providerB.on("payload", (payload: JsonRpcPayload) => {
          const response = formatJsonRpcResult(payload.id, true);
          providerB.connection.send(response);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        // evaluating incoming subscriptions
        providerB.on("message", ({ type, data }) => {
          counterB.tick();
          expect(type).to.eql(RELAY_JSONRPC.waku.subscription);
          if (subscriptionB) expect(data.id).to.eql(subscriptionB);
          expect(data.data.topic).to.eql(pub.params.topic);
          expect(data.data.message).to.eql(pub.params.message);
          resolve();
        });
      }),
    ]);

    expect(counterB.value).to.eql(1);

    return new Promise(resolve => {
      setTimeout(async () => {
        const providerC = new JsonRpcProvider(new WsConnection(TEST_RELAY_URL));
        await providerC.connect();
        let subscriptionC: string;
        const counterC = new Counter();
        await Promise.all([
          new Promise<void>(async resolve => {
            subscriptionC = await providerC.request(sub);
            resolve();
          }),
          new Promise<void>(resolve => {
            providerC.on("payload", (payload: JsonRpcPayload) => {
              const response = formatJsonRpcResult(payload.id, true);
              providerC.connection.send(response);
              resolve();
            });
          }),
          new Promise<void>(resolve => {
            providerC.on("message", ({ type, data }) => {
              counterC.tick();
              expect(type).to.eql(RELAY_JSONRPC.waku.subscription);
              if (subscriptionC) expect(data.id).to.eql(subscriptionC);
              expect(data.data.topic).to.eql(pub.params.topic);
              expect(data.data.message).to.eql(pub.params.message);
              resolve();
            });
          }),
        ]);
        expect(counterC.value).to.eql(1);
        resolve();
      }, 500);
    });
  });
});
