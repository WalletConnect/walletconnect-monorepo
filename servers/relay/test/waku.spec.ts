import "mocha";
import { assert, expect } from "chai";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { WakuService, WakuMessage } from "../src/waku";
import { arrayToHex } from "enc-utils";

import { TEST_WAKU_URL } from "./shared";

let testTopic = "my_topic_1";
let testMessage = "1a2b3c4d5e6e";

describe.only("Waku", () => {
  // We can use a single waku node with two WakuService
  let wakuOne: WakuService;
  let wakuTwo: WakuService;
  before(() => {
    wakuTwo = new WakuService(pino(getDefaultLoggerOptions({ level: "trace" })), TEST_WAKU_URL);
    wakuOne = new WakuService(pino(getDefaultLoggerOptions({ level: "trace" })), TEST_WAKU_URL);
  });
  it.only("It has waku peers", async () => {
    let peers = await wakuOne.getPeers();
    expect(peers.length).to.be.greaterThan(0);
  });
  it("Waku peers should have structure WakuPeers", async () => {
    let peers = await wakuOne.getPeers();
  });
  it("Posts a message to waku", async () => {
    wakuOne.postMessage(testTopic, testMessage);
  });
  it("Subscribe to messages", async () => {
    wakuOne.subscribe([testTopic]);
  });
  it("It polls for messages", async () => {});
  it.only("Receives a message from waku", async () => {
    await wakuOne.subscribe([testTopic]);
    await wakuOne.postMessage(testTopic, testMessage);
    let messages = await wakuOne.getMessages([testTopic]);
    expect(messages.length).to.greaterThan(0);
    expect(arrayToHex(messages[0].payload)).to.equal(testMessage);
  });
});
