import redis from "redis";
import { createHash } from "crypto";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";
import { RelayJsonRpc } from "relay-provider";
import { Logger } from "pino";

import { Subscription, Notification, Socket, LegacySocketMessage } from "./types";
import bluebird from "bluebird";
import config from "./config";
import { formatLoggerContext } from "./utils";


bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

export class RedisService {
  public client: any = redis.createClient(config.redis);
  public subs: Subscription[] = [];
  public context = "redis";

  constructor(public logger: Logger) {
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });
    this.initialize();
  }

  public async setPublished(params: RelayJsonRpc.PublishParams) {
    this.logger.debug(`Setting Published`);
    this.logger.trace({ type: "method", method: "setPublished", params });
    let key = `message:${params.topic}:${createHash('sha256').update(params.message).digest('hex')}`;
    await this.client.lpushAsync(key, params.message);
    await this.client.expireAsync(`message:${params.topic}`, params.ttl);
  }

  public async getPublished(topic: string) {
    let result = await this.client.scanAsync([0, 'MATCH', `message:${topic}:*`])
    console.log("DICK3");
    this.logger.info({type: "DICK2", result});
    let raw = await this.client.lrangeAsync(`message:${topic}`, 0, -1)
    let data: string[] = [];
    if (raw) {
      data = raw.map((message: string) => message);
      this.logger.debug(`Getting Published`);
      this.logger.trace({ type: "method", method: "getPublished", topic, data });
    }
    await this.client.del(`message:${topic}`)
    return data;
  }

  public async setLegacyPublished(socketMessage: LegacySocketMessage) {
    this.logger.debug(`Setting Legacy Published`);
    this.logger.trace({ type: "method", method: "setLegacyPublished", socketMessage });
    await this.client.lpushAsync(`request:${socketMessage.topic}`, socketMessage.payload);
    //TODO CHANGE ttl to get default
    await this.client.expireAsync(`request:${socketMessage.topic}`, 1);
  }

  public async getLegacyPublished(topic: string) {
    return this.client.lrangeAsync(`request:${topic}`, 0, -1).then((raw: any) => {
      if (raw) {
        const data: string[] = raw.map((message: string) => message);
        this.client.del(`request:${topic}`);
        this.logger.debug(`Getting Legacy Published`);
        this.logger.trace({ type: "method", method: "getLegacyPublished", topic, data });
        return data;
      }
      return;
    });
  }

  public setNotification(notification: Notification) {
    this.logger.debug(`Setting Notification`);
    this.logger.trace({ type: "method", method: "setNotification", notification });
    return this.client.lpushAsync(
      `notification:${notification.topic}`,
      safeJsonStringify(notification),
    );
  }

  public getNotification(topic: string) {
    return this.client.lrangeAsync(`notification:${topic}`, 0, -1).then((raw: any) => {
      if (raw) {
        const data = raw.map((item: string) => safeJsonParse(item));
        this.logger.debug(`Getting Notification`);
        this.logger.trace({ type: "method", method: "getNotification", topic, data });
        return data;
      }
      return;
    });
  }

  public setPendingRequest(topic: string, hash: string) {
  }

  public getPendingRequest(topic: string, hash: string) {
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
  }
}
