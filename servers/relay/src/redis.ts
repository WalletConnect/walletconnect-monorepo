import redis from "redis";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";
import { RelayJsonRpc } from "relay-provider";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";

import { Subscription, Notification, LegacySocketMessage } from "./types";
import bluebird from "bluebird";
import config from "./config";

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

export class RedisService {
  public client: any = redis.createClient(config.redis);

  public subs: Subscription[] = [];

  public context = "redis";

  constructor(public logger: Logger) {
    this.logger = generateChildLogger(logger, this.context);
    this.initialize();
  }

  public async setMessage(params: RelayJsonRpc.PublishParams) {
    this.logger.debug(`Setting Message`);
    this.logger.trace({ type: "method", method: "setMessage", params });
    await this.client.lpushAsync(`message:${params.topic}`, params.message);
    // TODO: need to handle ttl
    // await this.client.expireAsync(`message:${params.topic}`, params.ttl);
  }

  public async getMessages(topic: string) {
    return this.client.lrangeAsync(`message:${topic}`, 0, -1).then((raw: any) => {
      if (raw) {
        const data: string[] = raw.map((message: string) => message);
        // TODO: delete only after acknowledgement
        // this.client.del(`message:${topic}`);
        this.logger.debug(`Getting Message`);
        this.logger.trace({ type: "method", method: "getMessage", topic, data });
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
