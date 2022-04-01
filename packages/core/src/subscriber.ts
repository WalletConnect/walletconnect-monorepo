import { EventEmitter } from "events";
import { Logger } from "pino";
import {
  ISubscriber,
  ISubscriberTopicMap,
  Reason,
  SubscriberEvents,
  SubscriberTypes,
  RelayerTypes,
  IRelayer,
} from "@walletconnect/types";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { RequestArguments } from "@walletconnect/jsonrpc-types";
import {
  ERROR,
  formatMessageContext,
  getRelayProtocolName,
  getRelayProtocolApi,
} from "@walletconnect/utils";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";

import { SUBSCRIBER_CONTEXT, SUBSCRIBER_EVENTS, RELAYER_PROVIDER_EVENTS } from "./constants";

export class SubscriberTopicMap implements ISubscriberTopicMap {
  public map = new Map<string, string[]>();

  get topics(): string[] {
    return Array.from(this.map.keys());
  }

  public set(topic: string, id: string): void {
    const ids = this.get(topic);
    if (this.exists(topic, id)) return;
    this.map.set(topic, [...ids, id]);
  }

  public get(topic: string): string[] {
    const ids = this.map.get(topic);
    return ids || [];
  }

  public exists(topic: string, id: string): boolean {
    const ids = this.get(topic);
    return ids.includes(id);
  }

  public delete(topic: string, id?: string): void {
    if (typeof id === "undefined") {
      this.map.delete(topic);
      return;
    }
    if (!this.map.has(topic)) return;
    const ids = this.get(topic);
    if (!this.exists(topic, id)) return;
    const remaining = ids.filter(x => x !== id);
    if (!remaining.length) {
      this.map.delete(topic);
      return;
    }
    this.map.set(topic, remaining);
  }

  public clear(): void {
    this.map.clear();
  }
}

export class Subscriber extends ISubscriber {
  public subscriptions = new Map<string, SubscriberTypes.Active>();

  public topicMap = new SubscriberTopicMap();

  public events = new EventEmitter();

  public name: string = SUBSCRIBER_CONTEXT;

  public pending = new Map<string, SubscriberTypes.Params>();

  private cached: SubscriberTypes.Active[] = [];

  constructor(public relayer: IRelayer, public logger: Logger) {
    super(relayer, logger);
    this.relayer = relayer;
    this.logger = generateChildLogger(logger, this.name);
    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.initialize();
  }

  get context(): string {
    return getLoggerContext(this.logger);
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

  public async subscribe(topic: string, opts?: RelayerTypes.SubscribeOptions): Promise<string> {
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
  }

  public async unsubscribe(topic: string, opts?: RelayerTypes.UnsubscribeOptions): Promise<void> {
    if (typeof opts?.id !== "undefined") {
      await this.unsubscribeById(topic, opts.id, opts);
    } else {
      await this.unsubscribeByTopic(topic, opts);
    }
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
      const reason = ERROR.DELETED.format({ context: formatMessageContext(this.context) });
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

  private async onUnsubscribe(topic: string, id: string, reason: Reason) {
    this.events.removeAllListeners(id);
    if (await this.hasSubscription(id, topic)) {
      await this.deleteSubscription(id, reason);
    }
    await this.relayer.messages.del(topic);
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
        context: formatMessageContext(this.context),
        id,
      });
      // this.logger.error(error.message);
      throw new Error(error.message);
    }
    return subscription;
  }

  private async deleteSubscription(id: string, reason: Reason): Promise<void> {
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
    await this.relayer.storage.setRelayerSubscriptions(this.context, this.values);
    this.events.emit(SUBSCRIBER_EVENTS.sync);
  }

  private async restore() {
    try {
      const persisted = await this.relayer.storage.getRelayerSubscriptions(this.context);
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.subscriptions.size) {
        const error = ERROR.RESTORE_WILL_OVERRIDE.format({
          context: formatMessageContext(this.context),
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      this.cached = persisted;
      this.logger.debug(
        `Successfully Restored subscriptions for ${formatMessageContext(this.context)}`,
      );
      this.logger.trace({ type: "method", method: "restore", subscriptions: this.values });
    } catch (e) {
      this.logger.debug(
        `Failed to Restore subscriptions for ${formatMessageContext(this.context)}`,
      );
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
    this.relayer.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => {
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
