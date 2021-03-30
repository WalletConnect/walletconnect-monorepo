import "mocha";
import { assert, expect } from "chai";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { WakuService } from "../src/waku";
import { WakuMessage } from "../src/types";
import { hexToBuffer, hexToBinary, hexToNumber, arrayToHex } from "enc-utils";
import { generateRandomBytes32 } from "../src/utils";

import { WAKU_TOPIC, TEST_WAKU_URL } from "./shared";

let testMessage = "48656c6c6f20576f726c6421";

describe("Waku", () => {
  // We can use a single waku node with two WakuService
  let wakuOne: WakuService;
  let wakuTwo: WakuService;
  let contentTopic: number;
  before(() => {
    wakuOne = new WakuService(pino(getDefaultLoggerOptions({ level: "trace" })), TEST_WAKU_URL);
    wakuTwo = new WakuService(
      pino(getDefaultLoggerOptions({ level: "trace" })),
      TEST_WAKU_URL.replace("8546", "8547"),
    );
  });
  beforeEach(() => {
    contentTopic = hexToBuffer(generateRandomBytes32()).readUInt32BE();
  });
  it("Waku node has peers", async () => {
    let peers = await wakuOne.getPeers();
    expect(peers.length).to.be.greaterThan(0);
  });
  it("It polls for messages", async () => {});
  it.only("Receives a message from waku", function(done) {
    this.timeout(10000);
    wakuTwo.contentSubscribe(contentTopic);
    wakuOne.contentSubscribe(contentTopic);
    setTimeout(() => {
      wakuOne.postMessage(testMessage, contentTopic);
    }, 500);
    setTimeout(() => {
      wakuTwo.getContentMessages(contentTopic).then(m => {
        console.log("Message: ", m);
        done();
      });
    }, 2000);
    setTimeout(() => {
      wakuTwo.getMessages().then(m => {
        console.log("Message two: ", m);
        done();
      });
    }, 2000);

    /*
    expect(true).to.be.true;
    expect(messages.length).to.greaterThan(0);
    expect(arrayToHex(messages[0].payload)).to.equal(testMessage);
    */
  });

  it("Multiple waku nodes", function(done) {
    // TODO maybe conver these timeouts to a promise.all
    this.timeout(5000);
    wakuTwo.contentSubscribe(contentTopic);
    setTimeout(async () => {
      await wakuOne.postMessage(testMessage, contentTopic);
    }, 500);
    setTimeout(async () => {
      let messages = await wakuTwo.getContentMessages(contentTopic);
      expect(messages.length).to.be.greaterThan(0);
      expect(arrayToHex(messages[0].payload)).to.equal(testMessage);
      done();
    }, 1000);
  });
});
