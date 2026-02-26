import { expect, describe, it, beforeEach, afterEach } from "vitest";
import Sinon from "sinon";
import { ICore } from "@walletconnect/types";
import { generateRandomBytes32, hashMessage } from "@walletconnect/utils";
import { Publisher } from "../src/controllers/publisher";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";

import { Core, PUBLISHER_DEFAULT_TTL, RELAYER_EVENTS } from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS, throttle } from "./shared";
import { getBigIntRpcId } from "@walletconnect/jsonrpc-utils";

const getId = () => {
  return getBigIntRpcId().toString() as any;
};

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
    it("should process queue", async () => {
      const opts = { ttl: 1, prompt: true, relay: { protocol: "irn" }, tag: 0 };
      const items = [
        {
          request: {
            method: "irn_publish",
            params: {
              topic: generateRandomBytes32(),
              message: "itemA",
            },
          },
          opts: { ...opts, id: getId() },
          attempt: 1,
        },
        {
          request: {
            method: "irn_publish",
            params: {
              topic: generateRandomBytes32(),
              message: "itemB",
            },
          },
          opts: { ...opts, id: getId() },
          attempt: 1,
        },
        {
          request: {
            method: "irn_publish",
            params: {
              topic: generateRandomBytes32(),
              message: "itemC",
            },
          },
          opts: { ...opts, id: getId() },
          attempt: 1,
        },
        {
          request: {
            method: "irn_publish",
            params: {
              topic: generateRandomBytes32(),
              message: "itemD",
            },
          },
          opts: { ...opts, id: getId() },
          attempt: 1,
        },
        {
          request: {
            method: "irn_publish",
            params: {
              topic: generateRandomBytes32(),
              message: "itemE",
            },
          },
          opts: { ...opts, id: getId() },
          attempt: 1,
        },
      ];

      const requestSpy = Sinon.spy();
      publisher.relayer.request = requestSpy;

      // Manually set some items in the queue.
      items.forEach((item) =>
        publisher.queue.set(item.opts.id.toString(), {
          request: {
            method: "irn_publish",
            params: item.message,
          },
          opts: item.opts,
          attempt: 1,
        }),
      );
      expect(publisher.queue.size).to.equal(items.length);
      // Emit heartbeat pulse event
      publisher.relayer.core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);

      // Emit ACKs
      items.forEach((item) =>
        core.relayer.events.emit(RELAYER_EVENTS.message_ack, { id: item.opts.id }),
      );

      // -> Queue should clear after the ACKs.
      expect(publisher.queue.size).to.equal(0);
      // Emit heartbeat pulse event
      publisher.relayer.core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
      await throttle(100);
      // Emit heartbeat pulse event
      publisher.relayer.core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);

      // -> Queue should still be clear after the pulses.
      expect(publisher.queue.size).to.equal(0);
      // -> `request` should not have been called more times than the n items regardless of the n of pulses.
      expect(requestSpy.callCount).to.equal(items.length);
    });
    it("should process queue with delayed ACK", () => {
      const opts = { ttl: 1, prompt: true, relay: { protocol: "irn" }, tag: 0 };
      const items = [
        {
          request: {
            method: "irn_publish",
            params: {
              topic: generateRandomBytes32(),
              message: "itemA",
            },
          },
          opts: { ...opts, id: getId() },
          attempt: 1,
        },
        {
          request: {
            method: "irn_publish",
            params: {
              topic: generateRandomBytes32(),
              message: "itemB",
            },
          },
          opts: { ...opts, id: getId() },
          attempt: 1,
        },
        {
          request: {
            method: "irn_publish",
            params: {
              topic: generateRandomBytes32(),
              message: "itemC",
            },
          },
          opts: { ...opts, id: getId() },
          attempt: 1,
        },
        {
          request: {
            method: "irn_publish",
            params: {
              topic: generateRandomBytes32(),
              message: "itemD",
            },
          },
          opts: { ...opts, id: getId() },
          attempt: 1,
        },
        {
          request: {
            method: "irn_publish",
            params: {
              topic: generateRandomBytes32(),
              message: "itemE",
            },
          },
          opts: { ...opts, id: getId() },
          attempt: 1,
        },
      ];

      const requestSpy = Sinon.spy();
      publisher.relayer.request = requestSpy;

      // Manually set some items in the queue.
      items.forEach((item) => publisher.queue.set(item.opts.id.toString(), item));
      expect(publisher.queue.size).to.equal(items.length);

      const pulsesBeforeAck = 5;
      // emit multiple pulses to ensure queue is works correctly if ACK is delayed
      Array.from(Array(pulsesBeforeAck).keys()).forEach(async () => {
        publisher.relayer.core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
        await throttle(100);
      });

      // Emit ACKs
      items.forEach((item) =>
        core.relayer.events.emit(RELAYER_EVENTS.message_ack, { id: item.opts.id }),
      );

      // -> Queue should clear after the ACKs.
      expect(publisher.queue.size).to.equal(0);
      // -> all requests should have been sent once per pulse
      const expectedCallCount = items.length * pulsesBeforeAck;
      expect(requestSpy.callCount).to.equal(expectedCallCount);

      const pulsesAfterAck = 5;
      // emit additional pulses
      Array.from(Array(pulsesAfterAck).keys()).forEach(async () => {
        publisher.relayer.core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
        await throttle(100);
      });

      // request count should stay the same even after additional pulses
      expect(requestSpy.callCount).to.equal(expectedCallCount);
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
      const id = getId();
      await publisher.publish(topic, message, { id });
      expect(requestSpy.callCount).to.equal(1);
      expect(requestSpy.getCall(0).args[0]).to.deep.equal({
        method: "irn_publish",
        params: {
          topic,
          message,
          prompt: false,
          ttl: PUBLISHER_DEFAULT_TTL,
          tag: 0,
          attestation: undefined,
        },
        id,
      });
    });
    it("allows overriding of defaults via `opts` param", async () => {
      const message = "test message";
      const opts = { ttl: 1, prompt: true, relay: { protocol: "irn" }, tag: 1, id: getId(1) };
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
          attestation: undefined,
        },
        id: opts.id,
      });
    });
  });
});
