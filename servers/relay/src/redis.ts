import redis from "redis";
import { RelayJsonRpc } from "relay-provider";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";

import config from "./config";
import { sha256 } from "./utils";
import { REDIS_CONTEXT, SIX_HOURS } from "./constants";
import { Notification, LegacySocketMessage } from "./types";

export class RedisService {
  public client: any = redis.createClient(config.redis);
  public context = REDIS_CONTEXT;

  constructor(public logger: Logger) {
    this.logger = generateChildLogger(logger, this.context);
    this.initialize();
  }

  public setMessage(params: RelayJsonRpc.PublishParams): Promise<void> {
    return new Promise((resolve, reject) => {
      const { topic, message, ttl } = params;
      this.logger.debug(`Setting Message`);
      this.logger.trace({ type: "method", method: "setMessage", params });
      const key = `message:${topic}`;
      const hash = sha256(message);
      const val = `${hash}:${message}`;
      this.client.sadd(key, val, (err: Error) => {
        if (err) reject(err);
        this.client.expire(key, ttl, (err: Error) => {
          if (err) reject(err);
          resolve();
        });
      });
    });
  }

  public async getMessage(topic: string, hash: string): Promise<string> {
    this.logger.debug(`Getting Message`);
    this.logger.trace({ type: "method", method: "getMessage", topic });
    return (await this.sscan(`message:${topic}`, "MATCH", `${hash}:*`))[0]?.split(":")[1];
  }

  public getMessages(topic: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`Getting Message`);
      this.logger.trace({ type: "method", method: "getMessage", topic });
      this.client.smembers(`message:${topic}`, (err: Error, res: string[]) => {
        if (err) reject(err);
        const messages: string[] = [];
        res.map((m: string) => {
          if (m != null) messages.push(m.split(":")[1]);
        });
        resolve(messages);
      });
    });
  }

  public deleteMessage(topic: string, hash: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      this.logger.debug(`Deleting Message`);
      this.logger.trace({ type: "method", method: "deleteMessage", topic });
      const res = await this.sscan(`message:${topic}`, "MATCH", `${hash}:*`);
      if (res.length) {
        this.client.srem(`message:${topic}`, res[0], (err: Error) => {
          if (err) reject(err);
          resolve();
        });
      }
    });
  }

  public setLegacyCached(message: LegacySocketMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`Setting Legacy Cached`);
      this.logger.trace({ type: "method", method: "setLegacyCached", message });
      this.client.lpush(
        [`legacy:${message.topic}`, safeJsonStringify(message)],
        (err: Error, res) => {
          if (err) reject(err);
          this.client.expire([`legacy:${message.topic}`, SIX_HOURS], (err: Error, res) => {
            if (err) reject(err);
            resolve();
          });
        },
      );
    });
  }

  public getLegacyCached(topic: string): Promise<LegacySocketMessage[]> {
    return new Promise((resolve, reject) => {
      this.client.lrange(`legacy:${topic}`, 0, -1, (err: Error, raw: any) => {
        if (err) reject(err);
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

  public setNotification(notification: Notification): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`Setting Notification`);
      this.logger.trace({ type: "method", method: "setNotification", notification });
      this.client.lpush(
        [`notification:${notification.topic}`, safeJsonStringify(notification)],
        (err: Error) => {
          if (err) reject(err);
          resolve();
        },
      );
    });
  }

  public getNotification(topic: string): Promise<Notification[]> {
    return new Promise((resolve, reject) => {
      this.client.lrange([`notification:${topic}`, 0, -1], (err: Error, raw: any) => {
        if (err) reject(err);
        const data = raw.map((item: string) => safeJsonParse(item));
        this.logger.debug(`Getting Notification`);
        this.logger.trace({ type: "method", method: "getNotification", topic, data });
        resolve(data);
      });
    });
  }

  public setPendingRequest(topic: string, id: number, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const key = `pending:${id}`;
      const hash = sha256(message);
      const val = `${topic}:${hash}`;
      this.logger.debug(`Setting Pending Request`);
      this.logger.trace({ type: "method", method: "setPendingRequest", topic, id, message });
      this.client.set(key, val, (err: Error) => {
        if (err) reject(err);
        this.client.expire(key, config.REDIS_MAX_TTL, (err: Error) => {
          if (err) reject(err);
          resolve();
        });
      });
    });
  }

  public getPendingRequest(id: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.get(`pending:${id}`, (err: Error, data: string) => {
        if (err) reject(err);
        this.logger.debug(`Getting Pending Request`);
        this.logger.trace({ type: "method", method: "getPendingRequest", id, data });
        resolve(data);
      });
    });
  }

  public deletePendingRequest(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`Deleting Pending Request`);
      this.logger.trace({ type: "method", method: "deletePendingRequest", id });
      this.client.del(`pending:${id}`, (err: Error) => {
        if (err) reject(err);
        resolve();
      });
    });
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
  }

  private sscanAsync(
    key: string,
    match: string,
    pattern: string,
    cursor: string,
  ): Promise<[string, string[]]> {
    return new Promise((resolve, reject) => {
      this.client.sscan(key, cursor, match, pattern, (err: Error, result: [string, string[]]) => {
        if (err) reject(err);
        resolve(result);
      });
    });
  }

  private async sscan(key: string, match = "", pattern = "", cursor = "0"): Promise<string[]> {
    const messages: string[] = [];
    const [nextCursor, values] = await this.sscanAsync(key, match, pattern, cursor);
    values.forEach((m: string) => {
      if (m != null) messages.push(m);
    });
    if (nextCursor == "0") {
      return messages;
    }
    return [...messages, ...(await this.sscan(key, match, pattern, nextCursor))];
  }
}
