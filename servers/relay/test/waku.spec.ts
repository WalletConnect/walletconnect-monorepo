import "mocha";
import { expect } from "chai";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { NetworkService } from "../src/network";
import { generateRandomBytes32 } from "../src/utils";

import { TEST_WAKU_URL } from "./shared";
import { HttpService } from "../src/http";

describe("NETWORK", () => {
  let serverOne: HttpService;
  let serverTwo: HttpService;
  let wakuOne: NetworkService;
  let wakuTwo: NetworkService;
  let testMessage: string;
  let topic: string;
  before(() => {
    const logger = pino(getDefaultLoggerOptions({ level: "trace" }));
    const serverOne = new HttpService({ logger: "fatal" });
    const serverTwo = new HttpService({ logger: "fatal" });
    wakuOne = new NetworkService(serverOne, logger, TEST_WAKU_URL);
    wakuTwo = new NetworkService(serverTwo, logger, TEST_WAKU_URL.replace("8546", "8547"));
  });
  beforeEach(() => {
    testMessage = generateRandomBytes32();
    topic = generateRandomBytes32();
  });
  it.skip("Receives a filter message on Waku A from Waku B", async () => {
    await wakuOne.subscribe(topic);
    await wakuTwo.publish(testMessage, topic);
    await new Promise<void>(resolve => {
      serverOne.on("waku_messages", (topic, messages) => {
        const receivedPayloads = messages.map(m => m.payload);
        expect(receivedPayloads).to.include(testMessage);
        resolve();
      });
    });
  });
  it.skip("Polls a filter message on Waku A from Waku B", async () => {
    await wakuOne.subscribe(topic);
    setTimeout(() => {
      wakuTwo.publish(testMessage, topic);
    }, 1000);
    await new Promise<void>(resolve => {
      serverOne.on("waku_messages", (topic, messages) => {
        const receivedPayloads = messages.map(m => m.payload);
        expect(receivedPayloads).to.include(testMessage);
        resolve();
      });
    });
  });
  // it.skip("Gets a single store messages", async () => {
  //   await wakuTwo.publish(testMessage, topic);
  //   const result = await wakuOne.getStoreMessages(topic);
  //   expect(result.length).to.equal(1);
  //   expect(result[0].payload).to.equal(testMessage);
  // });
  // it.skip("Gets multiple random quantity store messages", async () => {
  //   const allMessages: string[] = [];
  //   const totalMessages = Math.floor(Math.random() * 150) + 20;
  //   for (let i = 0; i < totalMessages; i++) {
  //     allMessages.push(generateRandomBytes32());
  //     await wakuTwo.publish(allMessages[allMessages.length - 1], topic);
  //   }
  //   const result = await wakuOne.getStoreMessages(topic);
  //   const receivedMessages = result.map(m => m.payload);
  //   expect(receivedMessages.length).to.equal(allMessages.length);
  //   expect(receivedMessages).to.have.members(allMessages);
  // });
});
