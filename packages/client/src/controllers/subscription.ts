import { EventEmitter } from "events";
import { Logger } from "pino";
import {
  IClient,
  ISubscription,
  SubscriptionContext,
  SubscriptionEntries,
  SubscriptionEvent,
  SubscriptionOptions,
  SubscriptionParams,
} from "@walletconnect/types";
import { mapToObj, objToMap, formatLoggerContext } from "@walletconnect/utils";
import { JsonRpcPayload } from "rpc-json-utils";

import { SUBSCRIPTION_EVENTS } from "../constants";

export class Subscription<Data = any> extends ISubscription<Data> {
  public subscriptions = new Map<string, SubscriptionParams<Data>>();

  public events = new EventEmitter();

  constructor(public client: IClient, public context: SubscriptionContext, public logger: Logger) {
    super(client, context, logger);
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context.status) });

    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.info({ type: "init" });
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
      if (this.context.encrypted && typeof opts.decrypt === "undefined") {
        throw new Error(`Decrypt params required for ${this.context.status} ${this.context.name}`);
      }
      this.subscriptions.set(topic, { topic, data, opts });
      this.events.emit(SUBSCRIPTION_EVENTS.created, {
        topic,
        data,
      } as SubscriptionEvent.Created<Data>);
      this.client.relay.subscribe(
        topic,
        (payload: JsonRpcPayload) => this.onMessage({ topic, payload }),
        opts,
      );
    }
  }

  public async get(topic: string): Promise<Data> {
    const subscription = await this.getSubscription(topic);
    return subscription.data;
  }

  public async update(topic: string, update: Partial<Data>): Promise<void> {
    const subscription = await this.getSubscription(topic);
    const data = { ...subscription.data, ...update };
    this.subscriptions.set(topic, {
      ...subscription,
      topic,
      data,
    });
    this.events.emit(SUBSCRIPTION_EVENTS.updated, { topic, data } as SubscriptionEvent.Updated<
      Data
    >);
  }

  public async delete(topic: string, reason: string): Promise<void> {
    const subscription = await this.getSubscription(topic);
    this.client.relay.unsubscribe(
      topic,
      (payload: JsonRpcPayload) => this.onMessage({ topic, payload }),
      { relay: subscription.opts.relay, decrypt: subscription.opts.decrypt },
    );
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

  protected async onMessage(payloadEvent: SubscriptionEvent.Payload) {
    this.events.emit(SUBSCRIPTION_EVENTS.payload, payloadEvent);
  }

  // ---------- Private ----------------------------------------------- //

  private async getSubscription(topic: string): Promise<SubscriptionParams<Data>> {
    const subscription = this.subscriptions.get(topic);
    if (!subscription) {
      throw new Error(
        `No matching ${this.context.status} ${this.context.name} with topic: ${topic}`,
      );
    }
    return subscription;
  }

  private async persist() {
    await this.client.store.set<SubscriptionEntries<Data>>(
      `${this.context.name}:${this.context.status}`,
      this.entries,
    );
  }

  private async restore() {
    const subscriptions = await this.client.store.get<SubscriptionEntries<Data>>(
      `${this.context.name}:${this.context.status}`,
    );
    if (typeof subscriptions === "undefined") return;
    if (this.subscriptions.size) {
      throw new Error(
        `Restore will override already set ${this.context.status} ${this.context.name}`,
      );
    }
    this.subscriptions = objToMap<SubscriptionParams<Data>>(subscriptions);
    for (const [_, subscription] of this.subscriptions) {
      const { topic, opts } = subscription;
      this.client.relay.subscribe(
        topic,
        (payload: JsonRpcPayload) => this.onMessage({ topic, payload }),
        opts,
      );
    }
  }

  private registerEventListeners(): void {
    this.events.on(SUBSCRIPTION_EVENTS.created, () => this.persist());
    this.events.on(SUBSCRIPTION_EVENTS.updated, () => this.persist());
    this.events.on(SUBSCRIPTION_EVENTS.deleted, () => this.persist());
  }
}
