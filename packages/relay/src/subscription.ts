import { formatLoggerContext, generateRandomBytes32 } from "@walletconnect/utils";
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

  public setSubscriber(subscriber: Omit<Subscription, "id">): string {
    const id = generateRandomBytes32();
    this.logger.debug({ type: "method", method: "setSubscriber", topic: subscriber.topic });
    this.subs.push({ ...subscriber, id });
    return id;
  }

  public getSubscribers(topic: string, senderSocketId: string): Subscription[] {
    const subs = this.subs.filter(sub => sub.topic === topic && sub.socketId !== senderSocketId);
    this.logger.debug({ type: "method", method: "getSubscribers", topic, subs });
    return subs;
  }

  public removeSubscriber(id: string): void {
    this.logger.debug({ type: "method", method: "removeSubscriber", id });
    this.subs = this.subs.filter(sub => sub.id !== id);
  }

  public removeLegacySubscriber(topic: string, socketId: string): void {
    this.logger.debug({ type: "method", method: "removeLegacySubscriber", topic });
    this.subs = this.subs.filter(sub => sub.topic !== topic && sub.socketId !== socketId);
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace({ type: "init" });
  }
}
