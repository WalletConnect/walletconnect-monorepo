import { expect, describe, it, beforeEach, afterEach } from "vitest";
import Sinon from "sinon";
import { ICore } from "@walletconnect/types";
import { generateRandomBytes32, hashMessage } from "@walletconnect/utils";
import { Publisher } from "../src/controllers/publisher";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";

import { Core, PUBLISHER_DEFAULT_TTL } from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS, throttle } from "./shared";

describe("Publisher", () => {
  let core: ICore;
  let publisher: Publisher;

  beforeEach(async () => {
    core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    publisher = core.relayer.publisher as Publisher;
  });

  afterEach(async () => {
    await disconnectSocket(core.relayer);
  });

  describe("init", () => {
    it("registers event listeners", async () => {
      const opts = { ttl: 1, prompt: true, relay: { protocol: "irn" }, tag: 0 };
      const itemA = { topic: generateRandomBytes32(), message: "itemA", opts };
      const itemB = { topic: generateRandomBytes32(), message: "itemB", opts };
      const requestSpy = Sinon.spy();
      publisher.relayer.request = requestSpy;
      // Manually set some items in the queue.
      publisher.queue.set(hashMessage(itemA.message), itemA);
      publisher.queue.set(hashMessage(itemB.message), itemB);
      expect(publisher.queue.size).to.equal(2);
      // Emit heartbeat pulse event
      publisher.relayer.core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);

      // Using a timeout here, cannot `await` the private `rpcSubscribe` method.
      await throttle(2_000);
      // -> Queue should clear if pulse event is being listened for.
      expect(publisher.queue.size).to.equal(0);
      expect(requestSpy.callCount).to.equal(2);
    });
  });

  describe("publish", () => {
    let topic: string;
    let requestSpy: Sinon.SinonSpy;

    beforeEach(() => {
      requestSpy = Sinon.spy();
      topic = generateRandomBytes32();
      publisher.relayer.request = requestSpy;
    });

    it("calls `provider.request` with the expected request shape", async () => {
      const message = "test message";
      await publisher.publish(topic, message);
      expect(requestSpy.callCount).to.equal(1);
      expect(requestSpy.getCall(0).args[0]).to.deep.equal({
        method: "irn_publish",
        params: {
          topic,
          message,
          prompt: false,
          ttl: PUBLISHER_DEFAULT_TTL,
          tag: 0,
        },
      });
    });
    it("allows overriding of defaults via `opts` param", async () => {
      const message = "test message";
      const opts = { ttl: 1, prompt: true, relay: { protocol: "irn" }, tag: 1 };
      await publisher.publish(topic, message, opts);
      expect(requestSpy.callCount).to.equal(1);
      expect(requestSpy.getCall(0).args[0]).to.deep.equal({
        method: "irn_publish",
        params: {
          topic,
          message,
          prompt: opts.prompt,
          ttl: opts.ttl,
          tag: opts.tag,
        },
      });
    });
  });
});
