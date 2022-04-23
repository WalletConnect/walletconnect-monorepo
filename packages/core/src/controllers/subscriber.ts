import { Logger } from "pino";
import { EventEmitter } from "events";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { ErrorResponse, RequestArguments } from "@walletconnect/jsonrpc-types";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import {
  IRelayer,
  ISubscriber,
  RelayerTypes,
  SubscriberEvents,
  SubscriberTypes,
} from "@walletconnect/types";
import {
  ERROR,
  formatStorageKeyName,
  getRelayProtocolApi,
  getRelayProtocolName,
} from "@walletconnect/utils";

import {
  RELAYER_PROVIDER_EVENTS,
  SUBSCRIBER_CONTEXT,
  SUBSCRIBER_EVENTS,
  SUBSCRIBER_STORAGE_VERSION,
} from "../constants";
import { SubscriberTopicMap } from "./topicmap";

export class Subscriber extends ISubscriber {
  public subscriptions = new Map<string, SubscriberTypes.Active>();

  public topicMap = new SubscriberTopicMap();

  public events = new EventEmitter();

  public name = SUBSCRIBER_CONTEXT;

  public version = SUBSCRIBER_STORAGE_VERSION;

  public pending = new Map<string, SubscriberTypes.Params>();

  private cached: SubscriberTypes.Active[] = [];

  constructor(public relayer: IRelayer, public logger: Logger) {
    super(relayer, logger);
    this.relayer = relayer;
    this.logger = generateChildLogger(logger, this.name);
    this.registerEventListeners();
  }

  public init: ISubscriber["init"] = async () => {
    this.logger.trace(`Initialized`);
    await this.initialize();
  };

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get storageKey(): string {
    return (
      this.relayer.core.storagePrefix + this.version + "//" + formatStorageKeyName(this.context)
    );
  }

  get length(): number {
    return this.subscriptions.size;
  }

  get ids(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  get values(): SubscriberTypes.Active[] {
    return Array.from(this.subscriptions.values());
  }

  get topics(): string[] {
    return this.topicMap.topics;
  }

  public subscribe: ISubscriber["subscribe"] = async (topic, opts) => {
    this.logger.debug(`Subscribing Topic`);
    this.logger.trace({ type: "method", method: "subscribe", params: { topic, opts } });
    try {
      const relay = getRelayProtocolName(opts);
      const params = { topic, relay };
      this.pending.set(topic, params);
      const id = await this.rpcSubscribe(topic, relay);
      await this.onSubscribe(id, params);
      this.logger.debug(`Successfully Subscribed Topic`);
      this.logger.trace({ type: "method", method: "subscribe", params: { topic, opts } });
      return id;
    } catch (e) {
      this.logger.debug(`Failed to Subscribe Topic`);
      this.logger.error(e as any);
      throw e;
    }
  };

  public unsubscribe: ISubscriber["unsubscribe"] = async (topic, opts) => {
    if (typeof opts?.id !== "undefined") {
      await this.unsubscribeById(topic, opts.id, opts);
    } else {
      await this.unsubscribeByTopic(topic, opts);
    }
  };

  public on: ISubscriber["on"] = (event, listener) => {
    this.events.on(event, listener);
  };

  public once: ISubscriber["once"] = (event, listener) => {
    this.events.once(event, listener);
  };

  public off: ISubscriber["off"] = (event, listener) => {
    this.events.off(event, listener);
  };

  public removeListener: ISubscriber["removeListener"] = (event, listener) => {
    this.events.removeListener(event, listener);
  };

  // ---------- Private ----------------------------------------------- //

  private async enable(): Promise<void> {
    if (!this.cached.length) return;
    this.onEnable();
  }

  private async disable(): Promise<void> {
    if (this.cached.length) return;
    this.onDisable();
  }

  private async hasSubscription(id: string, topic: string): Promise<boolean> {
    await this.isEnabled();
    let result = false;
    try {
      const subscription = await this.getSubscription(id);
      result = subscription.topic === topic;
    } catch (e) {
      // ignore error
    }
    return result;
  }

  private onEnable() {
    this.cached = [];
    this.events.emit(SUBSCRIBER_EVENTS.enabled);
  }

  private onDisable() {
    this.cached = this.values;
    this.subscriptions.clear();
    this.topicMap.clear();
    this.events.emit(SUBSCRIBER_EVENTS.disabled);
  }

  private async unsubscribeByTopic(
    topic: string,
    opts?: RelayerTypes.UnsubscribeOptions,
  ): Promise<void> {
    const ids = this.topicMap.get(topic);
    await Promise.all(ids.map(async id => await this.unsubscribeById(topic, id, opts)));
  }

  private async unsubscribeById(
    topic: string,
    id: string,
    opts?: RelayerTypes.UnsubscribeOptions,
  ): Promise<void> {
    this.logger.debug(`Unsubscribing Topic`);
    this.logger.trace({ type: "method", method: "unsubscribe", params: { topic, id, opts } });
    try {
      const relay = getRelayProtocolName(opts);
      await this.rpcUnsubscribe(topic, id, relay);
      const reason = ERROR.DELETED.format({ context: this.name });
      await this.onUnsubscribe(topic, id, reason);
      this.logger.debug(`Successfully Unsubscribed Topic`);
      this.logger.trace({ type: "method", method: "unsubscribe", params: { topic, id, opts } });
    } catch (e) {
      this.logger.debug(`Failed to Unsubscribe Topic`);
      this.logger.error(e as any);
      throw e;
    }
  }

  private async rpcSubscribe(topic: string, relay: RelayerTypes.ProtocolOptions): Promise<string> {
    const api = getRelayProtocolApi(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.SubscribeParams> = {
      method: api.subscribe,
      params: {
        topic,
      },
    };
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "payload", direction: "outgoing", request });
    return this.relayer.provider.request(request);
  }

