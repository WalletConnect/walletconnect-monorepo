import "mocha";
import pino from "pino";
import { getDefaultLoggerOptions } from "@walletconnect/logger";
import { expect } from "chai";
import { sha256, generateRandomBytes32 } from "../src/utils";

import config from "../src/config";
import { HttpService } from "../src/http";

import { RedisService, RedisStreamID } from "../src/redis";
import { ONE_DAY } from "@walletconnect/time";

import { TEST_MESSAGE, TEST_TOPIC } from "./shared";

describe("Redis", () => {
  let redis: RedisService;
  before(() => {
    const http = new HttpService(config);
    const logger = pino(getDefaultLoggerOptions({ level: "fatal" }));
    redis = new RedisService(http, logger);
  });
  it("setMessage", async () => {
    const params = {
      topic: TEST_TOPIC,
      message: TEST_MESSAGE,
      ttl: ONE_DAY,
    };
    await redis.setMessage(params);
    const result = await redis.client.TTL(`message:${params.topic}`);
    expect(result).to.be.equal(params.ttl);
    expect(result).to.be.gte(params.ttl - 1); // One second less
  });
  it("Gets a single message from redis", async () => {
    for (let i = 0; i < 250; i++) {
      await redis.setMessage({
        topic: TEST_TOPIC,
        message: generateRandomBytes32(),
        ttl: ONE_DAY,
      });
    }
    const params = {
      topic: TEST_TOPIC,
      message: generateRandomBytes32(),
      ttl: ONE_DAY,
    };
    await redis.setMessage(params);
    expect(await redis.getMessage(params.topic, sha256(params.message))).to.equal(params.message);
  });
  it("Non-existing message is undefined", async () => {
    const params = {
      topic: TEST_TOPIC,
      message: generateRandomBytes32(),
      ttl: ONE_DAY,
    };
    expect(await redis.getMessage(params.topic, sha256(params.message))).to.be.undefined;
  });
  it("Message gets deleted", async () => {
    for (let i = 0; i < 200; i++) {
      await redis.setMessage({
        topic: TEST_TOPIC,
        message: generateRandomBytes32(),
        ttl: ONE_DAY,
      });
    }
    const testMessage = {
      topic: TEST_TOPIC,
      message: generateRandomBytes32(),
      ttl: ONE_DAY,
    };
    await redis.setMessage(testMessage);
    expect(await redis.getMessage(testMessage.topic, sha256(testMessage.message))).to.equal(
      testMessage.message,
    );
    await redis.deleteMessage(TEST_TOPIC, sha256(testMessage.message));
    expect(await redis.getMessage(testMessage.topic, sha256(testMessage.message))).to.be.undefined;
  });
});
describe("RedisStreamID", () => {
  it.only("isHigher", async () => {
    let idOne = new RedisStreamID("1651146414395-42");
    let idTwo = new RedisStreamID("1651146414395-43");
    expect(idOne.isHigher(idTwo)).to.be.false;
    idOne = new RedisStreamID("0-0");
    idTwo = new RedisStreamID("1651146414395-43");
    expect(idOne.isHigher(idTwo)).to.be.false;
    idOne = new RedisStreamID("0-0");
    idTwo = new RedisStreamID("0-0");
    expect(idOne.isHigher(idTwo)).to.be.false;
    idOne = new RedisStreamID("0-1");
    idTwo = new RedisStreamID("0-0");
    expect(idOne.isHigher(idTwo)).to.be.true;
  });
});
