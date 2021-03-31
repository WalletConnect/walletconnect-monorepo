import "mocha";
import { assert, expect } from "chai";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { WakuService } from "../src/waku";
import { WakuMessage } from "../src/types";
import { hexToBuffer, hexToBinary, hexToNumber, arrayToHex } from "enc-utils";
import { generateRandomBytes32 } from "../src/utils";

import { WAKU_TOPIC, TEST_WAKU_URL } from "./shared";
import { JsonRpcResult } from "@json-rpc-tools/utils";

describe("Waku", () => {
  // We can use a single waku node with two WakuService
  let wakuOne: WakuService;
  let wakuTwo: WakuService;
  let contentTopic: number;
  let testMessage: string;
  let stringTopic: string;
  before(() => {
    wakuOne = new WakuService(pino(getDefaultLoggerOptions({ level: "trace" })), TEST_WAKU_URL);
    wakuTwo = new WakuService(
      pino(getDefaultLoggerOptions({ level: "trace" })),
      TEST_WAKU_URL.replace("8546", "8547"),
    );
  });
  beforeEach(() => {
    testMessage = generateRandomBytes32();
    contentTopic = hexToBuffer(generateRandomBytes32()).readUInt32BE();
    stringTopic = generateRandomBytes32();
  });
  it("Waku node has peers", async () => {
    let peers = await wakuOne.getPeers();
    expect(peers.length).to.be.greaterThan(0);
  });
  xit("Receives a content message from two waku with filter api", function(done) {
    this.timeout(10000);
    wakuTwo.contentSubscribe(contentTopic);
    setTimeout(() => {
      wakuOne.postMessage(testMessage, stringTopic);
    }, 250);
    setTimeout(() => {
      wakuTwo.getContentMessages(contentTopic).then(m => {
        console.log("Message: ", m);
      });
    }, 500);
    setTimeout(() => {
      wakuTwo.getMessages(wakuTwo.namespace).then(m => {
        console.log("Message two: ", m);
        done();
        expect(m.length).to.greaterThan(0);
        expect(arrayToHex(m[0].payload)).to.equal(testMessage);
      });
    }, 600);
  });

  it("Receive message from two waku nodes with relay api", function(done) {
    wakuTwo.subscribe(stringTopic);
    setTimeout(() => {
      wakuOne.postMessage(testMessage, stringTopic);
    }, 20);
    setTimeout(() => {
      wakuTwo.getMessages(stringTopic).then(m => {
        expect(m.length).to.be.greaterThan(0);
        expect(arrayToHex(m[0].payload)).to.equal(testMessage);
        done();
      });
    }, 100);
  });
  it.only("It polls for messages", function(done) {
    setTimeout(() => {
      wakuTwo.postMessage(testMessage, stringTopic);
    }, 1000);
    wakuOne.onNewTopicMessage(stringTopic, (messages: WakuMessage[]) => {
      expect(messages.length).to.equal(1);
      expect(arrayToHex(messages[0].payload)).to.equal(testMessage);
      done();
    });
  });
});
