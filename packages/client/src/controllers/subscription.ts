import { EventEmitter } from "events";
import { Logger } from "pino";
import {
  IClient,
  ISubscription,
  SubscriptionEntries,
  SubscriptionEvent,
  SubscriptionOptions,
  SubscriptionParams,
} from "@walletconnect/types";
import { mapToObj, objToMap, formatLoggerContext } from "@walletconnect/utils";
import { JsonRpcPayload } from "@json-rpc-tools/utils";

import { SUBSCRIPTION_EVENTS } from "../constants";

export class Subscription<Data = any> extends ISubscription<Data> {
  public subscriptions = new Map<string, SubscriptionParams<Data>>();

  public events = new EventEmitter();

  constructor(
    public client: IClient,
    public logger: Logger,
    public context: string,
    public encrypted: boolean,
  ) {
    super(client, logger, context, encrypted);
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });

    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.restore();
  }

  get length(): number {
    return this.subscriptions.size;
  }

  get entries(): SubscriptionEntries<Data> {
    return mapToObj<SubscriptionParams<Data>>(this.subscriptions);
  }

  public async set(topic: string, data: Data, opts: SubscriptionOptions): Promise<void> {
    if (this.subscriptions.has(topic)) {
      this.update(topic, data);
    } else {
      this.logger.debug(`Setting subscription`);
      this.logger.trace({ type: "method", method: "set", topic, data, opts });
      if (this.encrypted && typeof opts.decryptKeys === "undefined") {
        const errorMessage = `Decrypt params required for ${this.getSubscriptionContext()}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      const id = await this.client.relay.subscribe(
        topic,
        (payload: JsonRpcPayload) => this.onPayload({ topic, payload }),
        opts,
      );
      this.subscriptions.set(topic, { id, topic, data, opts });
      this.events.emit(SUBSCRIPTION_EVENTS.created, {
        topic,
        data,
      } as SubscriptionEvent.Created<Data>);
    }
  }

  public async get(topic: string): Promise<Data> {
    this.logger.debug(`Getting subscription`);
    this.logger.trace({ type: "method", method: "get", topic });
    const subscription = await this.getSubscription(topic);
    return subscription.data;
  }

  public async update(topic: string, update: Partial<Data>): Promise<void> {
    this.logger.debug(`Updating subscription`);
    this.logger.trace({ type: "method", method: "update", topic, update });
    const subscription = await this.getSubscription(topic);
    const data = { ...subscription.data, ...update };
    this.subscriptions.set(topic, {
      ...subscription,
      topic,
      data,
    });
    this.events.emit(SUBSCRIPTION_EVENTS.updated, {
      topic,
      data,
      update,
    } as SubscriptionEvent.Updated<Data>);
  }

  public async delete(topic: string, reason: string): Promise<void> {
    this.logger.debug(`Deleting subscription`);
    this.logger.trace({ type: "method", method: "delete", topic, reason });
    const subscription = await this.getSubscription(topic);
    this.client.relay.unsubscribe(subscription.id, {
      relay: subscription.opts.relay,
      decryptKeys: subscription.opts.decryptKeys,
    });
    this.events.emit(SUBSCRIPTION_EVENTS.deleted, {
      topic,
      data: subscription.data,
      reason,
    } as SubscriptionEvent.Deleted<Data>);
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

  // ---------- Protected ----------------------------------------------- //

  protected async onPayload(payloadEvent: SubscriptionEvent.Payload) {
    this.events.emit(SUBSCRIPTION_EVENTS.payload, payloadEvent);
  }

  // ---------- Private ----------------------------------------------- //

  private getNestedContext(length: number) {
    const nestedContext = this.logger.bindings().context.split("/");
    return nestedContext.slice(nestedContext.length - length, nestedContext.length);
  }

  private getSubscriptionContext() {
    return this.getNestedContext(2).join(" ");
  }

  private getStoreKey() {
    return this.getNestedContext(2).join(":");
  }

  private async getSubscription(topic: string): Promise<SubscriptionParams<Data>> {
    const subscription = this.subscriptions.get(topic);
    if (!subscription) {
      const errorMessage = `No matching ${this.getSubscriptionContext()} with topic: ${topic}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    return subscription;
  }

  private async persist() {
    await this.client.store.set<SubscriptionEntries<Data>>(this.getStoreKey(), this.entries);
  }

  private async restore() {
    try {
      const subscriptions = await this.client.store.get<SubscriptionEntries<Data>>(
        this.getStoreKey(),
      );
      if (typeof subscriptions === "undefined") return;
      if (this.subscriptions.size) {
        const errorMessage = `Restore will override already set ${this.getSubscriptionContext()}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      this.subscriptions = objToMap<SubscriptionParams<Data>>(subscriptions);
      for (const [_, subscription] of this.subscriptions) {
        const { topic, opts } = subscription;
        const id = await this.client.relay.subscribe(
          topic,
          (payload: JsonRpcPayload) => this.onPayload({ topic, payload }),
          opts,
        );
        this.subscriptions.set(topic, { ...subscription, id });
      }
      this.logger.debug(`Successfully Restored subscriptions for ${this.getSubscriptionContext()}`);
      this.logger.trace({ type: "method", method: "restore", subscriptions: this.entries });
    } catch (e) {
      this.logger.debug(`Failed to Restore subscriptions for ${this.getSubscriptionContext()}`);
      this.logger.error(e);
    }
  }

  private registerEventListeners(): void {
    this.events.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) => {
      this.logger.info(`Emitting ${SUBSCRIPTION_EVENTS.created}`);
      this.logger.debug({ type: "event", event: SUBSCRIPTION_EVENTS.created, data: payloadEvent });
    });
    this.events.on(SUBSCRIPTION_EVENTS.created, (createdEvent: SubscriptionEvent.Created<Data>) => {
      this.logger.info(`Emitting ${SUBSCRIPTION_EVENTS.created}`);
      this.logger.debug({ type: "event", event: SUBSCRIPTION_EVENTS.created, data: createdEvent });
      this.persist();
    });
    this.events.on(SUBSCRIPTION_EVENTS.updated, (updatedEvent: SubscriptionEvent.Updated<Data>) => {
      this.logger.info(`Emitting ${SUBSCRIPTION_EVENTS.updated}`);
      this.logger.debug({ type: "event", event: SUBSCRIPTION_EVENTS.updated, data: updatedEvent });
      this.persist();
    });
    this.events.on(SUBSCRIPTION_EVENTS.deleted, (deletedEvent: SubscriptionEvent.Deleted<Data>) => {
      this.logger.info(`Emitting ${SUBSCRIPTION_EVENTS.updated}`);
      this.logger.debug({ type: "event", event: SUBSCRIPTION_EVENTS.updated, data: deletedEvent });
      this.persist();
    });
  }
}
