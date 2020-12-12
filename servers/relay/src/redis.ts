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
    let key =`message:${params.topic}`;
    let val = `${createHash('sha256').update(params.message).digest('hex')}:${params.message}`;
    await this.client.saddAsync(key, val);
    await this.client.expireAsync(key, params.ttl);
  }

  public async getPublished(topic: string) {
    let raw = await this.client.smembersAsync(`message:${topic}`)
    let data: string[] = [];
    if (raw) {
      data = raw.map((message: string) => message);
      this.logger.debug(`Getting Published`);
      this.logger.trace({ type: "method", method: "getPublished", topic, data });
    }
    return data;
  }

  public async deletePublished(topic: string, hash: string) {

    // we need an sscan to find the hash and then srem
    await this.client.srem(`pending:${topic}`);
  }


  public async setLegacyPublished(socketMessage: LegacySocketMessage) {
    this.logger.debug(`Setting Legacy Published`);
    this.logger.trace({ type: "method", method: "setLegacyPublished", socketMessage });
    await this.client.lpushAsync(`request:${socketMessage.topic}`, socketMessage.payload);
    await this.client.expireAsync(`request:${socketMessage.topic}`, config.REDIS_MAX_TTL);
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

  public async setPendingRequest(topic: string, id: number, message: string) {
    let key =`pending:${id}`;
    let val = `${topic}:${createHash('sha256').update(message).digest('hex')}`;
    await this.client.setAsync(key, val);
    await this.client.expireAsync(key, config.REDIS_MAX_TTL);
  }

  public async getPendingRequest(id: number) {
    return await this.client.getAsync(`pending:${id}`);
  }

  public async deletePendingRequest(id: number) {
    await this.client.del(`pending:${id}`);
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
  }
}
