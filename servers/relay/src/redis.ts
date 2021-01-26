import redis from "redis";
import bluebird from "bluebird";
import { RelayJsonRpc } from "relay-provider";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";

import config from "./config";
import { sha256 } from "./utils";
import { Subscription, Notification, LegacySocketMessage } from "./types";

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
    const { topic, message, ttl } = params;
    this.logger.debug(`Setting Message`);
    this.logger.trace({ type: "method", method: "setMessage", params });
    const key = `message:${topic}`;
    const hash = sha256(message);
    const val = `${hash}:${message}`;
    await this.client.saddAsync(key, val);
    await this.client.expireAsync(key, ttl);
  }

  public async getMessages(topic: string) {
    this.logger.debug(`Getting Message`);
    this.logger.trace({ type: "method", method: "getMessage", topic });
    const messages: Array<string> = [];
    (await this.client.smembersAsync(`message:${topic}`)).map((m: string) => {
      if (m != null) {
        messages.push(m.split(":")[1]);
      }
    });
    return messages;
  }

  public async deleteMessage(topic: string, hash: string) {
    const [cursor, result] = await this.client.sscanAsync(
      `message:${topic}`,
      "0",
      "MATCH",
      `${hash}:*`,
    );
    if (result) this.client.sremAsync(`message:${topic}`, result[0]);
  }

  public async setLegacyCached(message: LegacySocketMessage) {
    this.logger.debug(`Setting Legacy Cached`);
    this.logger.trace({ type: "method", method: "setLegacyCached", message });
    await this.client.lpushAsync(`legacy:${message.topic}`, safeJsonStringify(message));
    const sixHours = 21600;
    await this.client.expireAsync(`legacy:${message.topic}`, sixHours);
  }

  public async getLegacyCached(topic: string) {
    return this.client.lrangeAsync(`legacy:${topic}`, 0, -1).then((raw: any) => {
      if (raw) {
        const hashes: string[] = [];
        const messages: LegacySocketMessage[] = [];
        raw.forEach((data: string) => {
          const hash = sha256(data);
          if (hashes.includes(hash)) return;
          hashes.push(hash);
          const message = safeJsonParse(data);
          messages.push(message);
        });
        this.client.del(`legacy:${topic}`);
        this.logger.debug(`Getting Legacy Published`);
        this.logger.trace({ type: "method", method: "getLegacyCached", topic, messages });
        return messages;
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
    const key = `pending:${id}`;
    const hash = sha256(message);
    const val = `${topic}:${hash}`;
    await this.client.setAsync(key, val);
    await this.client.expireAsync(key, config.REDIS_MAX_TTL);
  }

  public async getPendingRequest(id: number) {
    return this.client.getAsync(`pending:${id}`);
  }

  public async deletePendingRequest(id: number) {
    await this.client.del(`pending:${id}`);
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
