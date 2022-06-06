import { createClient, commandOptions, RedisClientType } from "redis";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { Logger } from "pino";
import { generateChildLogger } from "@walletconnect/logger";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { SIX_HOURS } from "@walletconnect/time";
import * as encoding from "@walletconnect/encoding";

import { sha256 } from "./utils";
import { HttpService } from "./http";
import {
  EMPTY_STREAM,
  SPECIAL_ID,
  REDIS_CONTEXT,
  NETWORK_EVENTS,
  JSONRPC_EVENTS,
} from "./constants";
import {
  IridiumV1MessageOptions,
  StreamsMessagesReply,
  StreamMessagesReply,
  Notification,
  LegacySocketMessage,
  Subscription,
} from "./types";
import { IridiumEncoder } from "./encoder";

// TODO this RedisClass should be able to handle and compare the special id '$'
export class RedisStreamID extends String {
  private sequence: number;
  private timestamp: number;
  constructor(value: string) {
    super(value);
    if (!value.includes("-")) throw new Error("Input value does not have valid Redis Stream ID");
    const [timestamp, sequence] = value.split("-");
    this.sequence = encoding.utf8ToNumber(sequence);
    this.timestamp = encoding.utf8ToNumber(timestamp);
  }

  isHigher(id: RedisStreamID): boolean {
    const [ts, seq] = id.split("-");
    const sequence = encoding.utf8ToNumber(seq);
    const timestamp = encoding.utf8ToNumber(ts);
    if (this.timestamp > timestamp) return true;
    if (this.sequence > sequence) return true;
    return false;
  }
}

export class RedisService {
  public client: RedisClientType;
  public context = REDIS_CONTEXT;
  public encoder = new IridiumEncoder();
  public streamIds = new Map<string, string>();

  constructor(public server: HttpService, public logger: Logger) {
    this.server = server;
    this.client = createClient({ url: this.server.config.redis.url });
    this.logger = generateChildLogger(logger, this.context);
    this.initialize();
  }

  get connected(): boolean {
    return this.client.isOpen;
  }

  public async setMessage(params: RelayJsonRpc.PublishParams): Promise<void> {
    const { topic, message, ttl } = params;
    this.logger.debug(`Setting Message`);
    this.logger.trace({ type: "method", method: "setMessage", params });
    const key = `message:${topic}`;
    const hash = sha256(message);
    const val = `${hash}:${message}`;
    await this.client.sAdd(key, val);
    await this.client.expire(key, ttl);
  }

  public async getMessage(topic: string, hash: string): Promise<string | undefined> {
    this.logger.debug(`Getting Message`);
    this.logger.trace({ type: "method", method: "getMessage", topic });
    const options = { MATCH: `${hash}:*` };
    let message: string | undefined;
    for await (const member of this.client.sScanIterator(`message:${topic}`, options)) {
      message = member.split(":")[1];
    }
    return message;
  }

  public async getMessages(topic: string): Promise<string[]> {
    this.logger.debug(`Getting Message`);
    this.logger.trace({ type: "method", method: "getMessages", topic });
    const result = await this.client.sMembers(`message:${topic}`);
    const messages: string[] = [];
    if (typeof result !== "undefined" && result.length) {
      result.forEach((m: string) => {
        if (m != null) messages.push(m.split(":")[1]);
      });
    }
    return messages;
  }

  public async deleteMessage(topic: string, hash: string): Promise<void> {
    this.logger.debug(`Deleting Message`);
    this.logger.trace({ type: "method", method: "deleteMessage", topic });
    const options = { MATCH: `${hash}:*` };
    for await (const member of this.client.sScanIterator(`message:${topic}`, options)) {
      await this.client.sRem(`message:${topic}`, member);
    }
  }

  public async setLegacyCached(message: LegacySocketMessage): Promise<void> {
    this.logger.debug(`Setting Legacy Cached`);
    this.logger.trace({ type: "method", method: "setLegacyCached", message });
    await this.client.lPush(`legacy:${message.topic}`, safeJsonStringify(message));
    await this.client.expire(`legacy:${message.topic}`, SIX_HOURS);
  }

  public async getLegacyCached(topic: string): Promise<LegacySocketMessage[]> {
    const result = await this.client.lRange(`legacy:${topic}`, 0, -1);
    const messages: LegacySocketMessage[] = [];
    if (typeof result !== "undefined" && result.length) {
      result.forEach((data: string) => {
        const message = safeJsonParse(data);
        messages.push(message);
      });
    }
    this.client.del(`legacy:${topic}`);
    this.logger.debug(`Getting Legacy Published`);
    this.logger.trace({ type: "method", method: "getLegacyCached", topic, messages });
    return messages;
  }

  public async setNotification(notification: Notification): Promise<void> {
    this.logger.debug(`Setting Notification`);
    this.logger.trace({ type: "method", method: "setNotification", notification });
    await this.client.lPush(`notification:${notification.topic}`, safeJsonStringify(notification));
  }

