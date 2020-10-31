import { formatLoggerContext } from "@walletconnect/utils";
import { Logger } from "pino";

import { RedisService } from "./redis";
import { Subscription } from "./types";

export class SubscriptionService {
  public subs: Subscription[] = [];

  public context = "subscription";

  constructor(public logger: Logger, public redis: RedisService) {
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });
    this.redis = redis;
    this.initialize();
  }

  public setSubscriber(subscriber: Subscription): void {
    this.logger.debug({ type: "method", method: "setSubscriber", topic: subscriber.topic });
    this.subs.push(subscriber);
  }

  public getSubscribers(topic: string, senderSocketId: string): Subscription[] {
    const match = this.subs.filter(sub => sub.topic === topic && sub.socketId !== senderSocketId);
    this.logger.debug({ type: "method", method: "getSubscribers", topic, length: match.length });
    return match;
  }

  public removeSubscriber(subscriber: Subscription): void {
    this.logger.debug({ type: "method", method: "removeSubscriber", topic: subscriber.topic });
    this.subs = this.subs.filter(
      sub => sub.topic !== subscriber.topic && sub.socketId !== subscriber.socketId,
    );
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace({ type: "init" });
  }
}