  private async rpcUnsubscribe(
    topic: string,
    id: string,
    relay: RelayerTypes.ProtocolOptions,
  ): Promise<void> {
    const api = getRelayProtocolApi(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.UnsubscribeParams> = {
      method: api.unsubscribe,
      params: {
        topic,
        id,
      },
    };
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "payload", direction: "outgoing", request });
    return this.relayer.provider.request(request);
  }

  private async onSubscribe(id: string, params: SubscriberTypes.Params) {
    await this.setSubscription(id, { ...params, id });
    this.pending.delete(params.topic);
  }

  private async onResubscribe(id: string, params: SubscriberTypes.Params) {
    await this.addSubscription(id, { ...params, id });
    this.pending.delete(params.topic);
  }

  private async onUnsubscribe(topic: string, id: string, reason: ErrorResponse) {
    this.events.removeAllListeners(id);
    if (await this.hasSubscription(id, topic)) {
      await this.deleteSubscription(id, reason);
    }
    await this.relayer.messages.del(topic);
  }

  private async setRelayerSubscriptions(subscriptions: SubscriberTypes.Active[]): Promise<void> {
    await this.relayer.core.storage.setItem<SubscriberTypes.Active[]>(
      this.storageKey,
      subscriptions,
    );
  }

  private async getRelayerSubscriptions(): Promise<SubscriberTypes.Active[] | undefined> {
    const subscriptions = await this.relayer.core.storage.getItem<SubscriberTypes.Active[]>(
      this.storageKey,
    );
    return subscriptions;
  }

  private async setSubscription(id: string, subscription: SubscriberTypes.Active): Promise<void> {
    await this.isEnabled();
    if (this.subscriptions.has(id)) return;
    this.logger.debug(`Setting subscription`);
    this.logger.trace({ type: "method", method: "setSubscription", id, subscription });
    await this.addSubscription(id, subscription);
  }

  private async addSubscription(id: string, subscription: SubscriberTypes.Active): Promise<void> {
    this.subscriptions.set(id, { ...subscription });
    this.topicMap.set(subscription.topic, id);
    this.events.emit(SUBSCRIBER_EVENTS.created, subscription);
  }

  private async getSubscription(id: string): Promise<SubscriberTypes.Active> {
    await this.isEnabled();
    this.logger.debug(`Getting subscription`);
    this.logger.trace({ type: "method", method: "getSubscription", id });
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      const error = ERROR.NO_MATCHING_ID.format({
        context: this.name,
        id,
      });
      // this.logger.error(error.message);
      throw new Error(error.message);
    }
    return subscription;
  }

  private async deleteSubscription(id: string, reason: ErrorResponse): Promise<void> {
    await this.isEnabled();
    this.logger.debug(`Deleting subscription`);
    this.logger.trace({ type: "method", method: "deleteSubscription", id, reason });
    const subscription = await this.getSubscription(id);
    this.subscriptions.delete(id);
    this.topicMap.delete(subscription.topic, id);
    this.events.emit(SUBSCRIBER_EVENTS.deleted, {
      ...subscription,
      reason,
    } as SubscriberEvents.Deleted);
  }

  private async persist() {
    await this.setRelayerSubscriptions(this.values);
    this.events.emit(SUBSCRIBER_EVENTS.sync);
  }

  private async restore() {
    try {
      const persisted = await this.getRelayerSubscriptions();
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.subscriptions.size) {
        const error = ERROR.RESTORE_WILL_OVERRIDE.format({
          context: this.name,
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      this.cached = persisted;
      this.logger.debug(`Successfully Restored subscriptions for ${this.name}`);
      this.logger.trace({ type: "method", method: "restore", subscriptions: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore subscriptions for ${this.name}`);
      this.logger.error(e as any);
    }
  }

  private async initialize() {
    await this.restore();
    await this.reset();
    await this.enable();
  }

  private async isEnabled(): Promise<void> {
    if (!this.cached.length) return;
    return new Promise(resolve => {
      this.events.once(SUBSCRIBER_EVENTS.enabled, () => resolve());
    });
  }

  private async reset() {
    if (!this.cached.length) return;
    await Promise.all(this.cached.map(async subscription => this.resubscribe(subscription)));
  }

  private async resubscribe(subscription: SubscriberTypes.Active) {
    const { topic, relay } = subscription;
    const params = { topic, relay };
    this.pending.set(params.topic, params);
    const id = await this.rpcSubscribe(params.topic, params.relay);
    await this.onResubscribe(id, params);
    if (this.ids.includes(subscription.id)) {
      const reason = ERROR.RESUBSCRIBED.format({ topic: subscription.topic });
      await this.deleteSubscription(subscription.id, reason);
    }
  }

  private async onConnect() {
    await this.reset();
    await this.enable();
  }

  private async onDisconnect() {
    await this.disable();
  }

  private checkPending(): void {
    this.pending.forEach(async params => {
      const id = await this.rpcSubscribe(params.topic, params.relay);
      await this.onSubscribe(id, params);
    });
  }

  private registerEventListeners(): void {
    this.relayer.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => {
      this.checkPending();
    });
    this.relayer.provider.on(RELAYER_PROVIDER_EVENTS.connect, async () => {
      await this.onConnect();
    });
    this.relayer.provider.on(RELAYER_PROVIDER_EVENTS.disconnect, async () => {
      await this.onDisconnect();
    });
    this.events.on(SUBSCRIBER_EVENTS.created, async (createdEvent: SubscriberEvents.Created) => {
      const eventName = SUBSCRIBER_EVENTS.created;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: createdEvent });
      await this.persist();
    });
    this.events.on(SUBSCRIBER_EVENTS.deleted, async (deletedEvent: SubscriberEvents.Deleted) => {
      const eventName = SUBSCRIBER_EVENTS.deleted;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: deletedEvent });
      await this.persist();
    });
  }
}
