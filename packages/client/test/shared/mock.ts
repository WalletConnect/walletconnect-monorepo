import { EventEmitter } from "events";
import * as encoding from "@walletconnect/encoding";
import JsonRpcProvider from "@walletconnect/jsonrpc-provider";
import WsConnection from "@walletconnect/jsonrpc-ws-connection";
import {
  IEvents,
  IJsonRpcProvider,
  JsonRpcPayload,
  JsonRpcRequest,
  RequestArguments,
} from "@walletconnect/jsonrpc-types";
import { RelayJsonRpc, RELAY_JSONRPC } from "@walletconnect/relay-api";
import {
  RELAYER_DEFAULT_PUBLISH_TTL,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  RELAYER_RECONNECT_TIMEOUT,
  RELAYER_SUBSCRIPTION_SUFFIX,
} from "../../src";
import { formatJsonRpcResult, isJsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import { RelayerTypes } from "@walletconnect/types";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { toMiliseconds } from "@walletconnect/utils";

export class MockWakuRelayer implements IEvents {
  public events = new EventEmitter();

  public protocol = "waku";

  public jsonRpc = RELAY_JSONRPC[this.protocol];

  public provider: IJsonRpcProvider;

  constructor(rpcUrl: string) {
    this.provider = new JsonRpcProvider(new WsConnection(rpcUrl));
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
        message: await this.encodeJsonRpc(topic, payload),
        ttl: RELAYER_DEFAULT_PUBLISH_TTL,
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

  private async encodeJsonRpc(topic: string, payload: JsonRpcPayload) {
    return encoding.utf8ToHex(safeJsonStringify(payload));
  }

  private async decodeJsonRpc(topic: string, message: string) {
    return safeJsonParse(encoding.hexToUtf8(message));
  }

  private async onPayload(payload: JsonRpcPayload) {
    if (isJsonRpcRequest(payload)) {
      if (!payload.method.endsWith(RELAYER_SUBSCRIPTION_SUFFIX)) return;
      const event = (payload as JsonRpcRequest<RelayJsonRpc.SubscriptionParams>).params;
      const { topic, message } = event.data;
      const payloadEvent = {
        topic,
        payload: await this.decodeJsonRpc(topic, message),
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
