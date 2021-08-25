import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@walletconnect/logger";
import { RelayerTypes, IRelayer, IClient, ISubscription } from "@walletconnect/types";
import { RelayJsonRpc, RELAY_JSONRPC } from "@walletconnect/relay-api";
import { ERROR, formatRelayRpcUrl } from "@walletconnect/utils";
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
} from "../constants";

export class Relayer extends IRelayer {
  public events = new EventEmitter();

  public subscriptions: ISubscription;

  public provider: IJsonRpcProvider;

  public context: string = RELAYER_CONTEXT;

  constructor(public client: IClient, public logger: Logger, provider?: string | IJsonRpcProvider) {
    super(client, logger);
    this.logger = generateChildLogger(logger, this.context);
    this.subscriptions = new Subscription(client, this.logger, this);
    this.provider = this.setProvider(provider);
    this.registerEventListeners();
  }

  get connected(): boolean {
    return this.provider.connection.connected;
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.provider.connect();
    await this.subscriptions.init();
  }

  public async publish(
    topic: string,
    payload: JsonRpcPayload,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void> {
    this.logger.debug(`Publishing Payload`);
    this.logger.trace({ type: "method", method: "publish", params: { topic, payload, opts } });
    try {
      const protocol = opts?.relay.protocol || RELAYER_DEFAULT_PROTOCOL;
      const message = await this.client.crypto.encodeJsonRpc(topic, payload);
      const jsonRpc = getRelayProtocolJsonRpc(protocol);
      const request: RequestArguments<RelayJsonRpc.PublishParams> = {
        method: jsonRpc.publish,
        params: {
          topic,
          message,
          ttl: opts?.ttl || RELAYER_DEFAULT_PUBLISH_TTL,
        },
      };
      this.logger.debug(`Outgoing Relay Payload`);
      this.logger.trace({ type: "payload", direction: "outgoing", request });
      await this.provider.request(request);
      this.logger.debug(`Successfully Published Payload`);
      this.logger.trace({ type: "method", method: "publish", request });
    } catch (e) {
      this.logger.debug(`Failed to Publish Payload`);
      this.logger.error(e);
      throw e;
    }
  }

  public async subscribe(
    topic: string,
    expiry: number,
    opts?: RelayerTypes.SubscribeOptions,
  ): Promise<string> {
    this.logger.debug(`Subscribing Topic`);
    this.logger.trace({ type: "method", method: "subscribe", params: { topic, opts } });
    try {
      const relay = opts?.relay || { protocol: RELAYER_DEFAULT_PROTOCOL };
      const jsonRpc = getRelayProtocolJsonRpc(relay.protocol);
      const request: RequestArguments<RelayJsonRpc.SubscribeParams> = {
        method: jsonRpc.subscribe,
        params: {
          topic,
        },
      };
      this.logger.debug(`Outgoing Relay Payload`);
      this.logger.trace({ type: "payload", direction: "outgoing", request });
      const id = await this.provider.request(request);
      const subscription = { id, topic, expiry, relay };
      await this.subscriptions.set(id, subscription);
      this.logger.debug(`Successfully Subscribed Topic`);
      this.logger.trace({ type: "method", method: "subscribe", request });
      return id;
    } catch (e) {
      this.logger.debug(`Failed to Subscribe Topic`);
      this.logger.error(e);
      throw e;
    }
  }

  public async unsubscribe(
    topic: string,
    id: string,
    opts?: RelayerTypes.SubscribeOptions,
  ): Promise<void> {
    this.logger.debug(`Unsubscribing Topic`);
    this.logger.trace({ type: "method", method: "unsubscribeById", params: { id, opts } });
    try {
      const protocol = opts?.relay.protocol || RELAYER_DEFAULT_PROTOCOL;
      const jsonRpc = getRelayProtocolJsonRpc(protocol);
      const request: RequestArguments<RelayJsonRpc.UnsubscribeParams> = {
        method: jsonRpc.unsubscribe,
        params: {
          topic,
          id,
        },
      };
      this.logger.debug(`Outgoing Relay Payload`);
      this.logger.trace({ type: "payload", direction: "outgoing", request });

      await this.provider.request(request);
      this.events.removeAllListeners(id);
      // TODO: change reason
      await this.subscriptions.delete(id, ERROR.GENERIC.format());
      this.logger.debug(`Successfully Unsubscribed Topic`);
      this.logger.trace({ type: "method", method: "unsubscribe", request });
    } catch (e) {
      this.logger.debug(`Failed to Unsubscribe Topic`);
      this.logger.error(e);
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

  private async onPayload(payload: JsonRpcPayload) {
    this.logger.debug(`Incoming Relay Payload`);
    this.logger.trace({ type: "payload", direction: "incoming", payload });
    if (isJsonRpcRequest(payload)) {
      if (payload.method.endsWith("_subscription")) {
        const event = (payload as JsonRpcRequest<RelayJsonRpc.SubscriptionParams>).params;
        const { topic, message } = event.data;
        const eventPayload = {
          topic,
          payload: await this.client.crypto.decodeJsonRpc(topic, message),
        };
        this.events.emit(event.id, eventPayload);
        await this.ackPayload(payload);
      }
    }
  }

  private async ackPayload(payload: JsonRpcPayload) {
    const response = formatJsonRpcResult(payload.id, true);
    await this.provider.connection.send(response);
  }

  private setProvider(provider?: string | IJsonRpcProvider): IJsonRpcProvider {
    this.logger.debug(`Setting Relay Provider`);
    this.logger.trace({ type: "method", method: "setProvider", provider: provider?.toString() });
    const rpcUrl = formatRelayRpcUrl(
      this.client.protocol,
      this.client.version,
      typeof provider === "string" ? provider : RELAYER_DEFAULT_RPC_URL,
    );
    return typeof provider !== "string" && typeof provider !== "undefined"
      ? provider
      : new JsonRpcProvider(new WsConnection(rpcUrl));
  }

  private registerEventListeners(): void {
    this.provider.on("payload", (payload: JsonRpcPayload) => this.onPayload(payload));
    this.provider.on("connect", () => this.events.emit(RELAYER_EVENTS.connect));
    this.provider.on("disconnect", () => {
      this.events.emit(RELAYER_EVENTS.disconnect);
      setTimeout(() => this.provider.connect(), 1000);
    });
    this.provider.on("error", e => this.events.emit(RELAYER_EVENTS.error, e));
  }
}

function getRelayProtocolJsonRpc(protocol: string) {
  const jsonrpc = RELAY_JSONRPC[protocol];
  if (typeof jsonrpc === "undefined") {
    throw new Error(`Relay Protocol not supported: ${protocol}`);
  }
  return jsonrpc;
}
