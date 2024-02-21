import { RELAYER_FAILOVER_RELAY_URL } from "./../src/constants/relayer";
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { getDefaultLoggerOptions, pino } from "@walletconnect/logger";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";

import {
  Core,
  CORE_DEFAULT,
  Relayer,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  RELAYER_SUBSCRIBER_SUFFIX,
  RELAYER_TRANSPORT_CUTOFF,
  SUBSCRIBER_EVENTS,
} from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS, throttle } from "./shared";
import { ICore, IRelayer, ISubscriber } from "@walletconnect/types";
import Sinon from "sinon";
import { JsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import { generateRandomBytes32, hashMessage } from "@walletconnect/utils";

describe("Relayer", () => {
  const logger = pino(getDefaultLoggerOptions({ level: CORE_DEFAULT.logger }));

  let core: ICore;
  let relayer: IRelayer;

  beforeEach(async () => {
    core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    relayer = core.relayer;
  });

  afterEach(async () => {
    await disconnectSocket(core.relayer);
  });

  describe("init", () => {
    let initSpy: Sinon.SinonSpy;
    beforeEach(() => {
      initSpy = Sinon.spy();
      relayer = new Relayer({
        core,
        logger,
        relayUrl: TEST_CORE_OPTIONS.relayUrl,
        projectId: TEST_CORE_OPTIONS.projectId,
      });
    });

    afterEach(async () => {
      await disconnectSocket(relayer);
    });

    it("initializes a MessageTracker", async () => {
      relayer.messages.init = initSpy;
      await relayer.init();
      expect(initSpy.calledOnce).to.be.true;
    });
    it("initializes a Subscriber", async () => {
      relayer.subscriber.init = initSpy;
      await relayer.init();
      expect(initSpy.calledOnce).to.be.true;
    });
    it("initializes a Publisher", async () => {
      relayer.subscriber.init = initSpy;
      await relayer.init();
      expect(initSpy.calledOnce).to.be.true;
    });
    it("initializes a JsonRpcProvider", async () => {
      expect(relayer.provider).to.be.empty;
      await relayer.init();
      expect(relayer.provider).not.to.be.empty;
      expect(relayer.provider instanceof JsonRpcProvider).to.be.true;
    });
    it("registers event listeners", async () => {
      const emitSpy = Sinon.spy();
      await relayer.init();
      relayer.events.emit = emitSpy;
      relayer.provider.events.emit(RELAYER_PROVIDER_EVENTS.connect);
      expect(emitSpy.calledOnceWith(RELAYER_EVENTS.connect)).to.be.true;
    });
  });

  describe("publish", () => {
    let relayer;
    beforeEach(async () => {
      relayer = new Relayer({
        core,
        logger,
        relayUrl: TEST_CORE_OPTIONS.relayUrl,
        projectId: TEST_CORE_OPTIONS.projectId,
      });
      await relayer.init();
    });
    afterEach(async () => {
      await disconnectSocket(relayer);
    });

    const topic = "abc123";
    const message = "publish me";
    it("calls `publisher.publish` with provided args", async () => {
      const spy = Sinon.spy();
      relayer.publisher.publish = spy;
      await relayer.publish(topic, message);
      expect(spy.calledOnceWith(topic, message)).to.be.true;
    });
    it("records a message with provided args", async () => {
      const spy = Sinon.spy();
      relayer.publisher.publish = () => Promise.resolve();
      relayer.messages.set = spy;
      await relayer.publish(topic, message);
      expect(spy.calledOnceWith(topic, message)).to.be.true;
    });
  });

  describe("subscribe", () => {
    let relayer;
    beforeEach(async () => {
      relayer = new Relayer({
        core,
        logger,
        relayUrl: TEST_CORE_OPTIONS.relayUrl,
        projectId: TEST_CORE_OPTIONS.projectId,
      });
      await relayer.init();
    });
    afterEach(async () => {
      await disconnectSocket(relayer);
    });

    it("returns the id provided by calling `subscriber.subscribe` with the passed topic", async () => {
      const spy = Sinon.spy(() => "mock-id");
      relayer.subscriber.subscribe = spy;
      let id;
      await Promise.all([
        new Promise<void>(async (resolve) => {
          id = await relayer.subscribe("abc123");
          resolve();
        }),
        new Promise<void>((resolve) => {
          relayer.subscriber.events.emit(SUBSCRIBER_EVENTS.created, { topic: "abc123" });
          resolve();
        }),
      ]);
      // @ts-expect-error
      expect(spy.calledOnceWith("abc123")).to.be.true;
      expect(id).to.eq("mock-id");
    });

    it("should subscribe multiple topics", async () => {
      const spy = Sinon.spy(() => "mock-id");
      relayer.subscriber.subscribe = spy;
      const subscriber = relayer.subscriber as ISubscriber;
      // record the number of listeners before subscribing
      const startNumListeners = subscriber.events.listenerCount(SUBSCRIBER_EVENTS.created);
      const topicsToSubscribe = Array.from(Array(5).keys()).map(() => generateRandomBytes32());
      const subscribePromises = topicsToSubscribe.map((topic) => relayer.subscribe(topic));
      const onSubscriptionCreatedPromises = topicsToSubscribe.map((topic) =>
        relayer.subscriber.events.emit(SUBSCRIBER_EVENTS.created, { topic }),
      );
      await Promise.all([...subscribePromises, ...onSubscriptionCreatedPromises]);
      // expect the number of listeners to be the same as before subscribing to confirm proper cleanup
      expect(subscriber.events.listenerCount(SUBSCRIBER_EVENTS.created)).to.eq(startNumListeners);
    });

    it("should be able to resubscribe on topic that already exists", async () => {
      const topic = generateRandomBytes32();
      const id = await relayer.subscribe(topic);
      const expectedId = hashMessage(topic + (await core.crypto.getClientId()));
      const a = await relayer.subscribe(topic);
      const b = await relayer.subscribe(topic);
      const c = await relayer.subscribe(topic);
      expect(a).to.equal(id);
      expect(a).to.equal(b);
      expect(b).to.equal(c);
      expect(a).to.equal(expectedId);
      expect(b).to.equal(expectedId);
      expect(c).to.equal(expectedId);
      expect(id).to.equal(expectedId);
    });
  });

  describe("unsubscribe", () => {
    let relayer;
    beforeEach(async () => {
      relayer = new Relayer({
        core,
        logger,
        relayUrl: TEST_CORE_OPTIONS.relayUrl,
        projectId: TEST_CORE_OPTIONS.projectId,
      });
      await relayer.init();
    });
    afterEach(async () => {
      await disconnectSocket(relayer);
    });
    it("calls `subscriber.unsubscribe` with the passed topic", async () => {
      const spy = Sinon.spy();
      relayer.subscriber.unsubscribe = spy;
      await relayer.unsubscribe("abc123");
      expect(spy.calledOnceWith("abc123")).to.be.true;
    });

    describe("onProviderPayload", () => {
      let relayer;
      beforeEach(async () => {
        relayer = new Relayer({
          core,
          logger,
          relayUrl: TEST_CORE_OPTIONS.relayUrl,
          projectId: TEST_CORE_OPTIONS.projectId,
        });
        await relayer.init();
      });
      afterEach(async () => {
        await disconnectSocket(relayer);
      });

      const validPayload: JsonRpcRequest = {
        id: 123,
        jsonrpc: "2.0",
        method: "mock" + RELAYER_SUBSCRIBER_SUFFIX,
        params: {
          id: "abc123",
          data: { topic: "ababab", message: "deadbeef", publishedAt: 1677151760537 },
        },
      };

      it("does nothing if payload is not a valid JsonRpcRequest", () => {
        const spy = Sinon.spy();
        relayer.events.emit = spy;
        relayer.provider.events.emit(RELAYER_PROVIDER_EVENTS.payload, {});
        expect(spy.notCalled).to.be.true;
      });
      it(`does nothing if payload.method does not have the ${RELAYER_SUBSCRIBER_SUFFIX} suffix`, () => {
        const spy = Sinon.spy();
        relayer.events.emit = spy;
        relayer.provider.events.emit(RELAYER_PROVIDER_EVENTS.payload, {
          ...validPayload,
          method: "mock",
        });
        expect(spy.notCalled).to.be.true;
      });
      it("emits an event based on `payload.params.id`", () => {
        const spy = Sinon.spy();
        relayer.events.emit = spy;
        relayer.provider.events.emit(RELAYER_PROVIDER_EVENTS.payload, validPayload);
        expect(
          spy.calledOnceWith(validPayload.params.id, {
            topic: validPayload.params.data.topic,
            message: validPayload.params.data.message,
            publishedAt: validPayload.params.data.publishedAt,
          }),
        ).to.be.true;
      });
    });
    describe("transport", () => {
      let relayer: IRelayer;
      beforeEach(async () => {
        relayer = new Relayer({
          core,
          relayUrl: TEST_CORE_OPTIONS.relayUrl,
          projectId: TEST_CORE_OPTIONS.projectId,
        });
        await relayer.init();
      });

      afterEach(async () => {
        await disconnectSocket(relayer);
      });

      it("should restart transport after connection drop", async () => {
        await relayer.provider.connection.close();
        expect(relayer.connected).to.be.false;
        await relayer.restartTransport();
        expect(relayer.connected).to.be.true;
      });

      it("should close transport 10 seconds after init if NOT active", async () => {
        relayer = new Relayer({
          core,
          relayUrl: TEST_CORE_OPTIONS.relayUrl,
          projectId: TEST_CORE_OPTIONS.projectId,
        });
        await relayer.init();
        await throttle(RELAYER_TRANSPORT_CUTOFF + 1_000); // +1 sec buffer
        expect(relayer.connected).to.be.false;
      });

      it("should NOT close transport 10 seconds after init if active", async () => {
        relayer = new Relayer({
          core,
          relayUrl: TEST_CORE_OPTIONS.relayUrl,
          projectId: TEST_CORE_OPTIONS.projectId,
        });
        await relayer.init();
        const topic = generateRandomBytes32();
        await relayer.subscriber.subscribe(topic);
        await throttle(RELAYER_TRANSPORT_CUTOFF + 1_000); // +1 sec buffer
        expect(relayer.connected).to.be.true;
      });
      it(`should fall back to ${RELAYER_FAILOVER_RELAY_URL} if the default relayUrl is not reachable`, async () => {
        relayer = new Relayer({
          core,
          relayUrl: "wss://relay.blocked.not.real",
          projectId: TEST_CORE_OPTIONS.projectId,
        });
        await relayer.init();
        const wsConnection = relayer.provider.connection as unknown as WebSocket;
        expect(relayer.connected).to.be.true;
        expect(wsConnection.url.startsWith(RELAYER_FAILOVER_RELAY_URL)).to.be.true;
      });
    });
  });
});
