import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { safeJsonStringify } from "safe-json-utils";

import { LegacySocketMessage, Subscription } from "./types";
import { HttpService } from "./http";
import { LEGACY_CONTEXT, LEGACY_MESSAGE_TYPE, LEGACY_EVENTS } from "./constants";

export class LegacyService {
  public context = LEGACY_CONTEXT;

  constructor(public server: HttpService, public logger: Logger) {
    this.server = server;
    this.logger = generateChildLogger(logger, this.context);
    this.initialize();
  }

  public async onRequest(socketId: string, message: LegacySocketMessage) {
    this.logger.info(`Incoming Legacy Socket Message`);
    this.logger.debug({ type: "payload", direction: "incoming", payload: message });

    try {
      switch (message.type) {
        case LEGACY_MESSAGE_TYPE.pub:
          await this.onPublishRequest(socketId, message);
          break;
        case LEGACY_MESSAGE_TYPE.sub:
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
    this.server.events.on(
      LEGACY_EVENTS.publish,
      async (socketId: string, message: LegacySocketMessage) =>
        await this.checkActiveSubscriptions(socketId, message),
    );
    this.server.events.on(
      LEGACY_EVENTS.subscribe,
      async (socketId: string, message: LegacySocketMessage) =>
        await this.checkCachedMessages(socketId, message.topic),
    );
  }

  private async onPublishRequest(socketId: string, message: LegacySocketMessage) {
    this.logger.debug(`Publish Request Received`);
    this.logger.trace({ type: "method", method: "onPublishRequest", socketId, message });
    this.server.events.emit(LEGACY_EVENTS.publish, socketId, message);
  }

  private async onSubscribeRequest(socketId: string, message: LegacySocketMessage) {
    const topic = message.topic;
    this.logger.debug(`Subscribe Request Received`);
    this.logger.trace({ type: "method", method: "onSubscribeRequest", socketId, message });
    const subscriber = { topic, socketId };
    this.server.subscription.set(subscriber, true);
    this.server.events.emit(LEGACY_EVENTS.subscribe, socketId, message);
  }

  private async checkActiveSubscriptions(socketId: string, message: LegacySocketMessage) {
    this.logger.debug(`Checking Active subscriptions`);
    this.logger.trace({ type: "method", method: "checkActiveSubscriptions", socketId, message });
    const subscriptions = this.server.subscription.get(message.topic, socketId, true);
    this.logger.debug(`Found ${subscriptions.length} subscriptions`);
    this.logger.trace({ type: "method", method: "checkActiveSubscriptions", subscriptions });
    if (subscriptions.length) {
      await Promise.all(
        subscriptions.map((subscriber: Subscription) =>
          this.pushSubscription(subscriber.socketId, message),
        ),
      );
    } else {
      await this.server.redis.setLegacyCached(message);
    }
  }

  private async checkCachedMessages(socketId: string, topic: string) {
    this.logger.debug(`Checking Cached Messages`);
    this.logger.trace({ type: "method", method: "checkCachedMessages", socketId, topic });
    const messages = await this.server.redis.getLegacyCached(topic);
    this.logger.debug(`Found ${messages.length} cached messages`);
    this.logger.trace({ type: "method", method: "checkCachedMessages", messages });
    if (messages && messages.length) {
      await Promise.all(
        messages.map((message: LegacySocketMessage) => this.pushSubscription(socketId, message)),
      );
    }
  }

  private async pushSubscription(socketId: string, message: LegacySocketMessage) {
    const success = this.server.ws.send(socketId, safeJsonStringify(message));
    if (success) {
      this.logger.info(`Outgoing Legacy Socket Message`);
      this.logger.debug({ type: "payload", direction: "outgoing", socketId, message });
    } else {
      await this.server.redis.setLegacyCached(message);
    }
  }
}
