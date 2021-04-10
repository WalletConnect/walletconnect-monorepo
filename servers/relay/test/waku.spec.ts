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

describe("Waku", () => {
  let wakuOne: WakuService;
  let wakuTwo: WakuService;
  let wakuThree: WakuService;
  let contentTopic: string;
  let testMessage: string;
  let stringTopic: string;
  before(() => {
    let logger = pino(getDefaultLoggerOptions({ level: "trace" }));
    wakuOne = new WakuService(logger, TEST_WAKU_URL);
    wakuTwo = new WakuService(logger, TEST_WAKU_URL.replace("8546", "8547"));
    wakuThree = new WakuService(logger, TEST_WAKU_URL.replace("8546", "8548"));
  });
  beforeEach(() => {
    testMessage = generateRandomBytes32();
    contentTopic = generateRandomBytes32();
    stringTopic = generateRandomBytes32();
  });
  it("Waku node has peers", async () => {
    wakuOne.getPeers((err, peers: WakuPeers[]) => {
      expect(err).to.be.undefined;
      expect(peers.length).to.be.greaterThan(0);
    });
  });
  it.only("Receives a content message from two waku nodes with filter api of waku", function(done) {
    this.timeout(10000);
    wakuOne.subscribe();
    wakuTwo.subscribe();
    setTimeout(() => {
      wakuOne.contentSubscribe(contentTopic);
    }, 500);
    setTimeout(() => {
      wakuThree.postContent(testMessage, contentTopic);
    }, 1000);
    setTimeout(() => {
      wakuTwo.getMessages(config.wcTopic, (err, m) => {
        console.log("Message:", m, err);
        expect(err).to.be.undefined;
        expect(m.length).to.be.greaterThan(0);
        expect(m[0].payload).to.equal(testMessage);
        done();
      });
      /*
      wakuOne.getContentMessages(contentTopic, (err, m: WakuMessage[]) => {
        console.log("Message:", m, err);
        expect(err).to.be.undefined;
        expect(m[0].payload).to.equal(testMessage);
        done();
      });
    */
    }, 1500);
  });

  it("Receive message from two waku nodes with relay api of waku", function(done) {
    wakuOne.subscribe(stringTopic);
    setTimeout(() => {
      wakuTwo.post(testMessage, stringTopic);
    }, 200);
    setTimeout(() => {
      wakuOne.getMessages(stringTopic, (err, m) => {
        expect(err).to.be.undefined;
        expect(m.length).to.be.greaterThan(0);
        expect(m[0].payload).to.equal(testMessage);
        done();
      });
    }, 600);
  });
  it("It polls for messages", function(done) {
    wakuOne.onNewTopicMessage(stringTopic, (err, messages) => {
      expect(err).to.be.undefined;
      expect(messages.length).to.equal(1);
      expect(messages[0].payload).to.equal(testMessage);
      done();
    });
    setTimeout(() => {
      wakuTwo.post(testMessage, stringTopic);
    }, 750);
  });
  it("Gets Historical waku messages from the waku store api", function(done) {
    this.timeout(10000);
    wakuOne.subscribe(wakuOne.namespace, err => {
      expect(err).to.be.undefined;
    });
    wakuOne.contentSubscribe(contentTopic, err => {
      expect(err).to.be.undefined;
    });
    setTimeout(() => {
      wakuTwo.postContent(testMessage, contentTopic);
    }, 500);
    setTimeout(() => {
      wakuOne.getStoreMessages(contentTopic, (err, m: WakuMessage[]) => {
        console.log("Message:", m);
        expect(err).to.be.undefined;
        expect(m[0].payload).to.equal(testMessage);
        done();
      });
    }, 1000);
  });
});