  public async getNotification(topic: string): Promise<Notification[]> {
    const result = await this.client.lRange(`notification:${topic}`, 0, -1);
    const notifications: Notification[] = [];
    if (typeof result !== "undefined" && result.length) {
      result.forEach((item: string) => {
        const notification = safeJsonParse(item);
        notifications.push(notification);
      });
    }
    this.logger.debug(`Getting Notification`);
    this.logger.trace({ type: "method", method: "getNotification", topic, notifications });
    return notifications;
  }

  public async setPendingRequest(topic: string, id: number, message: string): Promise<void> {
    const key = `pending:${id}`;
    const hash = sha256(message);
    const val = `${topic}:${hash}`;
    this.logger.debug(`Setting Pending Request`);
    this.logger.trace({ type: "method", method: "setPendingRequest", topic, id, message });
    await this.client.set(key, val);
    await this.client.expire(key, this.server.config.maxTTL);
  }

  public async getPendingRequest(id: number): Promise<string | null> {
    this.logger.debug(`Getting Pending Request`);
    const data = await this.client.get(`pending:${id}`);
    this.logger.trace({ type: "method", method: "getPendingRequest", id, data });
    return data;
  }

  public async deletePendingRequest(id: number): Promise<void> {
    this.logger.debug(`Deleting Pending Request`);
    this.logger.trace({ type: "method", method: "deletePendingRequest", id });
    await this.client.del(`pending:${id}`);
  }

  public async publish(topic: string, message: string, opts?: IridiumV1MessageOptions) {
    this.logger.debug("Publish Iridium Message");
    this.logger.trace({ method: "publish", topic, message, opts });
    const payload = await this.encoder.encode(message, opts);
    await this.client.xAdd(topic, "*", { payload });
  }

  public async getStoreMessages(topic: string): Promise<void> {
    this.logger.debug("Getting Iridium Historical");
    const response = (await this.client.xRange(topic, "-", "+")) as StreamMessagesReply;
    this.logger.trace({ method: "getStoreMessages", topic, response });
    this.handleHistoricalMessages(response, topic);
  }

  public removeStream(topic: string) {
    this.logger.debug("Removing topic from 'streamIDs'");
    this.logger.trace({ method: "removeStream", topic });
    this.streamIds.delete(topic);
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.client.on("error", (e) => {
      this.logger.error(e);
    });

    this.client.connect();
    this.streamIds.set(EMPTY_STREAM, SPECIAL_ID);
    this.client.on("ready", () => {
      this.logger.trace("Initialized");
      this.streamListener();
      this.server.on(JSONRPC_EVENTS.subscribe, (sub: Subscription) => {
        this.onSubscribe(sub);
      });
    });
  }

  private onSubscribe(subscription: Subscription) {
    this.logger.debug("Iridium Subscribe Event");
    const streamId = this.streamIds.get(subscription.topic);
    this.logger.trace({ method: "onSubscribe", subscription, streamId });
    if (typeof streamId === "undefined") {
      this.streamIds.set(subscription.topic, SPECIAL_ID);
    }
    this.getStoreMessages(subscription.topic);
  }

  private async streamListener(): Promise<void> {
    const streams: Array<{ key: string; id: string }> = [];
    for (const [key, value] of this.streamIds.entries()) {
      streams.push({ key, id: value.toString() });
    }
    //this.logger.trace("Starting Redis Stream")
    //this.logger.trace({ method: "streamListener", streams });
    const response = (await this.client.xRead(commandOptions({ isolated: true }), streams, {
      BLOCK: 1000,
    })) as StreamsMessagesReply | null;

    console.log("1212", response);
    if (response !== null) this.handleStreamMessages(response);
    setTimeout(async () => {
      this.streamListener();
    }, 0);
  }

  private async emitIridiumMessage(topic: string, payload: string) {
    this.logger.debug("Received Iridium Message");
    const {
      message,
      opts: { prompt },
    } = await this.encoder.decode(payload);
    this.logger.trace({ method: `emitIridiumMessage`, topic, message, prompt });
    this.server.events.emit(NETWORK_EVENTS.message, topic, message, prompt);
  }

  private handleHistoricalMessages(stream: StreamMessagesReply, topic: string) {
    this.logger.trace({ method: "handleHistoricalMessages", topic, stream });
    for (const msg of stream) {
      this.emitIridiumMessage(topic, msg.message.payload as string);
    }
  }

  private handleStreamMessages(streams: StreamsMessagesReply) {
    this.logger.trace({ method: "handleStreamMessages", streams });
    for (const stream of streams) {
      for (const msg of stream.messages) {
        // TODO, check that these are not Buffer type
        this.updateStreamID(stream.name as string, msg.id as string);
        this.emitIridiumMessage(stream.name as string, msg.message.payload as string);
      }
    }
  }

  private updateStreamID(topic: string, id: string) {
    const streamId = this.streamIds.get(topic);
    if (typeof streamId === "undefined") {
      this.logger.error({
        method: "updateStreamToHigherValue",
        message: `topic: '${topic}' not found in streamID map`,
      });
      return;
    }
    const newId = new RedisStreamID(id);
    const oldId = new RedisStreamID(streamId);
    this.logger.trace({ method: "updateStreamID", old: streamId, new: newId });
    if (newId.isHigher(oldId)) {
      this.logger.trace({ method: "updateStreamID", old: streamId, new: newId });
      this.streamIds.set(topic, newId.toString());
    }
  }
}
