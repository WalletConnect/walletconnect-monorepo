import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { safeJsonStringify } from "safe-json-utils";

import { SubscriptionService } from "./subscription";
import { NotificationService } from "./notification";
import { RedisService } from "./redis";
import { LegacySocketMessage, Subscription } from "./types";
import { WebSocketService } from "./ws";

export class LegacyService {
  public subscription: SubscriptionService;

  public context = "legacy";

  constructor(
    public logger: Logger,
    public redis: RedisService,
    public ws: WebSocketService,
    public notification: NotificationService,
  ) {
    this.logger = generateChildLogger(logger, this.context);
    this.redis = redis;
    this.ws = ws;
    this.notification = notification;
    this.subscription = new SubscriptionService(this.logger, this.redis);
    this.initialize();
  }

  public async onRequest(socketId: string, socketMessage: LegacySocketMessage) {
    this.logger.info(`Incoming Legacy Socket Message`);
    this.logger.debug({ type: "payload", direction: "incoming", payload: socketMessage });

    try {
      switch (socketMessage.type) {
        case "pub":
          await this.onPublishRequest(socketId, socketMessage);
          break;
        case "sub":
          await this.onSubscribeRequest(socketId, socketMessage);
          break;
        default:
          break;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
  }

  private async onSubscribeRequest(socketId: string, socketMessage: LegacySocketMessage) {
    const topic = socketMessage.topic;
    this.logger.debug(`Subscribe Request Received`);
    this.logger.trace({ type: "method", method: "onSubscribeRequest", socketMessage, socketId });
    const subscriber = { topic, socketId };

    await this.subscription.set(subscriber);

    await this.pushCachedMessages(socketId, topic);
  }

  private async onPublishRequest(socketId: string, socketMessage: LegacySocketMessage) {
    const subscribers = await this.subscription.get(socketMessage.topic, socketId);
    this.logger.debug(`Publish Request Received`);
    this.logger.trace({ type: "method", method: "onPublishRequest", socketMessage, socketId });

    if (!socketMessage.silent) {
      await this.notification.push(socketMessage.topic);
    }

    if (subscribers.length) {
      await Promise.all(
        subscribers.map((subscriber: Subscription) =>
          this.socketSend(subscriber.socketId, socketMessage),
        ),
      );
    } else {
      await this.redis.setLegacyPublished(socketMessage);
    }
  }

  private async pushCachedMessages(socketId: string, topic: string) {
    const messages = await this.redis.getLegacyPublished(topic);
    this.logger.debug(`Pushing Cached Messages`);
    this.logger.trace({ type: "method", method: "pushCachedMessages", messages, socketId });
    if (messages && messages.length) {
      await Promise.all(
        messages.map((message: LegacySocketMessage) => this.socketSend(socketId, message)),
      );
    }
  }

  private async socketSend(socketId: string, socketMessage: LegacySocketMessage) {
    const socket = this.ws.sockets.get(socketId);
    if (typeof socket === "undefined") {
      // TODO: handle this error better
      throw new Error("socket missing or invalid");
    }
    if (socket.readyState === 1) {
      const message = safeJsonStringify(socketMessage);
      socket.send(message);
      this.logger.info(`Outgoing Legacy Socket Message`);
      this.logger.debug({ type: "payload", direction: "outgoing", socketMessage, socketId });
    } else {
      await this.redis.setLegacyPublished(socketMessage);
    }
  }
}
