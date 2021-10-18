import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import {
  RelayerTypes,
  IRelayer,
  IClient,
  ISubscription,
  IJsonRpcHistory,
  SubscriptionEvent,
  Reason,
  JsonRpcRecord,
} from "@walletconnect/types";
import { RelayJsonRpc, RELAY_JSONRPC } from "@walletconnect/relay-api";
import { ERROR, formatRelayRpcUrl, formatMessageContext } from "@walletconnect/utils";
import {
  IJsonRpcProvider,
  JsonRpcPayload,
  isJsonRpcRequest,
  JsonRpcRequest,
  formatJsonRpcResult,
  RequestArguments,
} from "@walletconnect/jsonrpc-utils";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import { WsConnection } from "@walletconnect/jsonrpc-ws-connection";

import { Subscription } from "./subscription";
import {
  RELAYER_CONTEXT,
  RELAYER_DEFAULT_PROTOCOL,
  RELAYER_DEFAULT_RPC_URL,
  RELAYER_DEFAULT_PUBLISH_TTL,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  RELAYER_SUBSCRIPTION_SUFFIX,
  RELAYER_RECONNECT_TIMEOUT,
  SUBSCRIPTION_EVENTS,
} from "../constants";
import { JsonRpcHistory } from "./history";

export class Relayer extends IRelayer {
  public events = new EventEmitter();

  public subscriptions: ISubscription;

  public history: IJsonRpcHistory;

  public provider: IJsonRpcProvider;

  public name: string = RELAYER_CONTEXT;

  constructor(public client: IClient, public logger: Logger, provider?: string | IJsonRpcProvider) {
    super(client, logger);
    this.logger = generateChildLogger(logger, this.name);
    this.subscriptions = new Subscription(client, this.logger);
    this.history = new JsonRpcHistory(client, this.logger);
    this.provider = this.setProvider(provider);
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
      const message = await this.client.crypto.encodeJsonRpc(topic, payload);
      const ttl = opts?.ttl || RELAYER_DEFAULT_PUBLISH_TTL;
      const relay = this.getRelayProtocol(opts);
      await this.rpcPublish(topic, message, ttl, relay);
      this.logger.debug(`Successfully Published Payload`);
      this.logger.trace({ type: "method", method: "publish", params: { topic, payload, opts } });
      await this.recordPayloadEvent({ topic, payload });
    } catch (e) {
      this.logger.debug(`Failed to Publish Payload`);
      this.logger.error(e as any);
      throw e;
    }
  }

  public async subscribe(
    topic: string,
    expiry: number,
    opts?: RelayerTypes.SubscribeOptions,
  ): Promise<string> {
    this.logger.debug(`Subscribing Topic`);
    this.logger.trace({ type: "method", method: "subscribe", params: { topic, expiry, opts } });
    try {
      const relay = this.getRelayProtocol(opts);
      const id = await this.rpcSubscribe(topic, relay);
      const subscription = { id, topic, expiry, relay };
      await this.subscriptions.set(id, subscription);
      this.logger.debug(`Successfully Subscribed Topic`);
      this.logger.trace({ type: "method", method: "subscribe", params: { topic, expiry, opts } });
      return id;
    } catch (e) {
      this.logger.debug(`Failed to Subscribe Topic`);
      this.logger.error(e as any);
      throw e;
    }
  }

  public async unsubscribe(
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

  public async unsubscribeByTopic(
    topic: string,
    opts?: RelayerTypes.UnsubscribeOptions,
  ): Promise<void> {
    const ids = this.subscriptions.topicMap.get(topic);
    await Promise.all(ids.map(async id => await this.unsubscribe(topic, id, opts)));
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
        payload: await this.client.crypto.decodeJsonRpc(topic, message),
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
        // get new subscription id
        const id = await this.rpcSubscribe(subscription.topic, subscription.relay);
        // set new subscription id
        await this.subscriptions.set(id, { ...subscription, id });
        // delete old subscription id
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

  private setProvider(provider?: string | IJsonRpcProvider): IJsonRpcProvider {
    this.logger.debug(`Setting Relay Provider`);
    this.logger.trace({ type: "method", method: "setProvider", provider: provider?.toString() });
    const rpcUrl = formatRelayRpcUrl(
      this.client.protocol,
      this.client.version,
      typeof provider === "string" ? provider : RELAYER_DEFAULT_RPC_URL,
      this.client.apiKey,
    );
    return typeof provider !== "string" && typeof provider !== "undefined"
      ? provider
      : new JsonRpcProvider(new WsConnection(rpcUrl));
  }

  private registerEventListeners(): void {
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
