import redis from "redis";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";
import { RelayTypes } from "@walletconnect/types";
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

  public async setPublished(params: RelayTypes.PublishParams) {
    this.logger.debug(`Setting Published`);
    this.logger.trace({ type: "method", method: "setPublished", params });
    await this.client.lpushAsync(`request:${params.topic}`, params.message);
    // TODO: need to handle ttl
    // await this.client.expireAsync(`request:${params.topic}`, params.ttl);
  }

  public async getPublished(topic: string) {
    return this.client.lrangeAsync(`request:${topic}`, 0, -1).then((raw: any) => {
      if (raw) {
        const data: string[] = raw.map((message: string) => message);
        this.client.del(`request:${topic}`);
        this.logger.debug(`Getting Published`);
        this.logger.trace({ type: "method", method: "getPublished", topic, data });
        return data;
      }
      return;
    });
  }

  public async setLegacyPublished(socketMessage: LegacySocketMessage) {
    this.logger.debug(`Setting Legacy Published`);
    this.logger.trace({ type: "method", method: "setLegacyPublished", socketMessage });
    await this.client.lpushAsync(`request:${socketMessage.topic}`, socketMessage.payload);
    // TODO: need to handle ttl
    // await this.client.expireAsync(`request:${params.topic}`, params.ttl);
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

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
  }
}
