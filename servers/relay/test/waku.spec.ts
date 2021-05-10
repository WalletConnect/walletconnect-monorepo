import "mocha";
import { expect } from "chai";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { WakuService } from "../src/waku";
import { generateRandomBytes32 } from "../src/utils";

import { TEST_WAKU_URL } from "./shared";

describe.only("WAKU", () => {
  let wakuOne: WakuService;
  let wakuTwo: WakuService;
  let testMessage: string;
  let topic: string;
  before(() => {
    let logger = pino(getDefaultLoggerOptions({ level: "trace" }));
    wakuOne = new WakuService(logger, TEST_WAKU_URL);
    wakuTwo = new WakuService(logger, TEST_WAKU_URL.replace("8546", "8547"));
  });
  beforeEach(() => {
    testMessage = generateRandomBytes32();
    topic = generateRandomBytes32();
  });
  afterEach(() => {
    //wakuOne.logger.level = "error";
  });
  it("Receives a filter message on Waku A from Waku B using filter api", async function(done) {
    await wakuOne.subscribe(topic);
    await wakuTwo.post(testMessage, topic);
    wakuOne.on("message", event => {
      console.log(event);
      expect(event.messages).to.include(topic);
      done();
    });
  });
  /*

  // NOTE: This test doesn't pass when the nodes aren't peered with each other
  // through the static node option is turned on. Especially through our arquitecture of
  // using a single store node
  it("Receive message on Waku A from Waku B using relay api", function(done) {
    wakuOne.subscribe(topic);
    setTimeout(() => {
      wakuTwo.post(testMessage, "", topic);
    }, 100);
    setTimeout(() => {
      wakuOne.getMessages(topic, (err, m) => {
        expect(err).to.be.undefined;
        expect(m.length).to.be.greaterThan(0);
        expect(m[0].payload).to.equal(testMessage);
        done();
      });
    }, 200);
  });
  it("It polls for filter messages", function(done) {
    wakuOne.onNewFilterMessage(contentTopic, (err, messages) => {
      expect(err).to.be.undefined;
      expect(messages.length).to.equal(1);
      expect(messages[0].payload).to.equal(testMessage);
      done();
    });
    setTimeout(() => {
      wakuTwo.post(testMessage, contentTopic);
    }, 750);
  });
  it("It can resubcribe to polling topics", function(done) {
    wakuOne.logger.level = "silent";
    wakuOne.onNewFilterMessage(contentTopic, (err, messages) => {
      expect(err).to.be.undefined;
      expect(messages.length).to.equal(1);
      expect(messages[0].payload).to.equal(testMessage);
      done();
    });
    setTimeout(() => {
      wakuOne.send(
        formatJsonRpcRequest("delete_waku_v2_filter_v1_subscription", [
          [{ contentTopics: [contentTopic] }],
        ]),
      );
    }, 100);
    setTimeout(() => {
      wakuTwo.post(testMessage, contentTopic);
    }, 600);
  });
  it("Filter unsubscribe works", function(done) {
    wakuOne.logger.level = "silent";
    wakuOne.onNewFilterMessage(contentTopic, () => {});
    setTimeout(() => {
      wakuOne.unsubscribe(contentTopic);
    }, 100);
    setTimeout(() => {
      expect(wakuOne.filterTopics).not.include(contentTopic);
      wakuOne.getFilterMessages(contentTopic, (err, messages) => {
        expect(err).to.exist;
        expect(err?.error.message).to.equal("get_waku_v2_filter_v1_messages raised an exception");
        expect(err?.error.data).to.equal(`Not subscribed to content topic: ${contentTopic}`);
        expect(messages).to.be.empty;
        done();
      });
    }, 200);
  });
  */
  it("Gets a single store messages", async function() {
    await wakuOne.post(testMessage, topic);
    let result = await wakuOne.getStoreMessages(topic);
    expect(result.length).to.equal(1);
    expect(result[0].payload).to.equal(testMessage);
  });
  it("Gets multiple random quantity store messages", async function() {
    let allMessages: string[] = [];
    let totalMessages = Math.floor(Math.random() * 150) + 100;
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
