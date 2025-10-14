import { EventEmitter } from "events";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { ErrorResponse, RequestArguments } from "@walletconnect/jsonrpc-types";
import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { ONE_SECOND, ONE_MINUTE, toMiliseconds } from "@walletconnect/time";
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
  sleep,
} from "@walletconnect/utils";
import {
  CORE_STORAGE_PREFIX,
  SUBSCRIBER_CONTEXT,
  SUBSCRIBER_EVENTS,
  SUBSCRIBER_STORAGE_VERSION,
  RELAYER_EVENTS,
  TRANSPORT_TYPES,
} from "../constants/index.js";
import { SubscriberTopicMap } from "./topicmap.js";

export class Subscriber extends ISubscriber {
  public subscriptions = new Map<string, SubscriberTypes.Active>();

  public topicMap = new SubscriberTopicMap();
  public events = new EventEmitter();
  public name = SUBSCRIBER_CONTEXT;
  public version = SUBSCRIBER_STORAGE_VERSION;
  public pending = new Map<string, SubscriberTypes.Params>();

  private cached: SubscriberTypes.Active[] = [];
  private initialized = false;
  private storagePrefix = CORE_STORAGE_PREFIX;
  private subscribeTimeout = toMiliseconds(ONE_MINUTE);
  private initialSubscribeTimeout = toMiliseconds(ONE_SECOND * 15);
  private clientId: string;
  private batchSubscribeTopicsLimit = 500;

  constructor(
    public relayer: IRelayer,
    public logger: Logger,
  ) {
    super(relayer, logger);
    this.relayer = relayer;
    this.logger = generateChildLogger(logger, this.name);
    this.clientId = ""; // assigned when calling this.getClientId()
  }

  public init: ISubscriber["init"] = async () => {
    if (!this.initialized) {
      this.logger.trace(`Initialized`);
      this.registerEventListeners();
      await this.restore();
    }
    this.initialized = true;
  };

  get context() {
    return getLoggerContext(this.logger);
  }

