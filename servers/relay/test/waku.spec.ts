import "mocha";
import { assert, expect } from "chai";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { WakuService, WakuMessage } from "../src/waku";
import { arrayToHex } from "enc-utils";
import { generateRandomBytes32 } from "../src/utils";

import { TEST_WAKU_URL } from "./shared";

let testMessage = "48656c6c6f20576f726c6421";

describe("Waku", () => {
  // We can use a single waku node with two WakuService
  let wakuOne: WakuService;
  let wakuTwo: WakuService;
  let testTopic: string;
  before(() => {
    wakuOne = new WakuService(pino(getDefaultLoggerOptions({ level: "trace" })), TEST_WAKU_URL);
    wakuTwo = new WakuService(
      pino(getDefaultLoggerOptions({ level: "trace" })),
      TEST_WAKU_URL.replace("8546", "8547"),
    );
  });
  beforeEach(() => {
    testTopic = generateRandomBytes32();
  });
  it("Waku node has peers", async () => {
    let peers = await wakuOne.getPeers();
    expect(peers.length).to.be.greaterThan(0);
  });
  it("It polls for messages", async () => {});
  it.only("Receives a message from waku", async () => {
    await wakuOne.subscribe([testTopic]);
    await wakuOne.postMessage(testTopic, testMessage);
    let messages = await wakuOne.getMessages([testTopic]);
    expect(messages.length).to.greaterThan(0);
    expect(arrayToHex(messages[0].payload)).to.equal(testMessage);
  });
  it.only("Multiple waku nodes", function(done) {
    this.timeout(5000);
    wakuTwo.subscribe([testTopic]);
    setTimeout(async () => {
      await wakuOne.postMessage(testTopic, testMessage);
    }, 500);
    setTimeout(async () => {
      let messages = await wakuTwo.getMessages([testTopic]);
      expect(messages.length).to.be.greaterThan(0);
      expect(arrayToHex(messages[0].payload)).to.equal(testMessage);
      done();
    }, 1000);
  });
});
