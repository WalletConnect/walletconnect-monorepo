import "mocha";
import { expect } from "chai";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { WakuService } from "../src/waku";
import config from "../src/config";
import { WakuMessage, WakuPeers } from "../src/types";
import { hexToBuffer } from "enc-utils";
import { generateRandomBytes32 } from "../src/utils";

import { TEST_WAKU_URL } from "./shared";

describe.only("Waku", () => {
  let wakuOne: WakuService;
  let wakuTwo: WakuService;
  let contentTopic: string;
  let testMessage: string;
  let topic: string;
  before(() => {
    let logger = pino(getDefaultLoggerOptions({ level: "trace" }));
    wakuOne = new WakuService(logger, TEST_WAKU_URL);
    wakuTwo = new WakuService(logger, TEST_WAKU_URL.replace("8546", "8547"));
  });
  beforeEach(() => {
    testMessage = generateRandomBytes32();
    contentTopic = generateRandomBytes32();
    topic = generateRandomBytes32();
  });
  it("Waku node has peers", async () => {
    wakuOne.getPeers((err, peers: WakuPeers[]) => {
      expect(err).to.be.undefined;
      expect(peers.length).to.be.greaterThan(0);
    });
  });
  it("Receives a content message from two waku nodes with filter api of waku", function(done) {
    wakuOne.contentSubscribe(contentTopic);
    setTimeout(() => {
      wakuTwo.postContent(testMessage, contentTopic);
    }, 100);
    setTimeout(() => {
      wakuOne.getContentMessages(contentTopic, (err, messages: WakuMessage[]) => {
        expect(err).to.be.undefined;
        expect(messages.length).to.equal(1);
        expect(messages[0].payload).to.equal(testMessage);
        expect(messages[0].contentTopic).to.equal(contentTopic);
        done();
      });
    }, 200);
  });

  it("Receive message from two waku nodes with relay api of waku", function(done) {
    wakuOne.subscribe(topic);
    setTimeout(() => {
      wakuTwo.post(testMessage, topic);
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
  it("It polls for messages", function(done) {
    wakuOne.onNewTopicMessage(topic, (err, messages) => {
      expect(err).to.be.undefined;
      expect(messages.length).to.equal(1);
      expect(messages[0].payload).to.equal(testMessage);
      done();
    });
    setTimeout(() => {
      wakuTwo.post(testMessage, topic);
    }, 750);
  });
});
