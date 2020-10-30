import redis from "redis";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";
import { RelayTypes } from "@walletconnect/types";
import { Logger } from "pino";

import { Subscription, Notification, Socket } from "./types";
import bluebird from "bluebird";
import config from "./config";
import { formatLoggerContext } from "@walletconnect/utils";

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

export class RedisStore {
  public client: any = redis.createClient(config.redis);

  public subs: Subscription[] = [];

  public context = "redis";

  constructor(public logger: Logger) {
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });
    this.initialize();
  }

  public setSub(subscriber: Subscription): void {
    this.logger.debug({ type: "method", method: "setSub", topic: subscriber.topic });
    this.subs.push(subscriber);
  }

  public getSub(topic: string, senderSocket: Socket): Subscription[] {
    const match = this.subs.filter(
      sub => sub.topic === topic && sub.socket !== senderSocket && sub.socket.readyState === 1,
    );
    this.logger.debug({ type: "method", method: "getSub", topic, length: match.length });
    return match;
  }

  public removeSub(subscriber: Subscription): void {
    this.logger.debug({ type: "method", method: "removeSub", topic: subscriber.topic });
    this.subs = this.subs.filter(
      sub => sub.topic !== subscriber.topic && sub.socket !== subscriber.socket,
    );
  }

  public async setPub(params: RelayTypes.PublishParams) {
    this.logger.debug({ type: "method", method: "setPub", params });
    await this.client.lpushAsync(`request:${params.topic}`, params.message);
    // TODO: need to handle ttl
    // await this.client.expireAsync(`request:${params.topic}`, params.ttl);
  }

  public async getPub(topic: string) {
    return this.client.lrangeAsync(`request:${topic}`, 0, -1).then((raw: any) => {
      if (raw) {
        const data: string[] = raw.map((message: string) => message);
        this.client.del(`request:${topic}`);
        this.logger.debug({ type: "method", method: "getPub", topic, data });
        return data;
      }
      return;
    });
  }

  public setNotification(notification: Notification) {
    this.logger.info(`Notification Request Received`);
    this.logger.debug({ type: "method", method: "setNotification", notification });
    return this.client.lpushAsync(
      `notification:${notification.topic}`,
      safeJsonStringify(notification),
    );
  }

  public getNotification(topic: string) {
    return this.client.lrangeAsync(`notification:${topic}`, 0, -1).then((raw: any) => {
      if (raw) {
        const data = raw.map((item: string) => safeJsonParse(item));
        this.logger.debug({ type: "method", method: "getNotification", topic, data });
        return data;
      }
      return;
    });
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace({ type: "init" });
  }
}
