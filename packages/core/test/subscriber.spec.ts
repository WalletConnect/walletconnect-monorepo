import { expect, describe, it, beforeEach, afterAll, afterEach } from "vitest";
import Sinon from "sinon";
import { getDefaultLoggerOptions, pino } from "@walletconnect/logger";
import { ICore, IRelayer, ISubscriber } from "@walletconnect/types";
import { generateRandomBytes32, getRelayProtocolName, hashMessage } from "@walletconnect/utils";

import {
  Core,
  CORE_DEFAULT,
  CORE_STORAGE_PREFIX,
  MESSAGES_STORAGE_VERSION,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  Subscriber,
  SUBSCRIBER_CONTEXT,
} from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS } from "./shared";

describe("Subscriber", () => {
  const logger = pino(getDefaultLoggerOptions({ level: CORE_DEFAULT.logger }));

  let relayer: IRelayer;
  let subscriber: ISubscriber;
  let core: ICore;

  beforeEach(async () => {
    core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    relayer = core.relayer;
    subscriber = relayer.subscriber;
    subscriber.relayer.provider.request = () => Promise.resolve({} as any);
  });

  afterEach(async () => {
    await disconnectSocket(core.relayer);
  });

  describe("init", () => {
    it.skip("should call batch fetch messages on init when it has cached topics", async () => {
      const requestSpy: Sinon.SinonSpy = Sinon.spy(() => {
        return Promise.resolve({} as any);
      });
      subscriber.relayer.provider.request = requestSpy;

      const topic = generateRandomBytes32();
      // manually switch off the subscriber
      // @ts-expect-error
      subscriber.onDisconnect();
      // add a topic to the subscriber as if it was loaded from persistence
      // @ts-expect-error
      subscriber.cached = [{ topic, relay: { protocol: "irn" } }];

      // restart the subscriber
      // @ts-expect-error
      subscriber.onConnect();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // first req should be the batch fetch messages call followed by the batch subscribe call
      expect(requestSpy.getCalls().length).toBe(2);
      expect(requestSpy.getCalls()[0].args[0].method).toBe("irn_batchFetchMessages");
      expect(requestSpy.getCalls()[1].args[0].method).toBe("irn_batchSubscribe");
      expect(
        requestSpy.calledWith(
          Sinon.match({
            method: "irn_batchFetchMessages",
            params: {
              topics: [topic],
            },
          }),
        ),
      ).to.be.true;

      expect(
        requestSpy.calledWith(
          Sinon.match({
            method: "irn_batchSubscribe",
            params: {
              topics: [topic],
            },
          }),
        ),
      ).to.be.true;
    });

    it("should keep cached subscriptions when onDisable is called multiple times", async () => {
      const topic = generateRandomBytes32();
      await subscriber.subscribe(topic);
      expect(subscriber.subscriptions.size).to.equal(1);
      expect(subscriber.topics.length).to.equal(1);
      subscriber.onDisable();
      expect(subscriber.cached.length).to.equal(1);
      expect(subscriber.cached[0].topic).to.equal(topic);
      subscriber.onDisable();
      expect(subscriber.cached.length).to.equal(1);
      subscriber.onDisable();
      expect(subscriber.cached.length).to.equal(1);
    });
  });

  describe("storageKey", () => {
    it("provides the expected default `storageKey` format", () => {
      const subscriber = new Subscriber(relayer, logger);
      expect(subscriber.storageKey).to.equal(
        CORE_STORAGE_PREFIX + MESSAGES_STORAGE_VERSION + "//" + SUBSCRIBER_CONTEXT,
      );
    });
    it("provides the expected custom `storageKey` format", () => {
      const core = new Core({ ...TEST_CORE_OPTIONS, customStoragePrefix: "test" });
      const subscriber = new Subscriber(core.relayer, logger);
      expect(subscriber.storageKey).to.equal(
        CORE_STORAGE_PREFIX + MESSAGES_STORAGE_VERSION + ":test" + "//" + SUBSCRIBER_CONTEXT,
      );
    });
  });

  describe("init", () => {
    it("registers event listeners", async () => {
      expect(subscriber.clientId).to.equal("");

      const topic = generateRandomBytes32();
      const emitSpy = Sinon.spy();
      subscriber.events.emit = emitSpy;
      // subscribe to a topic
      await subscriber.subscribe(topic);
      expect(subscriber.subscriptions.size).to.equal(1);
      expect(subscriber.topics.length).to.equal(1);
      // relayer.provider emits a `disconnect` event -> should clear both subscriptions and topics.
      relayer.provider.events.emit(RELAYER_PROVIDER_EVENTS.disconnect);
      expect(subscriber.subscriptions.size).to.equal(0);
      expect(subscriber.topics.length).to.equal(0);

      expect(subscriber.clientId).to.not.equal("");
    });

    it("should set hasAnyTopics", async () => {
      const topic = generateRandomBytes32();
      expect(subscriber.hasAnyTopics).toBe(false);
      subscriber.topicMap.set(topic, topic);
      expect(subscriber.hasAnyTopics).toBe(true);
      subscriber.topicMap.clear();
      expect(subscriber.hasAnyTopics).toBe(false);
      // @ts-expect-error - private property
      subscriber.cached = [{ topic }];
      expect(subscriber.hasAnyTopics).toBe(true);
      // @ts-expect-error - private property
      subscriber.cached = [];
      expect(subscriber.hasAnyTopics).toBe(false);
      subscriber.pending.set(topic, { topic });
      expect(subscriber.hasAnyTopics).toBe(true);
      subscriber.pending.clear();
      expect(subscriber.hasAnyTopics).toBe(false);
    });
  });

  describe("subscribe", () => {
    let topic: string;
    let requestSpy: Sinon.SinonSpy;

    beforeEach(async () => {
      await relayer.connect();
      requestSpy = Sinon.spy(() => Promise.resolve(["test-id"]));
      topic = generateRandomBytes32();
      subscriber.relayer.provider.request = requestSpy;
    });

    it("throws if Subscriber was not initialized", async () => {
      const subscriber = new Subscriber(relayer, logger);
      await expect(subscriber.subscribe(topic)).rejects.toThrow("Not initialized. subscription");
    });
    it("calls `provider.request` with the expected request shape", async () => {
      await subscriber.subscribe(topic);
      expect(
        requestSpy.calledOnceWith(
          Sinon.match({
            method: "irn_subscribe",
            params: {
              topic,
            },
          }),
        ),
      ).to.be.true;
    });
    it("returns the subscription id", async () => {
      const id = await subscriber.subscribe(topic);
      const expectedId = hashMessage(topic + (await core.crypto.getClientId()));
      expect(id).to.equal(expectedId);
    });
    it("should subscribe a topic immediately after connect", async () => {
      relayer.provider.events.emit(RELAYER_PROVIDER_EVENTS.disconnect);
      expect(subscriber.subscriptions.size).to.equal(0);
      expect(subscriber.topics.length).to.equal(0);
      relayer.provider.events.emit(RELAYER_PROVIDER_EVENTS.connect);
      await relayer.subscriber.subscribe(generateRandomBytes32());
      expect(subscriber.subscriptions.size).to.equal(1);
      expect(subscriber.topics.length).to.equal(1);
    });
  });

  describe("unsubscribe", () => {
    let topic: string;
    let requestSpy: Sinon.SinonSpy;
    let messageDeleteSpy: Sinon.SinonSpy;

    beforeEach(async () => {
      await relayer.connect();
      requestSpy = Sinon.spy(() => Promise.resolve(["test-id"]));
      messageDeleteSpy = Sinon.spy();
      topic = generateRandomBytes32();
      subscriber.relayer.provider.request = requestSpy;
      subscriber.relayer.messages.del = messageDeleteSpy;
    });
    it("throws if Subscriber was not initialized", async () => {
      const subscriber = new Subscriber(relayer, logger);
      await expect(subscriber.unsubscribe(topic)).rejects.toThrow("Not initialized. subscription");
    });
    it("unsubscribes by individual id if `opts.id` is provided", async () => {
      const id = "test-id";
      await subscriber.unsubscribe(topic, { id, relay: getRelayProtocolName() });
      expect(messageDeleteSpy.calledOnceWith(topic)).to.be.true;
      expect(
        requestSpy.calledOnceWith(
          Sinon.match({
            method: "irn_unsubscribe",
            params: {
              topic,
            },
          }),
        ),
      ).to.be.true;
    });
    it("unsubscribes by topic by default", async () => {
      await subscriber.subscribe(topic);
      expect(subscriber.topics.length).to.equal(1);
      await subscriber.unsubscribe(topic);
      expect(subscriber.topics.length).to.equal(0);
      expect(
        requestSpy.getCall(1).calledWith(
          Sinon.match({
            method: "irn_unsubscribe",
            params: {
              topic,
            },
          }),
        ),
      ).to.be.true;
    });
  });

  describe("batchSubscribe error handling", () => {
    let restartStub: Sinon.SinonStub;
    let requestStub: Sinon.SinonStub;

    beforeEach(() => {
      restartStub = Sinon.stub(relayer, "restartTransport").resolves();
      requestStub = Sinon.stub(relayer, "request");
    });

    afterEach(async () => {
      await relayer.transportClose();
      restartStub.restore();
      requestStub.restore();
    });

    it("should not mark topics as subscribed when batch subscribe RPC fails", async () => {
      // #given
      requestStub.rejects(new Error("relay error"));
      const topic = generateRandomBytes32();

      // @ts-expect-error - private property
      subscriber.cached = [{ topic, relay: { protocol: "irn" } }];

      // #when - simulate reconnect which triggers batchSubscribe via onRestart
      // @ts-expect-error - private method
      await subscriber.onRestart();

      // #then - batch subscribe RPC was attempted with the correct topic
      expect(requestStub.calledOnce).to.equal(true);
      expect(
        requestStub.calledWith(
          Sinon.match({ method: "irn_batchSubscribe", params: { topics: [topic] } }),
        ),
      ).to.equal(true);
      // topics should NOT be in subscriptions/topicMap
      expect(subscriber.subscriptions.size).to.equal(0);
      expect(subscriber.topics.length).to.equal(0);
      expect(await subscriber.isSubscribed(topic)).to.equal(false);
    });

    it("should add failed batch topics to pending for retry", async () => {
      // #given
      requestStub.rejects(new Error("relay error"));
      const topic = generateRandomBytes32();

      // @ts-expect-error - private property
      subscriber.cached = [{ topic, relay: { protocol: "irn" } }];

      // #when
      // @ts-expect-error - private method
      await subscriber.onRestart();

      // #then - batch subscribe RPC was attempted
      expect(requestStub.calledOnce).to.equal(true);
      expect(
        requestStub.calledWith(
          Sinon.match({ method: "irn_batchSubscribe", params: { topics: [topic] } }),
        ),
      ).to.equal(true);
      // topics should be in pending for retry on next heartbeat
      expect(subscriber.pending.has(topic)).to.equal(true);
    });

    it("should emit connection_stalled when batch subscribe fails", async () => {
      // #given
      requestStub.rejects(new Error("relay error"));
      const topic = generateRandomBytes32();
      const stalledSpy = Sinon.spy();
      relayer.events.on(RELAYER_EVENTS.connection_stalled, stalledSpy);

      // @ts-expect-error - private property
      subscriber.cached = [{ topic, relay: { protocol: "irn" } }];

      // #when
      // @ts-expect-error - private method
      await subscriber.onRestart();

      // #then - batch subscribe RPC was attempted
      expect(requestStub.calledOnce).to.equal(true);
      expect(
        requestStub.calledWith(
          Sinon.match({ method: "irn_batchSubscribe", params: { topics: [topic] } }),
        ),
      ).to.equal(true);
      expect(stalledSpy.calledOnce).to.equal(true);
    });

    it("should register subscriptions when batch subscribe succeeds", async () => {
      // #given
      requestStub.resolves({});
      const topic = generateRandomBytes32();

      // @ts-expect-error - private property
      subscriber.cached = [{ topic, relay: { protocol: "irn" } }];

      // #when
      // @ts-expect-error - private method
      await subscriber.onRestart();

      // #then - batch subscribe RPC was attempted
      expect(requestStub.calledOnce).to.equal(true);
      expect(
        requestStub.calledWith(
          Sinon.match({ method: "irn_batchSubscribe", params: { topics: [topic] } }),
        ),
      ).to.equal(true);
      // topics should be in subscriptions/topicMap
      expect(subscriber.subscriptions.size).to.equal(1);
      expect(subscriber.topics.length).to.equal(1);
      expect(await subscriber.isSubscribed(topic)).to.equal(true);
      expect(subscriber.pending.has(topic)).to.equal(false);
    });
  });
});
