import redis from "redis";
import { RelayJsonRpc } from "relay-provider";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";

import config from "./config";
import { sha256 } from "./utils";
import { Subscription, Notification, LegacySocketMessage } from "./types";

export class RedisService {
  public client: any = redis.createClient(config.redis);
  public subs: Subscription[] = [];
  public context = "redis";

  constructor(public logger: Logger) {
    this.logger = generateChildLogger(logger, this.context);
    this.initialize();
  }

  public async setMessage(params: RelayJsonRpc.PublishParams) {
    const { topic, message, ttl } = params;
    this.logger.debug(`Setting Message`);
    this.logger.trace({ type: "method", method: "setMessage", params });
    const key = `message:${topic}`;
    const hash = sha256(message);
    const val = `${hash}:${message}`;
    this.client.sadd(key, val)
    this.client.expire(key, ttl)
  }

  public async getMessages(topic: string): Promise<Array<string>> {
    this.logger.debug(`Getting Message`);
    this.logger.trace({ type: "method", method: "getMessage", topic });
    const messages: Array<string> = [];
    return new Promise((resolve, reject) => {
        this.client.smembers(`message:${topic}`, (err, res) => {
        res.map((m: string) => {
          if (m != null) {
            messages.push(m.split(":")[1]);
          }
        })
        resolve(messages);
      });
    });
  }

  public async deleteMessage(topic: string, hash: string) {
    this.client.sscan(
      `message:${topic}`,
      "0",
      "MATCH",
      `${hash}:*`,
      (err, res) => {
        if (res) this.client.srem(`message:${topic}`, res[0])
      }
    )
  }

  public async setLegacyCached(message: LegacySocketMessage) {
    this.logger.debug(`Setting Legacy Cached`);
    this.logger.trace({ type: "method", method: "setLegacyCached", message });
    this.client.lpush([`legacy:${message.topic}`, safeJsonStringify(message)], (err, res) => {
      const sixHours = 21600;
      this.client.expire([`legacy:${message.topic}`, sixHours])
    });
  }

  public getLegacyCached(topic: string): Promise<Array<LegacySocketMessage>> {
    return new Promise((resolve, reject) => {
      this.client.lrange(`legacy:${topic}`, 0, -1, (err, raw: any) => {
        const messages: LegacySocketMessage[] = [];
        raw.forEach((data: string) => {
          const message = safeJsonParse(data);
          messages.push(message);
        });
        this.client.del(`legacy:${topic}`);
        this.logger.debug(`Getting Legacy Published`);
        this.logger.trace({ type: "method", method: "getLegacyCached", topic, messages });
        resolve(messages);
      });
    });
  }

  public setNotification(notification: Notification) {
    this.logger.debug(`Setting Notification`);
    this.logger.trace({ type: "method", method: "setNotification", notification });
    this.client.lpush([
      `notification:${notification.topic}`,
      safeJsonStringify(notification)
    ])
  }

  public getNotification(topic: string): Promise<Array<Notification>> {
    return new Promise((resolve, reject) => {
      return this.client.lrange([`notification:${topic}`, 0, -1], (err, raw) => {
          const data = raw.map((item: string) => safeJsonParse(item));
          this.logger.debug(`Getting Notification`);
          this.logger.trace({ type: "method", method: "getNotification", topic, data });
          resolve(data);
      });
    })
  }

  public async setPendingRequest(topic: string, id: number, message: string) {
    const key = `pending:${id}`;
    const hash = sha256(message);
    const val = `${topic}:${hash}`;
    await this.client.set(key, val);
    await this.client.expire(key, config.REDIS_MAX_TTL);
  }

  public async getPendingRequest(id: number): Promise<string> {
    return new Promise((resolve) => {
      resolve(this.client.get(`pending:${id}`));
    })
  }

  public async deletePendingRequest(id: number) {
    this.client.del(`pending:${id}`);
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
