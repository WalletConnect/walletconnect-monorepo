import "mocha";
import pino from "pino";
import Sinon from "sinon";
import { getDefaultLoggerOptions } from "@walletconnect/logger";
import { IRelayer } from "@walletconnect/types";
import { generateRandomBytes32, hashMessage } from "@walletconnect/utils";
import { Publisher } from "../src/controllers/publisher";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";

import { Core, CORE_DEFAULT, PUBLISHER_DEFAULT_TTL, Relayer } from "../src";
import { expect, TEST_CORE_OPTIONS } from "./shared";

describe("Publisher", () => {
  const logger = pino(getDefaultLoggerOptions({ level: CORE_DEFAULT.logger }));

  let relayer: IRelayer;
  let publisher: Publisher;

  beforeEach(() => {
    const core = new Core(TEST_CORE_OPTIONS);
    relayer = new Relayer({ core, logger });
    publisher = new Publisher(relayer, logger);
  });

  describe("init", () => {
    it("registers event listeners", () => {
      const opts = { ttl: 1, prompt: true, relay: { protocol: "waku" } };
      const itemA = { topic: generateRandomBytes32(), message: "itemA", opts };
      const itemB = { topic: generateRandomBytes32(), message: "itemB", opts };
      const requestSpy = Sinon.spy();
      publisher.relayer.provider.request = requestSpy;
      // Manually set some items in the queue.
      publisher.queue.set(hashMessage(itemA.message), itemA);
      publisher.queue.set(hashMessage(itemB.message), itemB);
      expect(publisher.queue.size).to.equal(2);
      // Emit heartbeat pulse event
      publisher.relayer.core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
      // Using a timeout here, cannot `await` the private `rpcSubscribe` method.
      setTimeout(() => {
        // -> Queue should clear if pulse event is being listened for.
        expect(publisher.queue.size).to.equal(0);
        expect(requestSpy.callCount).to.equal(2);
      }, 500);
    });
  });

  describe("publish", () => {
    let topic: string;
    let requestSpy: Sinon.SinonSpy;

    beforeEach(() => {
      requestSpy = Sinon.spy();
      topic = generateRandomBytes32();
      publisher.relayer.provider.request = requestSpy;
    });

    it("calls `provider.request` with the expected request shape", async () => {
      const message = "test message";
      await publisher.publish(topic, message);
      expect(requestSpy.callCount).to.equal(1);
      expect(requestSpy.getCall(0).args[0]).to.deep.equal({
        method: "waku_publish",
        params: {
          topic,
          message,
          prompt: false,
          ttl: PUBLISHER_DEFAULT_TTL,
        },
      });
    });
    it("allows overriding of defaults via `opts` param", async () => {
      const message = "test message";
      const opts = { ttl: 1, prompt: true, relay: { protocol: "waku" } };
      await publisher.publish(topic, message, opts);
      expect(requestSpy.callCount).to.equal(1);
      expect(requestSpy.getCall(0).args[0]).to.deep.equal({
        method: "waku_publish",
        params: {
          topic,
          message,
          prompt: opts.prompt,
          ttl: opts.ttl,
        },
      });
    });
  });
});
