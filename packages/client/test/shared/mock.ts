import { EventEmitter } from "events";
import JsonRpcProvider from "@walletconnect/jsonrpc-provider";
import WsConnection from "@walletconnect/jsonrpc-ws-connection";
import { IEvents } from "@walletconnect/events";
import {
  IJsonRpcProvider,
  JsonRpcPayload,
  JsonRpcRequest,
  RequestArguments,
} from "@walletconnect/jsonrpc-types";
import { RelayJsonRpc, RELAY_JSONRPC } from "@walletconnect/relay-api";
import {
  PUBLISHER_DEFAULT_TTL,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  RELAYER_RECONNECT_TIMEOUT,
  RELAYER_SUBSCRIBER_SUFFIX,
} from "../../src";
import { formatJsonRpcResult, isJsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import { IRelayerEncoder, RelayerTypes } from "@walletconnect/types";
import { toMiliseconds } from "@walletconnect/utils";
import { RelayerEncoder } from "../../src/controllers";

export class MockWakuRelayer implements IEvents {
  public events = new EventEmitter();

  public protocol = "waku";

  public jsonRpc = RELAY_JSONRPC[this.protocol];

  public provider: IJsonRpcProvider;

  public encoder: IRelayerEncoder;

  constructor(rpcUrl: string) {
    this.provider = new JsonRpcProvider(new WsConnection(rpcUrl));
    this.encoder = new RelayerEncoder();
    this.registerEventListeners();
  }

  get connected(): boolean {
    return this.provider.connection.connected;
  }

  get connecting(): boolean {
    return this.provider.connection.connecting;
  }

  public async init(): Promise<void> {
    await this.provider.connect();
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

  public async publish(topic: string, payload: JsonRpcPayload): Promise<void> {
    const request: RequestArguments<RelayJsonRpc.PublishParams> = {
      method: this.jsonRpc.publish,
      params: {
        topic,
        message: await this.encoder.encode(topic, payload),
        ttl: PUBLISHER_DEFAULT_TTL,
      },
    };
    return this.provider.request(request);
  }

  public async subscribe(topic: string): Promise<string> {
    const request: RequestArguments<RelayJsonRpc.SubscribeParams> = {
      method: this.jsonRpc.subscribe,
      params: {
        topic,
      },
    };
    return this.provider.request(request);
  }

  public async unsubscribe(topic: string, id: string): Promise<void> {
    const request: RequestArguments<RelayJsonRpc.UnsubscribeParams> = {
      method: this.jsonRpc.unsubscribe,
      params: {
        topic,
        id,
      },
    };
    return this.provider.request(request);
  }

  // ---------- Private ----------------------------------------------- //

  private async onPayload(payload: JsonRpcPayload) {
    if (isJsonRpcRequest(payload)) {
      if (!payload.method.endsWith(RELAYER_SUBSCRIBER_SUFFIX)) return;
      const event = (payload as JsonRpcRequest<RelayJsonRpc.SubscriptionParams>).params;
      const { topic, message } = event.data;
      const payloadEvent = {
        topic,
        payload: await this.encoder.decode(topic, message),
      } as RelayerTypes.PayloadEvent;
      this.events.emit(event.id, payloadEvent);
      this.events.emit(RELAYER_EVENTS.payload, payloadEvent);
      await this.acknowledgePayload(payload);
    }
  }

  private async acknowledgePayload(payload: JsonRpcPayload) {
    const response = formatJsonRpcResult(payload.id, true);
    await this.provider.connection.send(response);
  }

  private registerEventListeners(): void {
    this.provider.on(RELAYER_PROVIDER_EVENTS.payload, (payload: JsonRpcPayload) =>
      this.onPayload(payload),
    );
    this.provider.on(RELAYER_PROVIDER_EVENTS.connect, async () => {
      this.events.emit(RELAYER_EVENTS.connect);
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.disconnect, () => {
      this.events.emit(RELAYER_EVENTS.disconnect);
      setTimeout(() => {
        this.provider.connect();
      }, toMiliseconds(RELAYER_RECONNECT_TIMEOUT));
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.error, e => this.events.emit(RELAYER_EVENTS.error, e));
  }
}
