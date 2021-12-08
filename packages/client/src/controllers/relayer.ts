import { EventEmitter } from "events";
import pino, { Logger } from "pino";
import KeyValueStorage from "keyvaluestorage";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import {
  RelayerTypes,
  IRelayer,
  ISubscription,
  IJsonRpcHistory,
  SubscriptionEvent,
  SubscriptionParams,
  PublishParams,
  Reason,
  JsonRpcRecord,
  IHeartBeat,
  IRelayerEncoder,
  RelayerOptions,
  Storage,
} from "@walletconnect/types";
import { RelayJsonRpc, RELAY_JSONRPC } from "@walletconnect/relay-api";
import { ERROR, formatMessageContext } from "@walletconnect/utils";
import {
  IJsonRpcProvider,
  JsonRpcPayload,
  isJsonRpcRequest,
  JsonRpcRequest,
  formatJsonRpcResult,
  RequestArguments,
} from "@walletconnect/jsonrpc-utils";

import { Subscription } from "./subscription";
import {
  HEARTBEAT_EVENTS,
  RELAYER_CONTEXT,
  RELAYER_DEFAULT_PROTOCOL,
  RELAYER_DEFAULT_PUBLISH_TTL,
  REALYER_DEFAULT_LOGGER,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  RELAYER_SUBSCRIPTION_SUFFIX,
  RELAYER_RECONNECT_TIMEOUT,
  RELAYER_STORAGE_OPTIONS,
  SUBSCRIPTION_EVENTS,
} from "../constants";
import { JsonRpcHistory } from "./history";
import { RelayerStorage } from "./storage";
import { formatRelayProvider } from "./shared";

export class Relayer extends IRelayer {
  public readonly protocol = "irn";
  public readonly version = 1;

  public logger: Logger;

  public storage: Storage;

  public events = new EventEmitter();

  public queue = new Map<number, PublishParams>();

  public pending = new Map<string, SubscriptionParams>();

  public subscriptions: ISubscription;

  public history: IJsonRpcHistory;

  public provider: IJsonRpcProvider;

  public name: string = RELAYER_CONTEXT;

