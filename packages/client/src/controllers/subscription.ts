import { EventEmitter } from "events";
import { Logger } from "pino";
import {
  IClient,
  ISubscription,
  Reason,
  SubscriptionEvent,
  SubscriptionParams,
} from "@walletconnect/types";
import { ERROR, fromMiliseconds, getNestedContext, toMiliseconds } from "@walletconnect/utils";
import { generateChildLogger } from "@walletconnect/logger";

import {
  CLIENT_BEAT_INTERVAL,
  CLIENT_EVENTS,
  SUBSCRIPTION_CONTEXT,
  SUBSCRIPTION_DEFAULT_TTL,
  SUBSCRIPTION_EVENTS,
} from "../constants";

export class Subscription extends ISubscription {
  public subscriptions = new Map<string, SubscriptionParams>();

  public topicMap = new Map<string, string[]>();

  public events = new EventEmitter();

  public context = SUBSCRIPTION_CONTEXT;

  private timeout = new Map<string, NodeJS.Timeout>();

  private cached: SubscriptionParams[] = [];

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = generateChildLogger(logger, this.context);
    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.restore();
  }

  get length(): number {
    return this.subscriptions.size;
  }

  get ids(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  get values(): SubscriptionParams[] {
    return Array.from(this.subscriptions.values());
  }

  get topics(): string[] {
    return Array.from(this.topicMap.keys());
  }

  public async set(id: string, subscription: SubscriptionParams): Promise<void> {
    await this.isEnabled();
    if (this.subscriptions.has(id)) return;
    this.logger.debug(`Setting subscription`);
    this.logger.trace({ type: "method", method: "set", id, subscription });
    this.setSubscription(id, subscription);
    this.events.emit(SUBSCRIPTION_EVENTS.created, subscription);
  }

  public async get(id: string): Promise<SubscriptionParams> {
    await this.isEnabled();
    this.logger.debug(`Getting subscription`);
    this.logger.trace({ type: "method", method: "get", id });
    const subscription = await this.getSubscription(id);
    return subscription;
  }

  public async delete(id: string, reason: Reason): Promise<void> {
    await this.isEnabled();

    this.logger.debug(`Deleting subscription`);
    this.logger.trace({ type: "method", method: "delete", id, reason });
    const subscription = await this.getSubscription(id);
    this.deleteSubscription(id, subscription);

    this.events.emit(SUBSCRIPTION_EVENTS.deleted, {
      ...subscription,
      reason,
    } as SubscriptionEvent.Deleted);
  }

  public on(event: string, listener: any): void {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any): void {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any): void {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any): void {
    this.events.removeListener(event, listener);
  }

  public async reset(): Promise<void> {
    await this.disable();
    this.cached.map(async subscription => {
      this.setSubscription(subscription.id, subscription);
    });
    await this.enable();
  }

  public async enable(): Promise<void> {
    this.cached = [];
    this.events.emit(SUBSCRIPTION_EVENTS.enabled);
  }

  public async disable(): Promise<void> {
    if (!this.cached.length) {
      this.cached = this.values;
    }
    this.resetTimeout();
    this.events.emit(SUBSCRIPTION_EVENTS.disabled);
  }

  public getNestedContext() {
    return getNestedContext(this.logger);
  }

  // ---------- Private ----------------------------------------------- //

  private setSubscription(id: string, subscription: SubscriptionParams): void {
    const expiry =
      subscription.expiry || fromMiliseconds(Date.now() + toMiliseconds(SUBSCRIPTION_DEFAULT_TTL));
    this.subscriptions.set(id, { ...subscription, expiry });
    this.setOnTopicMap(id, subscription);
    this.setTimeout(id, expiry);
  }

  private async getSubscription(id: string): Promise<SubscriptionParams> {
    await this.isEnabled();
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      const error = ERROR.NO_MATCHING_ID.format({
        context: this.getNestedContext(),
        id,
      });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    return subscription;
  }

  private deleteSubscription(id: string, subscription: SubscriptionParams): void {
    this.subscriptions.delete(id);
    this.deleteOnTopicMap(id, subscription);
  }

  private setOnTopicMap(id: string, subscription: SubscriptionParams): void {
    if (this.topicMap.has(subscription.topic)) {
      const ids = this.topicMap.get(subscription.topic);
      if (typeof ids !== "undefined" && !ids.includes(id)) {
        this.topicMap.set(subscription.topic, [...ids, id]);
      }
    } else {
      this.topicMap.set(subscription.topic, [id]);
    }
  }

  private deleteOnTopicMap(id: string, subscription: SubscriptionParams): void {
    if (this.topicMap.has(subscription.topic)) {
      const ids = this.topicMap.get(subscription.topic);
      if (typeof ids !== "undefined" && ids.includes(id)) {
        const newIds = ids.filter(x => x === id);
        if (newIds.length) {
          this.topicMap.set(subscription.topic, newIds);
        } else {
          this.topicMap.delete(subscription.topic);
        }
      }
    }
  }

  private setTimeout(id: string, expiry: number) {
    if (this.timeout.has(id)) return;
    const milisecondsLeft = toMiliseconds(expiry) - Date.now();
    if (milisecondsLeft <= 0) {
      this.onTimeout(id);
      return;
    }
    if (milisecondsLeft > CLIENT_BEAT_INTERVAL) return;
    const timeout = setTimeout(() => this.onTimeout(id), milisecondsLeft);
    this.timeout.set(id, timeout);
  }

  private deleteTimeout(id: string): void {
    if (!this.timeout.has(id)) return;
    const timeout = this.timeout.get(id);
    if (typeof timeout === "undefined") return;
    clearTimeout(timeout);
  }

  private resetTimeout(): void {
    this.timeout.forEach(timeout => clearTimeout(timeout));
    this.timeout.clear();
  }

  private onTimeout(id: string): void {
    this.deleteTimeout(id);
    this.delete(id, ERROR.EXPIRED.format({ context: this.getNestedContext() }));
  }

  private checkSubscriptions(): void {
    this.subscriptions.forEach(subscription =>
      this.setTimeout(subscription.id, subscription.expiry),
    );
  }

  private async persist() {
    await this.client.storage.setRelayerSubscriptions(this.getNestedContext(), this.values);
    this.events.emit(SUBSCRIPTION_EVENTS.sync);
  }

  private async restore() {
    try {
      const persisted = await this.client.storage.getRelayerSubscriptions(this.getNestedContext());
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.subscriptions.size) {
        const error = ERROR.RESTORE_WILL_OVERRIDE.format({
          context: this.getNestedContext(),
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      this.cached = persisted;
      await Promise.all(
        this.cached.map(async subscription => {
          this.setSubscription(subscription.id, subscription);
        }),
      );
      await this.enable();
      this.logger.debug(`Successfully Restored subscriptions for ${this.getNestedContext()}`);
      this.logger.trace({ type: "method", method: "restore", subscriptions: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore subscriptions for ${this.getNestedContext()}`);
      this.logger.error(e);
    }
  }

  private async isEnabled(): Promise<void> {
    if (!this.cached.length) return;
    return new Promise(resolve => {
      this.events.once(SUBSCRIPTION_EVENTS.enabled, () => resolve());
    });
  }

  private registerEventListeners(): void {
    this.client.on(CLIENT_EVENTS.beat, () => this.checkSubscriptions());
    this.events.on(SUBSCRIPTION_EVENTS.created, async (createdEvent: SubscriptionEvent.Created) => {
      const eventName = SUBSCRIPTION_EVENTS.created;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: createdEvent });
      await this.persist();
    });
    this.events.on(SUBSCRIPTION_EVENTS.deleted, async (deletedEvent: SubscriptionEvent.Deleted) => {
      const eventName = SUBSCRIPTION_EVENTS.deleted;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: deletedEvent });
      await this.persist();
      if (deletedEvent.reason.code === ERROR.EXPIRED.code) {
        const expiredEvent = deletedEvent;
        this.events.emit(SUBSCRIPTION_EVENTS.deleted, expiredEvent as SubscriptionEvent.Expired);
      }
    });
  }
}
