import "mocha";
import sinon from "sinon";

import { ONE_SECOND, toMiliseconds } from "@walletconnect/time";
import { generateRandomBytes32 } from "@walletconnect/utils";

import { Client, RELAYER_EVENTS, SUBSCRIBER_EVENTS } from "../src";

import {
  expect,
  testApproveSession,
  setupClientsForTesting,
  TEST_TIMEOUT_DURATION,
  MockWakuRelayer,
  TEST_RELAY_URL,
  TEST_CLIENT_OPTIONS,
  TEST_PROJECT_ID,
} from "./shared";
import { formatJsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import { RelayerTypes } from "@walletconnect/types";

describe("Relayer", function() {
  const waku = new MockWakuRelayer(TEST_RELAY_URL + `/?projectId=${TEST_PROJECT_ID}`);
  this.timeout(TEST_TIMEOUT_DURATION);
  before(async () => {
    await waku.init();
  });
  it("can subscribe topic successfully", async () => {
    // topic
    const topic = generateRandomBytes32();
    // payload
    const request = formatJsonRpcRequest("test_method", []);
    // setup
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    // subscribe
    const id = await client.relayer.subscribe(topic);
    expect(id).to.not.be.undefined;
    expect(client.relayer.subscriber.ids).to.eql([id]);
    expect(client.relayer.subscriber.topics).to.eql([topic]);
    expect(client.relayer.subscriber.topicMap.get(topic)).to.eql([id]);
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        // listener
        client.relayer.on(RELAYER_EVENTS.payload, (payloadEvent: RelayerTypes.PayloadEvent) => {
          try {
            expect(payloadEvent.topic).to.eql(topic);
            expect(payloadEvent.payload).to.eql(request);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }),
      // publish
      waku.publish(topic, request),
    ]);
    // history
    const record = await client.relayer.history.get(topic, request.id);
    expect(record.topic).to.eql(topic);
    expect(record.id).to.eql(request.id);
    expect(record.chainId).to.be.undefined;
    expect(record.request.method).to.eql(request.method);
    expect(record.request.params).to.eql(request.params);
    // unsubscribe
    await client.relayer.unsubscribe(topic);
    expect(client.relayer.subscriber.ids).to.eql([]);
    expect(client.relayer.subscriber.topics).to.eql([]);
    expect(client.relayer.subscriber.topicMap.get(topic)).to.eql([]);
  });
  it("can publish payload successfully", async () => {
    // topic
    const topic = generateRandomBytes32();
    // payload
    const request = formatJsonRpcRequest("test_method", []);
    // setup
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    await Promise.all([
      // subscribe
      waku.subscribe(topic),
      new Promise<void>((resolve, reject) => {
        // listener
        waku.on(RELAYER_EVENTS.payload, (payloadEvent: RelayerTypes.PayloadEvent) => {
          try {
            expect(payloadEvent.topic).to.eql(topic);
            expect(payloadEvent.payload).to.eql(request);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }),
      // publish
      client.relayer.publish(topic, request),
    ]);
    // history
    const record = await client.relayer.history.get(topic, request.id);
    expect(record.topic).to.eql(topic);
    expect(record.id).to.eql(request.id);
    expect(record.chainId).to.be.undefined;
    expect(record.request.method).to.eql(request.method);
    expect(record.request.params).to.eql(request.params);
  });
  it("A pings B after A socket reconnects", async () => {
    // setup
    const { setup, clients } = await setupClientsForTesting();
    // connect
    const topic = await testApproveSession(setup, clients);
    // ping
    await clients.a.session.ping(topic, TEST_TIMEOUT_DURATION);
    // disconnect
    await clients.a.relayer.provider.connection.close();
    expect(clients.a.relayer.connected).to.be.false;
    // ping
    await clients.a.session.ping(topic, TEST_TIMEOUT_DURATION);
  });
  it("A pings B after B socket reconnects", async () => {
    // setup
    const { setup, clients } = await setupClientsForTesting();
    // connect
    const topic = await testApproveSession(setup, clients);
    // ping
    await clients.a.session.ping(topic, TEST_TIMEOUT_DURATION);
    // disconnect
    await clients.b.relayer.provider.connection.close();
    expect(clients.b.relayer.connected).to.be.false;
    // ping
    await clients.a.session.ping(topic, TEST_TIMEOUT_DURATION);
  });
});

describe("Relayer (with timeout)", function() {
  this.timeout(TEST_TIMEOUT_DURATION);
  let clock: sinon.SinonFakeTimers;
  beforeEach(function() {
    clock = sinon.useFakeTimers(Date.now());
  });
  afterEach(function() {
    clock.restore();
  });
  it("can reconnect and resubscribe after one second", async () => {
    // topic
    const topic = generateRandomBytes32();
    // setup
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    // subscribe
    const id = await client.relayer.subscribe(topic);
    expect(id).to.not.be.undefined;
    expect(client.relayer.subscriber.ids).to.eql([id]);
    expect(client.relayer.subscriber.topics).to.eql([topic]);
    expect(client.relayer.subscriber.topicMap.get(topic)).to.eql([id]);
    // disconnect
    await client.relayer.provider.connection.close();
    expect(client.relayer.subscriber.ids).to.eql([]);
    expect(client.relayer.subscriber.topics).to.eql([]);
    expect(client.relayer.subscriber.topicMap.get(topic)).to.eql([]);
    clock.tick(toMiliseconds(ONE_SECOND));
    await new Promise<void>((resolve, reject) => {
      client.relayer.subscriber.on(SUBSCRIBER_EVENTS.enabled, () => {
        try {
          expect(client.relayer.subscriber.ids.length).to.eql(1);
          expect(client.relayer.subscriber.topics).to.eql([topic]);
          expect(client.relayer.subscriber.topicMap.get(topic).length).to.eql(1);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  });
});
