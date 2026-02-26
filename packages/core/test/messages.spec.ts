import { expect, describe, it, beforeEach } from "vitest";
import { getDefaultLoggerOptions, pino } from "@walletconnect/logger";
import { generateRandomBytes32, hashMessage } from "@walletconnect/utils";

import {
  Core,
  CORE_DEFAULT,
  CORE_STORAGE_PREFIX,
  MESSAGE_DIRECTION,
  MESSAGES_CONTEXT,
  MESSAGES_STORAGE_VERSION,
  MessageTracker,
} from "../src";
import { TEST_CORE_OPTIONS } from "./shared";

describe("Messages", () => {
  const logger = pino(getDefaultLoggerOptions({ level: CORE_DEFAULT.logger }));

  let messageTracker: MessageTracker;
  let topic: string;

  beforeEach(async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    messageTracker = new MessageTracker(logger, core);
    topic = generateRandomBytes32();
    await messageTracker.init();
  });

  describe("storageKey", () => {
    it("provides the expected default `storageKey` format", () => {
      expect(messageTracker.storageKey).to.equal(
        CORE_STORAGE_PREFIX + MESSAGES_STORAGE_VERSION + "//" + MESSAGES_CONTEXT,
      );
    });
    it("provides the expected custom `storageKey` format", () => {
      const core = new Core({ ...TEST_CORE_OPTIONS, customStoragePrefix: "test" });
      const messageTracker = new MessageTracker(logger, core);
      expect(messageTracker.storageKey).to.equal(
        CORE_STORAGE_PREFIX + MESSAGES_STORAGE_VERSION + ":test" + "//" + MESSAGES_CONTEXT,
      );
    });
  });

  describe("set", () => {
    it("throws if not initialized", async () => {
      const invalidMessageTracker = new MessageTracker(logger, new Core(TEST_CORE_OPTIONS));
      await expect(invalidMessageTracker.set(topic, "some message")).rejects.toThrow(
        "Not initialized. messages",
      );
    });
    it("sets an entry on the messages map for a new topic-message pair", async () => {
      const mockMessage = "test message";
      await messageTracker.set(topic, mockMessage, MESSAGE_DIRECTION.inbound);
      const key = hashMessage(mockMessage);
      const message = messageTracker.messages.get(topic) ?? {};
      expect(message[key]).to.equal(mockMessage);
      const messagesWithoutClientAck = messageTracker.messagesWithoutClientAck.get(topic) ?? {};
      expect(messagesWithoutClientAck[key]).to.equal(mockMessage);
    });
  });

  describe("get", () => {
    it("throws if not initialized", () => {
      const invalidMessageTracker = new MessageTracker(logger, new Core(TEST_CORE_OPTIONS));
      expect(() => invalidMessageTracker.get(topic)).to.throw("Not initialized. messages");
    });
    it("returns an empty object for an unknown topic", () => {
      const message = messageTracker.get("fakeTopic");
      expect(message).to.deep.equal({});
    });
    it("returns the expected message based on the topic", async () => {
      const mockMessage = "test message";
      await messageTracker.set(topic, mockMessage, MESSAGE_DIRECTION.inbound);
      expect(messageTracker.get(topic)).to.deep.equal({ [hashMessage(mockMessage)]: mockMessage });
      const messagesWithoutClientAck = messageTracker.messagesWithoutClientAck.get(topic) ?? {};
      expect(messagesWithoutClientAck[hashMessage(mockMessage)]).to.equal(mockMessage);
    });
  });

  describe("has", () => {
    it("throws if not initialized", () => {
      const invalidMessageTracker = new MessageTracker(logger, new Core(TEST_CORE_OPTIONS));
      expect(() => invalidMessageTracker.has(topic, "message")).to.throw(
        "Not initialized. messages",
      );
    });
    it("returns `false` by default", () => {
      expect(messageTracker.has("fakeTopic", "message")).to.be.false;
    });
    it("returns `true` if provided topic-message pair exists", async () => {
      const mockMessage = "test message";
      await messageTracker.set(topic, mockMessage);
      expect(messageTracker.has(topic, mockMessage)).to.be.true;
    });
  });

  describe("del", () => {
    it("throws if not initialized", async () => {
      const invalidMessageTracker = new MessageTracker(logger, new Core(TEST_CORE_OPTIONS));
      await expect(invalidMessageTracker.del(topic)).rejects.toThrow("Not initialized. messages");
    });
    it("removes the matching topic-message pair for the provided topic", async () => {
      await messageTracker.set(topic, "message", MESSAGE_DIRECTION.inbound);
      expect(messageTracker.messages.size).to.equal(1);
      expect(messageTracker.messagesWithoutClientAck.size).to.equal(1);
      await messageTracker.del(topic);
      expect(messageTracker.messages.size).to.equal(0);
      expect(messageTracker.messagesWithoutClientAck.size).to.equal(0);
    });
  });

  describe("ack", () => {
    it("throws if not initialized", async () => {
      const invalidMessageTracker = new MessageTracker(logger, new Core(TEST_CORE_OPTIONS));
      await expect(invalidMessageTracker.ack(topic, "message")).rejects.toThrow(
        "Not initialized. messages",
      );
    });
    it("removes the topic-message pair from `messagesWithoutClientAck` when acknowledged", async () => {
      await messageTracker.set(topic, "message", MESSAGE_DIRECTION.inbound);
      await messageTracker.ack(topic, "message");
      expect(messageTracker.messages.size).to.equal(1);
      expect(messageTracker.messagesWithoutClientAck.size).to.equal(0);
    });

    it("doesn't store outbound messages in `messagesWithoutClientAck`", async () => {
      await messageTracker.set(topic, "message", MESSAGE_DIRECTION.outbound);
      expect(messageTracker.messages.size).to.equal(1);
      expect(messageTracker.messagesWithoutClientAck.size).to.equal(0);
    });

    it("doesn't throw if the topic-message pair doesn't exist", async () => {
      expect(await messageTracker.ack(topic, "message")).to.be.undefined;
    });
  });

  describe("getWithoutAck", () => {
    it("returns an empty map if no topics are provided", () => {
      expect(messageTracker.getWithoutAck([])).to.deep.equal({});
    });

    it("returns empty map if no messages are available for the provided topic", () => {
      expect(messageTracker.getWithoutAck([topic])).to.deep.equal({ [topic]: [] });
    });
    it("returns correct messages for the provided topic", async () => {
      const mockMessage = "test message";
      await messageTracker.set(topic, mockMessage, MESSAGE_DIRECTION.inbound);
      expect(messageTracker.getWithoutAck([topic])).to.deep.equal({
        [topic]: [mockMessage],
      });
    });
    it("returns correct messages for multiple provided topics", async () => {
      const mockMessage = "test message";
      const topic2 = generateRandomBytes32();
      await messageTracker.set(topic, mockMessage, MESSAGE_DIRECTION.inbound);
      await messageTracker.set(topic2, mockMessage, MESSAGE_DIRECTION.inbound);
      expect(messageTracker.getWithoutAck([topic, topic2])).to.deep.equal({
        [topic]: [mockMessage],
        [topic2]: [mockMessage],
      });
    });
    it("returns correct messages for multiple provided topics. Test 2", async () => {
      const mockMessage = "test message";
      const mockMessage2 = "test message 2";
      const mockMessage3 = "test message 3";
      const topic2 = generateRandomBytes32();
      const topic3 = generateRandomBytes32();
      await messageTracker.set(topic, mockMessage, MESSAGE_DIRECTION.inbound);
      await messageTracker.set(topic2, mockMessage2, MESSAGE_DIRECTION.inbound);
      await messageTracker.set(topic3, mockMessage3, MESSAGE_DIRECTION.inbound);
      expect(messageTracker.getWithoutAck([topic2, topic3])).to.deep.equal({
        [topic2]: [mockMessage2],
        [topic3]: [mockMessage3],
      });
    });
    it("returns correct messages for multiple provided topics. Test 3", async () => {
      const mockMessage = "test message";
      const mockMessage2 = "test message 2";
      const mockMessage3 = "test message 3";
      const topic2 = generateRandomBytes32();
      const topic3 = generateRandomBytes32();
      await messageTracker.set(topic, mockMessage, MESSAGE_DIRECTION.inbound);
      await messageTracker.set(topic, mockMessage2, MESSAGE_DIRECTION.inbound);
      await messageTracker.set(topic2, mockMessage3, MESSAGE_DIRECTION.inbound);
      expect(messageTracker.getWithoutAck([topic, topic2, topic3])).to.deep.equal({
        [topic]: [mockMessage, mockMessage2],
        [topic2]: [mockMessage3],
        [topic3]: [],
      });
    });
  });
});
