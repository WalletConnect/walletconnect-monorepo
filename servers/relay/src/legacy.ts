import EventEmitter from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { safeJsonStringify } from "safe-json-utils";

import { SubscriptionService } from "./subscription";
import { NotificationService } from "./notification";
import { RedisService } from "./redis";
import { LegacySocketMessage, Subscription } from "./types";
import { WebSocketService } from "./ws";
import { HttpService } from "./http";
import { EMPTY_SOCKET_ID, LEGACY_EVENTS } from "./constants";

export class LegacyService {
  public events = new EventEmitter();

  public subscription: SubscriptionService;

  public context = "legacy";

  constructor(
    public server: HttpService,
    public logger: Logger,
    public redis: RedisService,
    public ws: WebSocketService,
    public notification: NotificationService,
  ) {
    this.server = server;
    this.logger = generateChildLogger(logger, this.context);
    this.redis = redis;
    this.ws = ws;
    this.notification = notification;
    this.subscription = new SubscriptionService(this.server, this.logger, this.ws);
    this.initialize();
  }

  public async onRequest(socketId: string, message: LegacySocketMessage) {
    this.logger.info(`Incoming Legacy Socket Message`);
    this.logger.debug({ type: "payload", direction: "incoming", payload: message });

    try {
      switch (message.type) {
        case "pub":
          await this.onPublishRequest(socketId, message);
          break;
        case "sub":
          await this.onSubscribeRequest(socketId, message);
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
    this.registerEventListeners();
  }

  private registerEventListeners() {
    this.events.on(LEGACY_EVENTS.publish, (socketId: string, message: LegacySocketMessage) =>
      this.onNewMessage(message, socketId),
    );
    this.events.on(LEGACY_EVENTS.subscribe, (socketId: string, topic: string) =>
      this.onNewSubscription(socketId, topic),
    );
  }

  private async onPublishRequest(socketId: string, message: LegacySocketMessage) {
    this.logger.debug(`Publish Request Received`);
    this.logger.trace({ type: "method", method: "onPublishRequest", socketId, message });
    this.events.emit(LEGACY_EVENTS.publish, socketId, message);
  }

  private async onNewMessage(
    message: LegacySocketMessage,
    socketId = EMPTY_SOCKET_ID,
  ): Promise<boolean> {
    if (!message.silent) {
      await this.notification.push(message.topic);
    }
    await this.checkActiveSubscriptions(socketId, message);
    return true;
  }

  private async onSubscribeRequest(socketId: string, message: LegacySocketMessage) {
    const topic = message.topic;
    this.logger.debug(`Subscribe Request Received`);
    this.logger.trace({ type: "method", method: "onSubscribeRequest", socketId, message });
    const subscriber = { topic, socketId };

    this.subscription.set(subscriber);
    this.events.emit(LEGACY_EVENTS.subscribe, socketId, message);
  }
  private async onNewSubscription(socketId: string, topic: string): Promise<void> {
    await this.checkCachedMessages(socketId, topic);
  }

  private async checkActiveSubscriptions(socketId: string, message: LegacySocketMessage) {
    this.logger.debug(`Checking Active subscriptions`);
    this.logger.trace({ type: "method", method: "checkActiveSubscriptions", socketId, message });
    const subscriptions = this.subscription.get(message.topic, socketId);
    this.logger.debug(`Found ${subscriptions.length} subscriptions`);
    this.logger.trace({ type: "method", method: "checkActiveSubscriptions", subscriptions });
    if (subscriptions.length) {
      await Promise.all(
        subscriptions.map((subscriber: Subscription) =>
          this.pushSubscription(subscriber.socketId, message),
        ),
      );
    } else {
      await this.redis.setLegacyCached(message);
    }
  }

  private async checkCachedMessages(socketId: string, topic: string) {
    this.logger.debug(`Checking Cached Messages`);
    this.logger.trace({ type: "method", method: "checkCachedMessages", socketId, topic });
    const messages = await this.redis.getLegacyCached(topic);
    this.logger.debug(`Found ${messages.length} cached messages`);
    this.logger.trace({ type: "method", method: "checkCachedMessages", messages });
    if (messages && messages.length) {
      await Promise.all(
        messages.map((message: LegacySocketMessage) => this.pushSubscription(socketId, message)),
      );
    }
  }

  private async pushSubscription(socketId: string, message: LegacySocketMessage): Promise<void> {
    this.socketSend(socketId, message);
  }

  private async socketSend(socketId: string, message: LegacySocketMessage) {
    try {
      this.ws.send(socketId, safeJsonStringify(message));
      this.logger.info(`Outgoing Legacy Socket Message`);
      this.logger.debug({ type: "payload", direction: "outgoing", socketId, message });
    } catch (e) {
      await this.onFailedPush(message);
    }
  }

  private async onFailedPush(message: LegacySocketMessage): Promise<void> {
    await this.redis.setLegacyCached(message);
  }
}
