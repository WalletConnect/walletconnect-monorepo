import "mocha";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { expect } from "chai";

import { RedisService } from "../src/redis";
import { ONE_DAY } from "../src/constants";

import { TEST_MESSAGE, TEST_TOPIC } from "./shared";

describe("Redis", () => {
  let redis: RedisService;
  before(() => {
    const logger = pino(getDefaultLoggerOptions({ level: "fatal" }));
    redis = new RedisService(logger);
  });
  it("setMessage", async () => {
    const params = {
      topic: TEST_TOPIC,
      message: TEST_MESSAGE,
      ttl: ONE_DAY,
    };
    await redis.setMessage(params);
    const result = await new Promise((resolve, reject) => {
      redis.client.ttl(`message:${params.topic}`, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
    expect(result).to.be.equal(params.ttl);
    expect(result).to.be.gte(params.ttl-1); // One second less
  });
});
