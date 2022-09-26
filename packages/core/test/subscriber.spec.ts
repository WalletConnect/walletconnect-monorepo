import { expect, describe, it, beforeEach, afterEach } from "vitest";
import pino from "pino";
import Sinon from "sinon";
import { getDefaultLoggerOptions } from "@walletconnect/logger";
import { ICore, IRelayer, ISubscriber } from "@walletconnect/types";
import { generateRandomBytes32, getRelayProtocolName } from "@walletconnect/utils";

import {
  Core,
  CORE_DEFAULT,
  CORE_STORAGE_PREFIX,
  MESSAGES_STORAGE_VERSION,
  RELAYER_PROVIDER_EVENTS,
  Subscriber,
  SUBSCRIBER_CONTEXT,
} from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS } from "./shared";

describe("Subscriber", () => {
  const logger = pino(getDefaultLoggerOptions({ level: CORE_DEFAULT.logger }));
  let core: ICore;

  beforeEach(async () => {
    if (core) {
      await disconnectSocket(core.relayer);
    }

    core = new Core(TEST_CORE_OPTIONS);
    await core.start();

    core.relayer.subscriber.relayer.provider.request = () => Promise.resolve({} as any);
    await core.relayer.subscriber.init();
  });

  it("provides the expected `storageKey` format", () => {
    const subscriber = new Subscriber(core.relayer, logger);
    expect(subscriber.storageKey).to.equal(
      CORE_STORAGE_PREFIX + MESSAGES_STORAGE_VERSION + "//" + SUBSCRIBER_CONTEXT,
    );
  });

  describe("init", () => {
    it("registers event listeners", async () => {
      const topic = generateRandomBytes32();
      const emitSpy = Sinon.spy();
      core.relayer.subscriber.events.emit = emitSpy;
      // subscribe to a topic
      await core.relayer.subscriber.subscribe(topic);
      expect(core.relayer.subscriber.subscriptions.size).to.equal(1);
      expect(core.relayer.subscriber.topics.length).to.equal(1);
      // relayer.provider emits a `disconnect` event -> should clear both subscriptions and topics.
      core.relayer.provider.events.emit(RELAYER_PROVIDER_EVENTS.disconnect);
      expect(core.relayer.subscriber.subscriptions.size).to.equal(0);
      expect(core.relayer.subscriber.topics.length).to.equal(0);
    });
  });

  describe("subscribe", () => {
    let topic: string;
    let requestSpy: Sinon.SinonSpy;

    beforeEach(() => {
      requestSpy = Sinon.spy(() => "test-id");
      topic = generateRandomBytes32();
      core.relayer.subscriber.relayer.provider.request = requestSpy;
    });

    it("throws if Subscriber was not initialized", async () => {
      const subscriber = new Subscriber(core.relayer, logger);
      await expect(subscriber.subscribe(topic)).rejects.toThrow("Not initialized. subscription");
    });
    it("calls `provider.request` with the expected request shape", async () => {
      await core.relayer.subscriber.subscribe(topic);
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
      const id = await core.relayer.subscriber.subscribe(topic);
      expect(id).to.equal("test-id");
    });
  });

  describe("unsubscribe", () => {
    let topic: string;
    let requestSpy: Sinon.SinonSpy;
    let messageDeleteSpy: Sinon.SinonSpy;

    beforeEach(() => {
      requestSpy = Sinon.spy();
      messageDeleteSpy = Sinon.spy();
      topic = generateRandomBytes32();
      core.relayer.subscriber.relayer.provider.request = requestSpy;
      core.relayer.subscriber.relayer.messages.del = messageDeleteSpy;
    });
    it("throws if Subscriber was not initialized", async () => {
      const subscriber = new Subscriber(core.relayer, logger);
      await expect(subscriber.unsubscribe(topic)).rejects.toThrow("Not initialized. subscription");
    });
    it("unsubscribes by individual id if `opts.id` is provided", async () => {
      const id = "test-id";
      await core.relayer.subscriber.unsubscribe(topic, { id, relay: getRelayProtocolName() });
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
      await core.relayer.subscriber.subscribe(topic);
      expect(core.relayer.subscriber.topics.length).to.equal(1);
      await core.relayer.subscriber.unsubscribe(topic);
      expect(core.relayer.subscriber.topics.length).to.equal(0);
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
});
