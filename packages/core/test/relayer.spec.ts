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
  SUBSCRIBER_EVENTS,
} from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS } from "./shared";
import { ICore, IRelayer } from "@walletconnect/types";
import Sinon from "sinon";
import { JsonRpcRequest } from "@walletconnect/jsonrpc-utils";

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
});