  get storageKey() {
    return (
      this.storagePrefix + this.version + this.relayer.core.customStoragePrefix + "//" + this.name
    );
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

  get hasAnyTopics() {
    return (
      this.topicMap.topics.length > 0 ||
      this.pending.size > 0 ||
      this.cached.length > 0 ||
      this.subscriptions.size > 0
    );
  }

  public subscribe: ISubscriber["subscribe"] = async (topic, opts) => {
    this.isInitialized();
    this.logger.debug(`Subscribing Topic`);
    this.logger.trace({ type: "method", method: "subscribe", params: { topic, opts } });
    try {
      const relay = getRelayProtocolName(opts);
      const params = { topic, relay, transportType: opts?.transportType };
      if (!opts?.internal?.skipSubscribe) {
        this.pending.set(topic, params);
      }
      const id = await this.rpcSubscribe(topic, relay, opts);
      if (typeof id === "string") {
        this.onSubscribe(id, params);
        this.logger.debug(`Successfully Subscribed Topic`);
        this.logger.trace({ type: "method", method: "subscribe", params: { topic, opts } });
      }
      return id;
    } catch (e) {
      this.logger.debug(`Failed to Subscribe Topic`);
      this.logger.error(e as any);
      throw e;
    }
  };

  public unsubscribe: ISubscriber["unsubscribe"] = async (topic, opts) => {
    this.isInitialized();
    if (typeof opts?.id !== "undefined") {
      await this.unsubscribeById(topic, opts.id, opts);
    } else {
      await this.unsubscribeByTopic(topic, opts);
    }
  };

  /**
   * returns `true` only if the topic is actively subscribed to i.e. not pending or cached
   */
  public isSubscribed: ISubscriber["isSubscribed"] = (topic: string) => {
    return new Promise((resolve) => {
      resolve(this.topicMap.topics.includes(topic));
    });
  };

  /**
   * returns `true` if the topic is known to the subscriber i.e. it is actively subscribed, pending, cached or in the topic map
   */
  public isKnownTopic: ISubscriber["isKnownTopic"] = (topic: string) => {
    return new Promise((resolve) => {
      resolve(
        this.topicMap.topics.includes(topic) ||
          this.pending.has(topic) ||
          this.cached.some((s) => s.topic === topic),
      );
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

  public start: ISubscriber["start"] = async () => {
    await this.onConnect();
  };

  public stop: ISubscriber["stop"] = async () => {
    await this.onDisconnect();
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

  private reset() {
    this.cached = [];
    this.initialized = true;
  }

  private onDisable() {
    // only write to this.cached if there are active subscriptions
    // as this.cached can be overridden if onDisable is called multiple times
    if (this.values.length > 0) {
      this.cached = this.values;
    }
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
      await this.restartToComplete({ topic, id, relay });
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

  private async rpcSubscribe(
    topic: string,
    relay: RelayerTypes.ProtocolOptions,
    opts?: RelayerTypes.SubscribeOptions,
  ) {
    const subId = await this.getSubscriptionId(topic);
    if (opts?.internal?.skipSubscribe) {
      return subId;
    }
    if (!opts || opts?.transportType === TRANSPORT_TYPES.relay) {
      await this.restartToComplete({ topic, id: topic, relay });
    }
    const api = getRelayProtocolApi(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.SubscribeParams> = {
      method: api.subscribe,
      params: {
        topic,
      },
    };
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "payload", direction: "outgoing", request });
    const shouldThrow = opts?.internal?.throwOnFailedPublish;
    try {
      // in link mode, allow the app to update its network state (i.e. active airplane mode) with small delay before attempting to subscribe
      if (opts?.transportType === TRANSPORT_TYPES.link_mode) {
        setTimeout(() => {
          if (this.relayer.connected || this.relayer.connecting) {
            this.relayer.request(request).catch((e) => this.logger.warn(e));
          }
        }, toMiliseconds(ONE_SECOND));
        return subId;
      }
      const subscribePromise = new Promise(async (resolve) => {
        const onSubscribe = (subscription: SubscriberEvents.Created) => {
          if (subscription.topic === topic) {
            this.events.removeListener(SUBSCRIBER_EVENTS.created, onSubscribe);
            resolve(subscription.id);
          }
        };
        this.events.on(SUBSCRIBER_EVENTS.created, onSubscribe);
        try {
          const result = await createExpiringPromise(
            new Promise((resolve, reject) => {
              this.relayer
                .request(request)
                .catch((e) => {
                  this.logger.warn(e, e?.message);
                  reject(e);
                })
                .then(resolve);
            }),
            this.initialSubscribeTimeout,
            `Subscribing to ${topic} failed, please try again`,
          );
          this.events.removeListener(SUBSCRIBER_EVENTS.created, onSubscribe);
          resolve(result);
        } catch (err) {}
      });

      const subscribe = createExpiringPromise(
        subscribePromise,
        this.subscribeTimeout,
        `Subscribing to ${topic} failed, please try again`,
      );

      const result = await subscribe;
      if (!result && shouldThrow) {
        throw new Error(`Subscribing to ${topic} failed, please try again`);
      }
      // return null to indicate that the subscription failed
      return result ? subId : null;
    } catch (err) {
      this.logger.debug(`Outgoing Relay Subscribe Payload stalled`);
      this.relayer.events.emit(RELAYER_EVENTS.connection_stalled);
      if (shouldThrow) {
        throw err;
      }
    }
    return null;
  }

  private async rpcBatchSubscribe(subscriptions: SubscriberTypes.Params[]) {
    if (!subscriptions.length) return;
    const relay = subscriptions[0].relay;
    const api = getRelayProtocolApi(relay!.protocol);
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
        new Promise((resolve) => {
          this.relayer
            .request(request)
            .catch((e) => this.logger.warn(e))
            .then(resolve);
        }),
        this.subscribeTimeout,
        "rpcBatchSubscribe failed, please try again",
      );
      await subscribe;
    } catch (err) {
      this.relayer.events.emit(RELAYER_EVENTS.connection_stalled);
    }
  }

  private async rpcBatchFetchMessages(subscriptions: SubscriberTypes.Params[]) {
    if (!subscriptions.length) return;
    const relay = subscriptions[0].relay;
    const api = getRelayProtocolApi(relay!.protocol);
    const request: RequestArguments<RelayJsonRpc.BatchFetchMessagesParams> = {
      method: api.batchFetchMessages,
      params: {
        topics: subscriptions.map((s) => s.topic),
      },
    };
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "payload", direction: "outgoing", request });
    let result;
    try {
      const fetchMessagesPromise = await createExpiringPromise(
        new Promise((resolve, reject) => {
          this.relayer
            .request(request)
            .catch((e) => {
              this.logger.warn(e);
              reject(e);
            })
            .then(resolve);
        }),
        this.subscribeTimeout,
        "rpcBatchFetchMessages failed, please try again",
      );
      result = (await fetchMessagesPromise) as {
        messages: RelayerTypes.MessageEvent[];
      };
    } catch (err) {
      this.relayer.events.emit(RELAYER_EVENTS.connection_stalled);
    }
    return result;
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
    await this.restore();
    await this.onRestart();
  };

  private async persist() {
    await this.setRelayerSubscriptions(this.values);
    this.events.emit(SUBSCRIBER_EVENTS.sync);
  }

  private async onRestart() {
    if (this.cached.length) {
      const subs = [...this.cached];
      const numOfBatches = Math.ceil(this.cached.length / this.batchSubscribeTopicsLimit);
      for (let i = 0; i < numOfBatches; i++) {
        const batch = subs.splice(0, this.batchSubscribeTopicsLimit);
        await this.batchSubscribe(batch);
      }
    }
    this.events.emit(SUBSCRIBER_EVENTS.resubscribed);
  }

  private async restore() {
    try {
      const persisted = await this.getRelayerSubscriptions();
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (
        this.subscriptions.size &&
        // throw only if the persisted topics differ
        !persisted.every((s) => s.topic === this.subscriptions.get(s.id)?.topic)
      ) {
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

    await this.rpcBatchSubscribe(subscriptions);
    this.onBatchSubscribe(
      await Promise.all(
        subscriptions.map(async (s) => {
          return { ...s, id: await this.getSubscriptionId(s.topic) };
        }),
      ),
    );
  }

  // @ts-ignore
  private async batchFetchMessages(subscriptions: SubscriberTypes.Params[]) {
    if (!subscriptions.length) return;
    this.logger.trace(`Fetching batch messages for ${subscriptions.length} subscriptions`);
    const response = await this.rpcBatchFetchMessages(subscriptions);
    if (response && response.messages) {
      await sleep(toMiliseconds(ONE_SECOND));
      await this.relayer.handleBatchMessageEvents(response.messages);
    }
  }

  private async onConnect() {
    await this.restart();
    this.reset();
  }

  private onDisconnect() {
    this.onDisable();
  }

  private checkPending = async () => {
    if (this.pending.size === 0 && (!this.initialized || !this.relayer.connected)) {
      return;
    }
    const pendingSubscriptions: SubscriberTypes.Params[] = [];
    this.pending.forEach((params) => {
      pendingSubscriptions.push(params);
    });

    await this.batchSubscribe(pendingSubscriptions);
  };

  private registerEventListeners = () => {
    this.relayer.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, async () => {
      await this.checkPending();
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
  };

  private isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }

  private async restartToComplete(subscription: SubscriberTypes.Active) {
    if (!this.relayer.connected && !this.relayer.connecting) {
      this.cached.push(subscription);
      await this.relayer.transportOpen();
    }
  }

  private async getClientId() {
    if (!this.clientId) {
      this.clientId = await this.relayer.core.crypto.getClientId();
    }
    return this.clientId;
  }

  private async getSubscriptionId(topic: string) {
    return hashMessage(topic + (await this.getClientId()));
  }
}
