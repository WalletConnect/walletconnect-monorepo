import { EventEmitter } from "events";
import { Logger } from "pino";
import {
  IClient,
  ISubscription,
  Reason,
  SubscriptionEvent,
  SubscriptionParams,
} from "@walletconnect/types";
import { ERROR } from "@walletconnect/utils";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";

import {
  CLIENT_BEAT_INTERVAL,
  CLIENT_EVENTS,
  RELAYER_EVENTS,
  SUBSCRIPTION_CONTEXT,
  SUBSCRIPTION_DEFAULT_TTL,
  SUBSCRIPTION_EVENTS,
} from "../constants";

export class Subscription extends ISubscription {
  public subscriptions = new Map<string, SubscriptionParams>();

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

  get topics(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  get values(): SubscriptionParams[] {
    return Array.from(this.subscriptions.values());
  }

  public async set(id: string, subscription: SubscriptionParams): Promise<void> {
    await this.isEnabled();
    if (this.subscriptions.has(id)) return;
    this.logger.debug(`Setting subscription`);
    this.logger.trace({ type: "method", method: "set", id, subscription });
    await this.subscribeAndSet(id, subscription);
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
    this.subscriptions.delete(id);
    await this.client.relayer.unsubscribe(subscription.topic, subscription.id, {
      relay: subscription.relay,
    });
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

  // ---------- Private ----------------------------------------------- //

  private getNestedContext(length: number) {
    const nestedContext = getLoggerContext(this.logger).split("/");
    return nestedContext.slice(nestedContext.length - length, nestedContext.length);
  }

  private getSubscriptionContext() {
    return this.getNestedContext(2).join(" ");
  }

  private getStorageKey() {
    const storageKeyPrefix = `${this.client.protocol}@${this.client.version}:${this.client.context}`;
    const recordContext = this.getNestedContext(2).join(":");
    return `${storageKeyPrefix}//${recordContext}`;
  }

  private async getSubscription(id: string): Promise<SubscriptionParams> {
    await this.isEnabled();
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      const error = ERROR.NO_MATCHING_ID.format({
        context: this.getSubscriptionContext(),
        id,
      });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    return subscription;
  }

  private async subscribeAndSet(id: string, subscription: SubscriptionParams): Promise<void> {
    const expiry = subscription.expiry || Date.now() + SUBSCRIPTION_DEFAULT_TTL * 1000;
    this.subscriptions.set(id, { ...subscription, expiry });
    this.setTimeout(id, expiry);
  }

  private setTimeout(id: string, expiry: number) {
    if (this.timeout.has(id)) return;
    const ttl = expiry - Date.now();
    if (ttl <= 0) {
      this.onTimeout(id);
      return;
    }
    if (ttl > CLIENT_BEAT_INTERVAL) return;
    const timeout = setTimeout(() => this.onTimeout(id), ttl);
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
    this.delete(id, ERROR.EXPIRED.format({ context: this.getSubscriptionContext() }));
  }

  private checkSubscriptions(): void {
    this.subscriptions.forEach(subscription =>
      this.setTimeout(subscription.id, subscription.expiry),
    );
  }

  private async persist() {
    await this.client.storage.setItem<SubscriptionParams[]>(this.getStorageKey(), this.values);
    this.events.emit(SUBSCRIPTION_EVENTS.sync);
  }

  private async restore() {
    try {
      const persisted = await this.client.storage.getItem<SubscriptionParams[]>(
        this.getStorageKey(),
      );
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.subscriptions.size) {
        const error = ERROR.RESTORE_WILL_OVERRIDE.format({
          context: this.getSubscriptionContext(),
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      this.cached = persisted;
      await Promise.all(
        this.cached.map(async subscription => {
          await this.subscribeAndSet(subscription.id, subscription);
        }),
      );
      await this.enable();
      this.logger.debug(`Successfully Restored subscriptions for ${this.getSubscriptionContext()}`);
      this.logger.trace({ type: "method", method: "restore", subscriptions: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore subscriptions for ${this.getSubscriptionContext()}`);
      this.logger.error(e);
    }
  }

  private async reset(): Promise<void> {
    await this.disable();
    await Promise.all(
      this.cached.map(async subscription => {
        await this.subscribeAndSet(subscription.id, subscription);
      }),
    );
    await this.enable();
  }

  private async isEnabled(): Promise<void> {
    if (!this.cached.length) return;
    return new Promise(resolve => {
      this.events.once(SUBSCRIPTION_EVENTS.enabled, () => resolve());
    });
  }

  private async enable(): Promise<void> {
    this.cached = [];
    this.events.emit(SUBSCRIPTION_EVENTS.enabled);
  }

  private async disable(): Promise<void> {
    if (!this.cached.length) {
      this.cached = this.values;
    }
    this.resetTimeout();
    this.events.emit(SUBSCRIPTION_EVENTS.disabled);
  }

  private registerEventListeners(): void {
    this.client.on(CLIENT_EVENTS.beat, () => this.checkSubscriptions());
    this.client.relayer.on(RELAYER_EVENTS.connect, () => this.enable());
    this.client.relayer.on(RELAYER_EVENTS.disconnect, () => this.disable());
    this.events.on(SUBSCRIPTION_EVENTS.created, (createdEvent: SubscriptionEvent.Created) => {
      const eventName = SUBSCRIPTION_EVENTS.created;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: createdEvent });
      this.persist();
    });
    this.events.on(SUBSCRIPTION_EVENTS.deleted, (deletedEvent: SubscriptionEvent.Deleted) => {
      const eventName = SUBSCRIPTION_EVENTS.deleted;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: deletedEvent });
      this.persist();
    });
  }
}
