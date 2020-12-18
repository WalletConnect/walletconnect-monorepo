import redis from "redis";
import { createHash } from "crypto";
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
    let key =`message:${params.topic}`;
    let val = `${createHash('sha256').update(params.message).digest('hex')}:${params.message}`;
    await this.client.saddAsync(key, val);
    await this.client.expireAsync(key, params.ttl);
  }

  public async getMessages(topic: string) {
    this.logger.debug(`Getting Message`);
    this.logger.trace({ type: "method", method: "getMessage", topic});
    let messages: Array<string> = [];
    (await this.client.smembersAsync(`message:${topic}`)).map((m: string) => {
      if (m != null ) {
        messages.push(m.split(":")[1]);
      }
    });
    return messages;
  }

  public async deleteMessage(topic: string, hash: string) {
    let [cursor, result] = await this.client.sscanAsync(`message:${topic}`, "0", "MATCH", `${hash}:*`)
    if (result) this.client.sremAsync(`message:${topic}`, result[0]);
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
    return this.client.getAsync(`pending:${id}`);
  }

  public async deletePendingRequest(id: number) {
    await this.client.del(`pending:${id}`)
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
  }
  /*
  private setScan(): Array<string> {
    this.ssetScan()
  }
  */
}
