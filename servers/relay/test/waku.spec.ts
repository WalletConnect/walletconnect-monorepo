import "mocha";
import { expect } from "chai";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { WakuService } from "../src/waku";
import { WakuMessage, WakuPeers } from "../src/types";
import { generateRandomBytes32 } from "../src/utils";

import { TEST_WAKU_URL } from "./shared";

describe("Waku", () => {
  let wakuOne: WakuService;
  let wakuTwo: WakuService;
  let filterTopic: string;
  let testMessage: string;
  let topic: string;
  before(() => {
    let logger = pino(getDefaultLoggerOptions({ level: "error" }));
    wakuOne = new WakuService(logger, TEST_WAKU_URL);
    wakuTwo = new WakuService(logger, TEST_WAKU_URL.replace("8546", "8547"));
  });
  beforeEach(() => {
    testMessage = generateRandomBytes32();
    filterTopic = generateRandomBytes32();
    topic = generateRandomBytes32();
  });
  it("Waku node has peers", async () => {
    wakuOne.getPeers((err, peers: WakuPeers[]) => {
      expect(err).to.be.undefined;
      expect(peers.length).to.be.greaterThan(0);
    });
  });
  it("Receives a content message from two waku nodes with filter api of waku", function(done) {
    wakuOne.filterSubscribe(filterTopic);
    setTimeout(() => {
      wakuTwo.postFilterTopic(testMessage, filterTopic);
    }, 100);
    setTimeout(() => {
      wakuOne.getFilterTopicMessages(filterTopic, (err, messages: WakuMessage[]) => {
        expect(err).to.be.undefined;
        expect(messages.length).to.equal(1);
        expect(messages[0].payload).to.equal(testMessage);
        expect(messages[0].filterTopic).to.equal(filterTopic);
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
  // We aren't doing global topic polling anymore
  // But polling for global topic to see if we missed a filter message
  // could be an alternative to using the store to get historical message
  // The problem with that is that there is a potential that a lot of messages
  // need to get filtered in search for the specific filterTopic
  xit("It polls for messages", function(done) {
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
  it("It polls for filter messages", function(done) {
    wakuOne.onNewFilterTopicMessage(filterTopic, (err, messages) => {
      expect(err).to.be.undefined;
      expect(messages.length).to.equal(1);
      expect(messages[0].payload).to.equal(testMessage);
      done();
    });
    setTimeout(() => {
      wakuTwo.postFilterTopic(testMessage, filterTopic);
    }, 750);
  });
  it.only("Filter unsubscribe works", function(done) {
    wakuOne.onNewFilterTopicMessage(filterTopic, () => {});
    setTimeout(() => {
      wakuOne.filterUnsubscribe(filterTopic);
    }, 100);
    setTimeout(() => {
      expect(wakuOne.filterTopics).not.include(filterTopic);
      wakuOne.getFilterTopicMessages(filterTopic, (err, messages) => {
        expect(err).to.exist;
        expect(err?.error.message).to.equal("get_waku_v2_filter_v1_messages raised an exception");
        // https://github.com/pedrouid/json-rpc-tools/pull/2
        //expect(err.error.data).to.equal(`Not subscribed to content topic: ${filterTopic}`);
        expect(messages).to.be.empty;
        done();
      });
    }, 200);
  });
});
