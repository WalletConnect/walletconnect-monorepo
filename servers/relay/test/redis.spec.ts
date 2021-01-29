import "mocha";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { expect } from "chai";

import { RedisService } from "../src/redis";

import { TEST_MESSAGE, TEST_TOPIC } from "./shared";

describe("Redis", () => {
  let redis: RedisService;
  before(() => {
    const logger = pino(getDefaultLoggerOptions({ level: "fatal" }));
    redis = new RedisService(logger);
  });
  it("setMessage", async () => {
    const ttl = 86400;
    const response = await redis.setMessage({
      topic: TEST_TOPIC,
      message: TEST_MESSAGE,
      ttl,
    });
    const result = await new Promise((resolve, reject) => {
      redis.client.ttl(`message:${TEST_TOPIC}`, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
    expect(result).to.be.eql(ttl);
  });
});
