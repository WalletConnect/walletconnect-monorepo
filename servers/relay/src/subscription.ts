import { formatLoggerContext, generateRandomBytes32 } from "./utils";
import { Logger } from "pino";

import { RedisService } from "./redis";
import { Subscription } from "./types";

export class SubscriptionService {
  public subscriptions: Subscription[] = [];

  public context = "subscription";

  constructor(public logger: Logger, public redis: RedisService) {
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });
    this.redis = redis;
    this.initialize();
  }

  public set(subscription: Omit<Subscription, "id">): string {
    const id = generateRandomBytes32();
    this.logger.debug(`Setting Subscription`);
    this.logger.trace({ type: "method", method: "set", topic: subscription.topic });
    this.subscriptions.push({ ...subscription, id });
    return id;
  }

  public get(topic: string, senderSocketId: string): Subscription[] {
    const subscriptions = this.subscriptions.filter(
      sub => sub.topic === topic && sub.socketId !== senderSocketId,
    );
    this.logger.debug(`Getting Subscriptions`);
    this.logger.trace({ type: "method", method: "get", topic, subscriptions });
    return subscriptions;
  }

  public remove(id: string): void {
    this.logger.debug(`Removing Subscription`);
    this.logger.trace({ type: "method", method: "remove", id });
    this.subscriptions = this.subscriptions.filter(sub => sub.id !== id);
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
  }
}
