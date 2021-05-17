import "mocha";
import { expect } from "chai";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { WakuService } from "../src/waku";
import { generateRandomBytes32 } from "../src/utils";

import { TEST_WAKU_URL } from "./shared";

describe("WAKU", () => {
  let wakuOne: WakuService;
  let wakuTwo: WakuService;
  let testMessage: string;
  let topic: string;
  before(() => {
    let logger = pino(getDefaultLoggerOptions({ level: "trace" }));
    //wakuOne = new WakuService(logger, TEST_WAKU_URL);
    //wakuTwo = new WakuService(logger, TEST_WAKU_URL.replace("8546", "8547"));
  });
  beforeEach(() => {
    testMessage = generateRandomBytes32();
    topic = generateRandomBytes32();
  });
  it("Receives a filter message on Waku A from Waku B", async () => {
    await wakuOne.subAndGetHistorical(topic);
    await wakuTwo.post(testMessage, topic);
    await new Promise<void>(resolve => {
      wakuOne.on("message", event => {
        let receivedPayloads = event.messages.map(m => m.payload);
        expect(receivedPayloads).to.include(testMessage);
        resolve();
      });
    });
  });
  it("Polls a filter message on Waku A from Waku B", async () => {
    await wakuOne.subscribe(topic);
    setTimeout(() => {
      wakuTwo.post(testMessage, topic);
    }, 1000);
    await new Promise<void>(resolve => {
      wakuOne.on("message", event => {
        let receivedPayloads = event.messages.map(m => m.payload);
        expect(receivedPayloads).to.include(testMessage);
        resolve();
      });
    });
  });
  it("Gets a single store messages", async () => {
    await wakuTwo.post(testMessage, topic);
    let result = await wakuOne.getStoreMessages(topic);
    expect(result.length).to.equal(1);
    expect(result[0].payload).to.equal(testMessage);
  });
  it("Gets multiple random quantity store messages", async () => {
    let allMessages: string[] = [];
    let totalMessages = Math.floor(Math.random() * 150) + 20;
    for (var i = 0; i < totalMessages; i++) {
      allMessages.push(generateRandomBytes32());
      await wakuTwo.post(allMessages[allMessages.length - 1], topic);
    }
    let result = await wakuOne.getStoreMessages(topic);
    let receivedMessages = result.map(m => m.payload);
    expect(receivedMessages.length).to.equal(allMessages.length);
    expect(receivedMessages).to.have.members(allMessages);
  });
});
