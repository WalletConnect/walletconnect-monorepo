import { formatLoggerContext } from "./utils";
import { Logger } from "pino";
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
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });
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

    const subscriber = { topic, socketId };

    await this.subscription.set(subscriber);

    await this.pushPendingPublished(socketId, topic);
  }

  private async onPublishRequest(socketId: string, socketMessage: LegacySocketMessage) {
    const subscribers = await this.subscription.get(socketMessage.topic, socketId);

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

  private async pushPendingPublished(socketId: string, topic: string) {
    const pending = await this.redis.getLegacyPublished(topic);

    if (pending && pending.length) {
      await Promise.all(
        pending.map((pendingMessage: LegacySocketMessage) =>
          this.socketSend(socketId, pendingMessage),
        ),
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
      this.logger.info(`Outgoing JSON-RPC Payload`);
      this.logger.debug({ type: "payload", direction: "outgoing", payload: socketMessage });
    } else {
      await this.redis.setLegacyPublished(socketMessage);
    }
  }
}