  constructor(
    public heartbeat: IHeartBeat,
    public encoder: IRelayerEncoder,
    opts?: RelayerOptions,
  ) {
    super(heartbeat, encoder);
    this.logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? generateChildLogger(opts.logger, this.name)
        : pino(getDefaultLoggerOptions({ level: opts?.logger || REALYER_DEFAULT_LOGGER }));
    const keyValueStorage = opts?.keyValueStorage || new KeyValueStorage(RELAYER_STORAGE_OPTIONS);
    this.storage =
      typeof opts?.storage !== "undefined"
        ? opts.storage
        : new RelayerStorage(this.logger, keyValueStorage, {
            protocol: this.protocol,
            version: this.version,
            context: this.context,
          });
    this.subscriptions = new Subscription(this.logger, this.storage);
    this.history = new JsonRpcHistory(this.logger, this.storage);
    this.provider = formatRelayProvider(this.protocol, this.version, opts?.provider, opts?.apiKey);
    this.registerEventListeners();
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get connected(): boolean {
    return this.provider.connection.connected;
  }

  get connecting(): boolean {
    return this.provider.connection.connecting;
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.history.init();
    await this.provider.connect();
    await this.subscriptions.init();
    await this.resubscribe();
  }

  public async publish(
    topic: string,
    payload: JsonRpcPayload,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void> {
    this.logger.debug(`Publishing Payload`);
    this.logger.trace({ type: "method", method: "publish", params: { topic, payload, opts } });
    try {
      const ttl = opts?.ttl || RELAYER_DEFAULT_PUBLISH_TTL;
      const relay = this.getRelayProtocol(opts);
      const params = { topic, payload, opts: { ttl, relay } };
      this.queue.set(payload.id, params);
      const message = await this.encoder.encode(topic, payload);
      await this.rpcPublish(topic, message, ttl, relay);
      await this.onPublish(payload.id, params);
      this.logger.debug(`Successfully Published Payload`);
      this.logger.trace({ type: "method", method: "publish", params: { topic, payload, opts } });
    } catch (e) {
      this.logger.debug(`Failed to Publish Payload`);
      this.logger.error(e as any);
      throw e;
    }
  }

  public async subscribe(topic: string, opts?: RelayerTypes.SubscribeOptions): Promise<string> {
    this.logger.debug(`Subscribing Topic`);
    this.logger.trace({ type: "method", method: "subscribe", params: { topic, opts } });
    try {
      const relay = this.getRelayProtocol(opts);
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
    const ids = this.subscriptions.topicMap.get(topic);
    await Promise.all(ids.map(async id => await this.unsubscribeById(topic, id, opts)));
  }

  public async unsubscribeById(
    topic: string,
    id: string,
    opts?: RelayerTypes.UnsubscribeOptions,
  ): Promise<void> {
    this.logger.debug(`Unsubscribing Topic`);
    this.logger.trace({ type: "method", method: "unsubscribe", params: { topic, id, opts } });
    try {
      const relay = this.getRelayProtocol(opts);
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

  private getRelayProtocol(opts?: RelayerTypes.RequestOptions): RelayerTypes.ProtocolOptions {
    return opts?.relay || { protocol: RELAYER_DEFAULT_PROTOCOL };
  }

  private async rpcPublish(
    topic: string,
    message: string,
    ttl: number,
    relay: RelayerTypes.ProtocolOptions,
  ): Promise<void> {
    const jsonRpc = getRelayProtocolJsonRpc(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.PublishParams> = {
      method: jsonRpc.publish,
      params: {
        topic,
        message,
        ttl,
      },
    };
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "payload", direction: "outgoing", request });
    return this.provider.request(request);
  }

  private async rpcSubscribe(topic: string, relay: RelayerTypes.ProtocolOptions): Promise<string> {
    const jsonRpc = getRelayProtocolJsonRpc(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.SubscribeParams> = {
      method: jsonRpc.subscribe,
      params: {
        topic,
      },
    };
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "payload", direction: "outgoing", request });
    return this.provider.request(request);
  }

  private async rpcUnsubscribe(
    topic: string,
    id: string,
    relay: RelayerTypes.ProtocolOptions,
  ): Promise<void> {
    const jsonRpc = getRelayProtocolJsonRpc(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.UnsubscribeParams> = {
      method: jsonRpc.unsubscribe,
      params: {
        topic,
        id,
      },
    };
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "payload", direction: "outgoing", request });
    return this.provider.request(request);
  }

  private async onPublish(id: number, params: PublishParams) {
    const { topic, payload } = params;
    await this.recordPayloadEvent({ topic, payload });
    this.queue.delete(id);
  }

  private async onSubscribe(id: string, params: SubscriptionParams) {
    const subscription = { id, ...params };
    await this.subscriptions.set(id, subscription);
    this.pending.delete(params.topic);
  }

  private async onUnsubscribe(topic: string, id: string, reason: Reason) {
    this.events.removeAllListeners(id);
    if (await this.subscriptions.exists(id, topic)) {
      await this.subscriptions.delete(id, reason);
    }
    await this.history.delete(topic);
  }

  private async recordPayloadEvent(payloadEvent: RelayerTypes.PayloadEvent) {
    const { topic, payload } = payloadEvent;
    if (isJsonRpcRequest(payload)) {
      await this.history.set(topic, payload);
    } else {
      await this.history.resolve(payload);
    }
  }

  private async shouldIgnorePayloadEvent(payloadEvent: RelayerTypes.PayloadEvent) {
    const { topic, payload } = payloadEvent;
    if (!this.subscriptions.topics.includes(topic)) return true;
    let exists = false;
    try {
      if (isJsonRpcRequest(payload)) {
        exists = await this.history.exists(topic, payload.id);
      } else {
        let record: JsonRpcRecord | undefined;
        try {
          record = await this.history.get(topic, payload.id);
        } catch (e) {
          // skip error
        }
        exists = typeof record !== "undefined" && typeof record.response !== "undefined";
      }
    } catch (e) {
      // skip error
    }
    return exists;
  }

  private async onPayload(payload: JsonRpcPayload) {
    this.logger.debug(`Incoming Relay Payload`);
    this.logger.trace({ type: "payload", direction: "incoming", payload });
    if (isJsonRpcRequest(payload)) {
      if (!payload.method.endsWith(RELAYER_SUBSCRIPTION_SUFFIX)) return;
      const event = (payload as JsonRpcRequest<RelayJsonRpc.SubscriptionParams>).params;
      const { topic, message } = event.data;
      const payloadEvent = {
        topic,
        payload: await this.encoder.decode(topic, message),
      } as RelayerTypes.PayloadEvent;
      if (await this.shouldIgnorePayloadEvent(payloadEvent)) return;
      this.logger.debug(`Emitting Relayer Payload`);
      this.logger.trace({ type: "event", event: event.id, ...payloadEvent });
      this.events.emit(event.id, payloadEvent);
      this.events.emit(RELAYER_EVENTS.payload, payloadEvent);
      await this.acknowledgePayload(payload);
      await this.recordPayloadEvent(payloadEvent);
    }
  }

  private async acknowledgePayload(payload: JsonRpcPayload) {
    const response = formatJsonRpcResult(payload.id, true);
    await this.provider.connection.send(response);
  }

  private async resubscribe() {
    await Promise.all(
      this.subscriptions.values.map(async subscription => {
        const { topic, relay } = subscription;
        const params = { topic, relay };
        this.pending.set(params.topic, params);
        const id = await this.rpcSubscribe(params.topic, params.relay);
        await this.onSubscribe(id, params);
        const reason = ERROR.RESUBSCRIBED.format({ topic: subscription.topic });
        await this.subscriptions.delete(subscription.id, reason);
      }),
    );
  }

  private async onConnect() {
    await this.subscriptions.enable();
    await this.resubscribe();
  }

  private async onDisconnect() {
    await this.subscriptions.disable();
    setTimeout(() => {
      this.provider.connect();
    }, RELAYER_RECONNECT_TIMEOUT);
  }

  private checkQueue(): void {
    this.queue.forEach(async params => {
      const {
        topic,
        payload,
        opts: { ttl, relay },
      } = params;
      const message = await this.encoder.encode(topic, payload);
      await this.rpcPublish(topic, message, ttl, relay);
      await this.onPublish(payload.id, params);
    });
  }

  private checkPending(): void {
    this.pending.forEach(async params => {
      const id = await this.rpcSubscribe(params.topic, params.relay);
      await this.onSubscribe(id, params);
    });
  }

  private registerEventListeners(): void {
    this.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => {
      this.checkQueue();
      this.checkPending();
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.payload, (payload: JsonRpcPayload) =>
      this.onPayload(payload),
    );
    this.provider.on(RELAYER_PROVIDER_EVENTS.connect, async () => {
      await this.onConnect();
      this.events.emit(RELAYER_EVENTS.connect);
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.disconnect, async () => {
      await this.onDisconnect();
      this.events.emit(RELAYER_EVENTS.disconnect);
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.error, e => this.events.emit(RELAYER_EVENTS.error, e));
    this.subscriptions.on(
      SUBSCRIPTION_EVENTS.expired,
      async (expiredEvent: SubscriptionEvent.Deleted) => {
        const { topic, id, relay } = expiredEvent;
        await this.rpcUnsubscribe(topic, id, relay);
        await this.onUnsubscribe(topic, id, expiredEvent.reason);
      },
    );
  }
}

function getRelayProtocolJsonRpc(protocol: string) {
  const jsonrpc = RELAY_JSONRPC[protocol];
  if (typeof jsonrpc === "undefined") {
    throw new Error(`Relay Protocol not supported: ${protocol}`);
  }
  return jsonrpc;
}
