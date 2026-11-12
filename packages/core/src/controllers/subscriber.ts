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
  public events: EventEmitter = new EventEmitter();
  public name = SUBSCRIBER_CONTEXT;
  public version = SUBSCRIBER_STORAGE_VERSION;
  public pending = new Map<string, SubscriberTypes.Params>();

  private cached: SubscriberTypes.Active[] = [];
  private initialized = false;
  private storagePrefix = CORE_STORAGE_PREFIX;
  private subscribeTimeout = toMiliseconds(ONE_MINUTE);
  private initialSubscribeTimeout = toMiliseconds(ONE_SECOND * 15);
  private clientId: string;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly requestOwners = new WeakMap<SubscriberTypes.Params, AbortSignal>();
  private readonly pendingPersistence = new Set<Promise<void>>();
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
    this.relayer.core.assertActive();
    if (!this.initialized) {
      this.logger.trace(`Initialized`);
      this.registerEventListeners();
      await this.restore();
      this.relayer.core.assertActive();
    }
    this.initialized = true;
  };

  public async dispose(): Promise<void> {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.events.removeAllListeners();
    await Promise.allSettled(this.pendingPersistence);
    this.pending.clear();
    this.cached = [];
    this.subscriptions.clear();
    this.topicMap.clear();
  }

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

  public subscribe: ISubscriber["subscribe"] = async (
    topic,
    opts,
    signal = this.relayer.core.signal,
  ) => {
    this.isInitialized();
    this.relayer.assertOwner(signal);
    this.logger.debug(`Subscribing Topic`);
    this.logger.trace({ type: "method", method: "subscribe", params: { topic, opts } });
    const relay = getRelayProtocolName(opts);
    const params = { topic, relay, transportType: opts?.transportType };
    try {
      if (!opts?.internal?.skipSubscribe) {
        this.pending.set(topic, params);
        this.requestOwners.set(params, signal);
      }
      const id = await this.rpcSubscribe(topic, relay, opts, signal);
      this.relayer.assertOwner(signal);
      if (typeof id === "string") {
        this.onSubscribe(id, params);
        await Promise.all(this.pendingPersistence);
        this.relayer.assertOwner(signal);
        this.logger.debug(`Successfully Subscribed Topic`);
        this.logger.trace({ type: "method", method: "subscribe", params: { topic, opts } });
      }
      return id;
    } catch (e) {
      if (signal.aborted && this.pending.get(topic) === params) {
        this.pending.delete(topic);
      }
      this.logger.debug(`Failed to Subscribe Topic`);
      this.logger.error(e as any);
      throw e;
    }
  };

  public unsubscribe: ISubscriber["unsubscribe"] = async (
    topic,
    opts,
    signal = this.relayer.core.signal,
  ) => {
    this.isInitialized();
    this.relayer.assertOwner(signal);
    if (typeof opts?.id !== "undefined") {
      await this.unsubscribeById(topic, opts.id, opts, signal);
    } else {
      await this.unsubscribeByTopic(topic, opts, signal);
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
    this.relayer.core.assertActive();
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

  private async unsubscribeByTopic(
    topic: string,
    opts?: RelayerTypes.UnsubscribeOptions,
    signal = this.relayer.core.signal,
  ) {
    const ids = this.topicMap.get(topic);
    await Promise.all(ids.map(async (id) => await this.unsubscribeById(topic, id, opts, signal)));
  }

  private async unsubscribeById(
    topic: string,
    id: string,
    opts?: RelayerTypes.UnsubscribeOptions,
    signal = this.relayer.core.signal,
  ) {
    this.logger.debug(`Unsubscribing Topic`);
    this.logger.trace({ type: "method", method: "unsubscribe", params: { topic, id, opts } });
    try {
      this.relayer.assertOwner(signal);
      // optimistically remove the subscription from the local state
      const reason = getSdkError("USER_DISCONNECTED", `${this.name}, ${topic}`);
      await this.onUnsubscribe(topic, id, reason, signal);
      this.relayer.assertOwner(signal);
      const relay = getRelayProtocolName(opts);
      await this.restartToComplete({ topic, id, relay }, signal);
      this.relayer.assertOwner(signal);
      await this.rpcUnsubscribe(topic, id, relay, signal);
      this.relayer.assertOwner(signal);
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
    signal = this.relayer.core.signal,
  ) {
    const subId = await this.getSubscriptionId(topic);
    this.relayer.assertOwner(signal);
    const owner = signal;
    return this.relayer.withOwner(async (signal) => {
      if (opts?.internal?.skipSubscribe) {
        return subId;
      }
      if (!opts || opts?.transportType === TRANSPORT_TYPES.relay) {
        await this.restartToComplete({ topic, id: topic, relay }, signal);
        this.relayer.assertOwner(signal);
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
      let onSubscribe: ((subscription: SubscriberEvents.Created) => void) | undefined;
      try {
        // in link mode, allow the app to update its network state (i.e. active airplane mode) with small delay before attempting to subscribe
        if (opts?.transportType === TRANSPORT_TYPES.link_mode) {
          const cancel = () => {
            clearTimeout(timer);
            this.timers.delete(timer);
            owner.removeEventListener("abort", cancel);
            this.relayer.core.signal.removeEventListener("abort", cancel);
          };
          const timer = setTimeout(() => {
            cancel();
            if (this.relayer.core.signal.aborted || owner.aborted) return;
            if (this.relayer.connected || this.relayer.connecting) {
              this.relayer.request(request, owner).catch((e) => this.logger.warn(e));
            }
          }, toMiliseconds(ONE_SECOND));
          this.timers.add(timer);
          owner.addEventListener("abort", cancel, { once: true });
          this.relayer.core.signal.addEventListener("abort", cancel, { once: true });
          if (owner.aborted || this.relayer.core.signal.aborted) cancel();
          return subId;
        }
        const subscribePromise = new Promise(async (resolve) => {
          const listener = (subscription: SubscriberEvents.Created) => {
            if (subscription.topic === topic) {
              this.events.removeListener(SUBSCRIBER_EVENTS.created, listener);
              resolve(subscription.id);
            }
          };
          onSubscribe = listener;
          this.events.on(SUBSCRIBER_EVENTS.created, listener);
          try {
            const result = await createExpiringPromise(
              new Promise((resolve, reject) => {
                this.relayer
                  .request(request, signal)
                  .catch((e) => {
                    this.logger.warn(e, e?.message);
                    reject(e);
                  })
                  .then(resolve);
              }),
              this.initialSubscribeTimeout,
              `Subscribing to ${topic} failed, please try again`,
              signal,
            );
            this.events.removeListener(SUBSCRIBER_EVENTS.created, listener);
            resolve(result);
          } catch (err) {}
        });

        const subscribe = createExpiringPromise(
          subscribePromise,
          this.subscribeTimeout,
          `Subscribing to ${topic} failed, please try again`,
          signal,
        );

        const result = await subscribe;
        this.relayer.assertOwner(signal);
        if (!result && shouldThrow) {
          throw new Error(`Subscribing to ${topic} failed, please try again`);
        }
        // return null to indicate that the subscription failed
        return result ? subId : null;
      } catch (err) {
        this.relayer.assertOwner(signal);
        this.logger.debug(`Outgoing Relay Subscribe Payload stalled`);
        this.relayer.events.emit(RELAYER_EVENTS.connection_stalled);
        if (shouldThrow) {
          throw err;
        }
      } finally {
        if (onSubscribe) this.events.off(SUBSCRIBER_EVENTS.created, onSubscribe);
      }
      return null;
    }, signal);
  }

  private async rpcBatchSubscribe(subscriptions: SubscriberTypes.Params[]): Promise<boolean> {
    if (!subscriptions.length) return true;
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
      await createExpiringPromise(
        new Promise((resolve, reject) => {
          this.relayer
            .request(request)
            .then(resolve)
            .catch((e) => {
              this.logger.warn(e);
              reject(e);
            });
        }),
        this.subscribeTimeout,
        "rpcBatchSubscribe failed, please try again",
        this.relayer.core.signal,
      );
      return true;
    } catch (err) {
      this.relayer.events.emit(RELAYER_EVENTS.connection_stalled);
      return false;
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
        this.relayer.core.signal,
      );
      result = (await fetchMessagesPromise) as {
        messages: RelayerTypes.MessageEvent[];
      };
    } catch (err) {
      this.relayer.events.emit(RELAYER_EVENTS.connection_stalled);
    }
    return result;
  }

  private rpcUnsubscribe(
    topic: string,
    id: string,
    relay: RelayerTypes.ProtocolOptions,
    signal = this.relayer.core.signal,
  ) {
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
    return this.relayer.request(request, signal);
  }

  private onSubscribe(id: string, params: SubscriberTypes.Params) {
    this.setSubscription(id, { ...params, id });
    this.pending.delete(params.topic);
  }

  private onBatchSubscribe(
    subscriptions: SubscriberTypes.Active[],
    owners: (AbortSignal | undefined)[] = [],
  ) {
    if (!subscriptions.length) return;
    subscriptions.forEach((subscription, index) => {
      if (owners[index]?.aborted) {
        const pending = this.pending.get(subscription.topic);
        if (pending && this.requestOwners.get(pending) === owners[index])
          this.pending.delete(subscription.topic);
        return;
      }
      this.setSubscription(subscription.id, { ...subscription });
      this.pending.delete(subscription.topic);
    });
  }

  private async onUnsubscribe(
    topic: string,
    id: string,
    reason: ErrorResponse,
    signal = this.relayer.core.signal,
  ) {
    this.relayer.assertOwner(signal);
    this.events.removeAllListeners(id);
    if (this.hasSubscription(id, topic)) {
      this.deleteSubscription(id, reason);
    }
    await Promise.all(this.pendingPersistence);
    this.relayer.assertOwner(signal);
    await this.relayer.messages.del(topic);
    this.relayer.assertOwner(signal);
  }

  private async setRelayerSubscriptions(subscriptions: SubscriberTypes.Active[]) {
    await this.relayer.core.run(() =>
      this.relayer.core.storage.setItem<SubscriberTypes.Active[]>(this.storageKey, subscriptions),
    );
  }

  private async getRelayerSubscriptions() {
    const subscriptions = await this.relayer.core.run(() =>
      this.relayer.core.storage.getItem<SubscriberTypes.Active[]>(this.storageKey),
    );
    return subscriptions;
  }

  private setSubscription(id: string, subscription: SubscriberTypes.Active) {
    this.relayer.core.assertActive();
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
    this.relayer.core.assertActive();
    await this.onRestart();
  };

  private async persist() {
    const pending = this.setRelayerSubscriptions(this.values);
    this.pendingPersistence.add(pending);
    try {
      await pending;
      this.relayer.core.assertActive();
      this.events.emit(SUBSCRIBER_EVENTS.sync);
    } finally {
      this.pendingPersistence.delete(pending);
    }
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

    const owners = subscriptions.map((subscription) => this.requestOwners.get(subscription));
    const success = await this.rpcBatchSubscribe(subscriptions);
    this.relayer.core.assertActive();
    if (!success) {
      this.logger.warn(
        `Batch subscribe failed for ${subscriptions.length} topics, adding to pending for retry`,
      );
      subscriptions.forEach((s, index) => {
        if (!owners[index]?.aborted) this.pending.set(s.topic, s);
      });
      return;
    }
    this.onBatchSubscribe(
      await Promise.all(
        subscriptions.map(async (s) => {
          return { ...s, id: await this.getSubscriptionId(s.topic) };
        }),
      ),
      owners,
    );
  }

  // @ts-ignore
  private async batchFetchMessages(subscriptions: SubscriberTypes.Params[]) {
    if (!subscriptions.length) return;
    this.logger.trace(`Fetching batch messages for ${subscriptions.length} subscriptions`);
    const response = await this.rpcBatchFetchMessages(subscriptions);
    if (response && response.messages) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          this.timers.delete(timer);
          this.relayer.core.signal.removeEventListener("abort", abort);
        };
        const abort = () => {
          cleanup();
          reject(new Error("WalletConnect Core is disposed"));
        };
        const timer = setTimeout(() => {
          cleanup();
          resolve();
        }, toMiliseconds(ONE_SECOND));
        this.timers.add(timer);
        this.relayer.core.signal.addEventListener("abort", abort, { once: true });
        if (this.relayer.core.signal.aborted) abort();
      });
      this.relayer.core.assertActive();
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
      if (this.requestOwners.get(params)?.aborted) {
        this.pending.delete(params.topic);
        return;
      }
      pendingSubscriptions.push(params);
    });

    await this.batchSubscribe(pendingSubscriptions);
  };

  private registerEventListeners = () => {
    this.relayer.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, async () => {
      if (this.relayer.core.signal.aborted) return;
      await this.checkPending().catch((error) => {
        if (!this.relayer.core.signal.aborted) this.logger.warn(error);
      });
    });
    this.events.on(SUBSCRIBER_EVENTS.created, (createdEvent: SubscriberEvents.Created) => {
      const eventName = SUBSCRIBER_EVENTS.created;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: createdEvent });
      this.persist().catch((error) => {
        if (!this.relayer.core.signal.aborted) this.logger.warn(error);
      });
    });
    this.events.on(SUBSCRIBER_EVENTS.deleted, (deletedEvent: SubscriberEvents.Deleted) => {
      const eventName = SUBSCRIBER_EVENTS.deleted;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: deletedEvent });
      this.persist().catch((error) => {
        if (!this.relayer.core.signal.aborted) this.logger.warn(error);
      });
    });
  };

  private isInitialized() {
    this.relayer.core.assertActive();
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }

  private async restartToComplete(
    subscription: SubscriberTypes.Active,
    signal = this.relayer.core.signal,
  ) {
    this.relayer.assertOwner(signal);
    if (!this.relayer.connected && !this.relayer.connecting) {
      this.cached.push(subscription);
      this.requestOwners.set(subscription, signal);
      const cancel = () => {
        this.cached = this.cached.filter((item) => item !== subscription);
      };
      signal.addEventListener("abort", cancel, { once: true });
      try {
        await this.relayer.withOwner(() => this.relayer.transportOpen(), signal);
        this.relayer.assertOwner(signal);
      } finally {
        signal.removeEventListener("abort", cancel);
        if (signal.aborted) cancel();
      }
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
