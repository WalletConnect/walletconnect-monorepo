import { EventEmitter } from "events";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { ErrorResponse, RequestArguments } from "@walletconnect/jsonrpc-types";
import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { Watch } from "@walletconnect/time";
import {
  IRelayer,
  ISubscriber,
  RelayerTypes,
  SubscriberEvents,
  SubscriberTypes,
} from "@walletconnect/types";
import {
  getSdkError,
  getInternalError,
  getRelayProtocolApi,
  getRelayProtocolName,
  createExpiringPromise,
  hashMessage,
  isValidArray,
} from "@walletconnect/utils";
import {
  CORE_STORAGE_PREFIX,
  SUBSCRIBER_CONTEXT,
  SUBSCRIBER_EVENTS,
  SUBSCRIBER_STORAGE_VERSION,
  PENDING_SUB_RESOLUTION_TIMEOUT,
  RELAYER_EVENTS,
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
  private initialized = false;
  private pendingSubscriptionWatchLabel = "pending_sub_watch_label";
  private pollingInterval = 20;
  private storagePrefix = CORE_STORAGE_PREFIX;
  private subscribeTimeout = 10_000;
  private restartInProgress = false;
  private clientId: string;
  private batchSubscribeTopicsLimit = 500;
  constructor(public relayer: IRelayer, public logger: Logger) {
    super(relayer, logger);
    this.relayer = relayer;
    this.logger = generateChildLogger(logger, this.name);
    this.clientId = ""; // assigned in init
  }

  public init: ISubscriber["init"] = async () => {
    if (!this.initialized) {
      this.logger.trace(`Initialized`);
      await this.restart();
      this.registerEventListeners();
      this.onEnable();
      this.clientId = await this.relayer.core.crypto.getClientId();
    }
  };

  get context() {
    return getLoggerContext(this.logger);
  }

  get storageKey(): string {
    return this.storagePrefix + this.version + "//" + this.name;
  }

  get length() {
    return this.subscriptions.size;
  }

  get ids() {
    return Array.from(this.subscriptions.keys());
  }

  get values() {
    return Array.from(this.subscriptions.values());
  }

  get topics() {
    return this.topicMap.topics;
  }

  public subscribe: ISubscriber["subscribe"] = async (topic, opts) => {
    await this.restartToComplete();
    this.isInitialized();
    this.logger.debug(`Subscribing Topic`);
    this.logger.trace({ type: "method", method: "subscribe", params: { topic, opts } });
    try {
      const relay = getRelayProtocolName(opts);
      const params = { topic, relay };
      this.pending.set(topic, params);
      const id = await this.rpcSubscribe(topic, relay);
      this.onSubscribe(id, params);
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
    await this.restartToComplete();
    this.isInitialized();
    if (typeof opts?.id !== "undefined") {
      await this.unsubscribeById(topic, opts.id, opts);
    } else {
      await this.unsubscribeByTopic(topic, opts);
    }
  };

  public isSubscribed: ISubscriber["isSubscribed"] = async (topic: string) => {
    // topic subscription is already resolved
    if (this.topics.includes(topic)) return true;

    // wait for the subscription to resolve
    return await new Promise((resolve, reject) => {
      const watch = new Watch();
      watch.start(this.pendingSubscriptionWatchLabel);

      const interval = setInterval(() => {
        if (!this.pending.has(topic) && this.topics.includes(topic)) {
          clearInterval(interval);
          watch.stop(this.pendingSubscriptionWatchLabel);
          resolve(true);
        }
        if (watch.elapsed(this.pendingSubscriptionWatchLabel) >= PENDING_SUB_RESOLUTION_TIMEOUT) {
          clearInterval(interval);
          watch.stop(this.pendingSubscriptionWatchLabel);
          reject(false);
        }
      }, this.pollingInterval);
    });
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

  private hasSubscription(id: string, topic: string) {
    let result = false;
    try {
      const subscription = this.getSubscription(id);
      result = subscription.topic === topic;
    } catch (e) {
      // ignore error
    }
    return result;
  }

  private onEnable() {
    this.cached = [];
    this.initialized = true;
  }

  private onDisable() {
    this.cached = this.values;
    this.subscriptions.clear();
    this.topicMap.clear();
  }

  private async unsubscribeByTopic(topic: string, opts?: RelayerTypes.UnsubscribeOptions) {
    const ids = this.topicMap.get(topic);
    await Promise.all(ids.map(async (id) => await this.unsubscribeById(topic, id, opts)));
  }

  private async unsubscribeById(topic: string, id: string, opts?: RelayerTypes.UnsubscribeOptions) {
    this.logger.debug(`Unsubscribing Topic`);
    this.logger.trace({ type: "method", method: "unsubscribe", params: { topic, id, opts } });
    try {
      const relay = getRelayProtocolName(opts);
      await this.rpcUnsubscribe(topic, id, relay);
      const reason = getSdkError("USER_DISCONNECTED", `${this.name}, ${topic}`);
      await this.onUnsubscribe(topic, id, reason);
      this.logger.debug(`Successfully Unsubscribed Topic`);
      this.logger.trace({ type: "method", method: "unsubscribe", params: { topic, id, opts } });
    } catch (e) {
      this.logger.debug(`Failed to Unsubscribe Topic`);
      this.logger.error(e as any);
      throw e;
    }
  }

  private async rpcSubscribe(topic: string, relay: RelayerTypes.ProtocolOptions) {
    const api = getRelayProtocolApi(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.SubscribeParams> = {
      method: api.subscribe,
      params: {
        topic,
      },
    };
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "payload", direction: "outgoing", request });
    try {
      const subscribe = await createExpiringPromise(
        this.relayer.request(request),
        this.subscribeTimeout,
      );
      await subscribe;
    } catch (err) {
      this.logger.debug(`Outgoing Relay Subscribe Payload stalled`);
      this.relayer.events.emit(RELAYER_EVENTS.connection_stalled);
    }
    return hashMessage(topic + this.clientId);
  }

  private async rpcBatchSubscribe(subscriptions: SubscriberTypes.Params[]) {
    if (!subscriptions.length) return;
    const relay = subscriptions[0].relay;
    const api = getRelayProtocolApi(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.BatchSubscribeParams> = {
      method: api.batchSubscribe,
      params: {
        topics: subscriptions.map((s) => s.topic),
      },
    };
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "payload", direction: "outgoing", request });
    try {
      const subscribe = await createExpiringPromise(
        this.relayer.request(request),
        this.subscribeTimeout,
      );
      return await subscribe;
    } catch (err) {
      this.logger.debug(`Outgoing Relay Payload stalled`);
      this.relayer.events.emit(RELAYER_EVENTS.connection_stalled);
    }
  }

  private rpcUnsubscribe(topic: string, id: string, relay: RelayerTypes.ProtocolOptions) {
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
    return this.relayer.request(request);
  }

  private onSubscribe(id: string, params: SubscriberTypes.Params) {
    this.setSubscription(id, { ...params, id });
    this.pending.delete(params.topic);
  }

  private onBatchSubscribe(subscriptions: SubscriberTypes.Active[]) {
    if (!subscriptions.length) return;
    subscriptions.forEach((subscription) => {
      this.setSubscription(subscription.id, { ...subscription });
      this.pending.delete(subscription.topic);
    });
  }

  private async onUnsubscribe(topic: string, id: string, reason: ErrorResponse) {
    this.events.removeAllListeners(id);
    if (this.hasSubscription(id, topic)) {
      this.deleteSubscription(id, reason);
    }
    await this.relayer.messages.del(topic);
  }

  private async setRelayerSubscriptions(subscriptions: SubscriberTypes.Active[]) {
    await this.relayer.core.storage.setItem<SubscriberTypes.Active[]>(
      this.storageKey,
      subscriptions,
    );
  }

  private async getRelayerSubscriptions() {
    const subscriptions = await this.relayer.core.storage.getItem<SubscriberTypes.Active[]>(
      this.storageKey,
    );
    return subscriptions;
  }

  private setSubscription(id: string, subscription: SubscriberTypes.Active) {
    if (this.subscriptions.has(id)) return;
    this.logger.debug(`Setting subscription`);
    this.logger.trace({ type: "method", method: "setSubscription", id, subscription });
    this.addSubscription(id, subscription);
  }

  private addSubscription(id: string, subscription: SubscriberTypes.Active) {
    this.subscriptions.set(id, { ...subscription });
    this.topicMap.set(subscription.topic, id);
    this.events.emit(SUBSCRIBER_EVENTS.created, subscription);
  }

  private getSubscription(id: string) {
    this.logger.debug(`Getting subscription`);
    this.logger.trace({ type: "method", method: "getSubscription", id });
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      const { message } = getInternalError("NO_MATCHING_KEY", `${this.name}: ${id}`);
      throw new Error(message);
    }
    return subscription;
  }

  private deleteSubscription(id: string, reason: ErrorResponse) {
    this.logger.debug(`Deleting subscription`);
    this.logger.trace({ type: "method", method: "deleteSubscription", id, reason });
    const subscription = this.getSubscription(id);
    this.subscriptions.delete(id);
    this.topicMap.delete(subscription.topic, id);
    this.events.emit(SUBSCRIBER_EVENTS.deleted, {
      ...subscription,
      reason,
    } as SubscriberEvents.Deleted);
  }

  private restart = async () => {
    this.restartInProgress = true;
    await this.restore();
    await this.reset();
    this.restartInProgress = false;
  };

  private async persist() {
    await this.setRelayerSubscriptions(this.values);
    this.events.emit(SUBSCRIBER_EVENTS.sync);
  }

  private async reset() {
    if (!this.cached.length) return;

    const batches = Math.ceil(this.cached.length / this.batchSubscribeTopicsLimit);

    for (let i = 0; i < batches; i++) {
      const batch = this.cached.splice(0, this.batchSubscribeTopicsLimit);
      await this.batchSubscribe(batch);
    }

    this.events.emit(SUBSCRIBER_EVENTS.resubscribed);
  }

  private async restore() {
    try {
      const persisted = await this.getRelayerSubscriptions();
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.subscriptions.size) {
        const { message } = getInternalError("RESTORE_WILL_OVERRIDE", this.name);
        this.logger.error(message);
        this.logger.error(`${this.name}: ${JSON.stringify(this.values)}`);
        throw new Error(message);
      }
      this.cached = persisted;
      this.logger.debug(`Successfully Restored subscriptions for ${this.name}`);
      this.logger.trace({ type: "method", method: "restore", subscriptions: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore subscriptions for ${this.name}`);
      this.logger.error(e as any);
    }
  }

  private async batchSubscribe(subscriptions: SubscriberTypes.Params[]) {
    if (!subscriptions.length) return;
    const result = (await this.rpcBatchSubscribe(subscriptions)) as string[];
    if (!isValidArray(result)) return;
    this.onBatchSubscribe(result.map((id, i) => ({ ...subscriptions[i], id })));
  }

  private async onConnect() {
    if (this.restartInProgress) return;
    await this.restart();
    this.onEnable();
  }

  private onDisconnect() {
    this.onDisable();
  }

  private async checkPending() {
    if (this.relayer.transportExplicitlyClosed) {
      return;
    }
    const pendingSubscriptions: SubscriberTypes.Params[] = [];
    this.pending.forEach((params) => {
      pendingSubscriptions.push(params);
    });
    await this.batchSubscribe(pendingSubscriptions);
  }

  private registerEventListeners() {
    this.relayer.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, async () => {
      await this.checkPending();
    });
    this.relayer.on(RELAYER_EVENTS.connect, async () => {
      await this.onConnect();
    });
    this.relayer.on(RELAYER_EVENTS.disconnect, () => {
      this.onDisconnect();
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

  private isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }

  private async restartToComplete() {
    if (!this.restartInProgress) return;

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!this.restartInProgress) {
          clearInterval(interval);
          resolve();
        }
      }, this.pollingInterval);
    });
  }
}
