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
  ISubscriber,
  IJsonRpcHistory,
  JsonRpcRecord,
  IHeartBeat,
  IRelayerEncoder,
  RelayerOptions,
  IRelayerStorage,
} from "@walletconnect/types";
import { RelayJsonRpc, RELAY_JSONRPC } from "@walletconnect/relay-api";
import { formatRelayRpcUrl } from "@walletconnect/utils";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import WsConnection from "@walletconnect/jsonrpc-ws-connection";
import {
  IJsonRpcProvider,
  JsonRpcPayload,
  isJsonRpcRequest,
  JsonRpcRequest,
  formatJsonRpcResult,
  RequestArguments,
} from "@walletconnect/jsonrpc-utils";

import { Subscriber } from "./subscriber";
import {
  RELAYER_CONTEXT,
  RELAYER_DEFAULT_PROTOCOL,
  RELAYER_DEFAULT_LOGGER,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  RELAYER_SUBSCRIBER_SUFFIX,
  RELAYER_RECONNECT_TIMEOUT,
  RELAYER_STORAGE_OPTIONS,
  RELAYER_DEFAULT_RELAY_URL,
} from "../constants";
import { JsonRpcHistory } from "./history";
import { RelayerStorage } from "./storage";
import { RelayerEncoder } from "./encoder";
import { HeartBeat } from "./heartbeat";
import { IPublisher, Publisher } from "./publisher";

export class Relayer extends IRelayer {
  public readonly protocol = "irn";
  public readonly version = 1;

  public logger: Logger;

  public storage: IRelayerStorage;

  public heartbeat: IHeartBeat;

  public encoder: IRelayerEncoder;

  public events = new EventEmitter();

  public provider: IJsonRpcProvider;

  public history: IJsonRpcHistory;

  public subscriber: ISubscriber;

  public publisher: IPublisher;

  public name: string = RELAYER_CONTEXT;

  constructor(opts?: RelayerOptions) {
    super(opts);
    this.logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? generateChildLogger(opts.logger, this.name)
        : pino(getDefaultLoggerOptions({ level: opts?.logger || RELAYER_DEFAULT_LOGGER }));
    const keyValueStorage = opts?.keyValueStorage || new KeyValueStorage(RELAYER_STORAGE_OPTIONS);
    this.storage =
      typeof opts?.storage !== "undefined"
        ? opts.storage
        : new RelayerStorage(this.logger, keyValueStorage, {
            protocol: this.protocol,
            version: this.version,
            context: this.context,
          });
    this.heartbeat = opts?.heartbeat || new HeartBeat({ logger: this.logger });
    this.encoder = opts?.encoder || new RelayerEncoder();
    const rpcUrl =
      opts?.rpcUrl ||
      formatRelayRpcUrl(this.protocol, this.version, RELAYER_DEFAULT_RELAY_URL, opts?.projectId);
    this.provider =
      typeof opts?.relayProvider !== "string" && typeof opts?.relayProvider !== "undefined"
        ? opts?.relayProvider
        : new JsonRpcProvider(new WsConnection(rpcUrl));
    this.history = new JsonRpcHistory(this.logger, this.storage);
    this.subscriber = new Subscriber(this, this.logger);
    this.publisher = new Publisher(this, this.logger);
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
    await this.subscriber.init();
    await this.publisher.init();
  }

  public async publish(
    topic: string,
    payload: JsonRpcPayload,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void> {
    await this.publisher.publish(topic, payload, opts);
    await this.recordPayloadEvent({ topic, payload });
  }

  public async subscribe(topic: string, opts?: RelayerTypes.SubscribeOptions): Promise<string> {
    const id = await this.subscriber.subscribe(topic, opts);
    return id;
  }

  public async unsubscribe(topic: string, opts?: RelayerTypes.UnsubscribeOptions): Promise<void> {
    await this.subscriber.unsubscribe(topic, opts);
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
    if (!this.subscriber.topics.includes(topic)) return true;
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
      if (!payload.method.endsWith(RELAYER_SUBSCRIBER_SUFFIX)) return;
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

  private registerEventListeners(): void {
    this.provider.on(RELAYER_PROVIDER_EVENTS.payload, (payload: JsonRpcPayload) =>
      this.onPayload(payload),
    );
    this.provider.on(RELAYER_PROVIDER_EVENTS.connect, async () => {
      this.events.emit(RELAYER_EVENTS.connect);
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.disconnect, async () => {
      this.events.emit(RELAYER_EVENTS.disconnect);
      // reconnect after one minute
      setTimeout(() => {
        this.provider.connect();
      }, RELAYER_RECONNECT_TIMEOUT);
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.error, e => this.events.emit(RELAYER_EVENTS.error, e));
  }
}

export function getRelayProtocolName(
  opts?: RelayerTypes.RequestOptions,
): RelayerTypes.ProtocolOptions {
  return opts?.relay || { protocol: RELAYER_DEFAULT_PROTOCOL };
}

export function getRelayProtocolApi(protocol: string) {
  const jsonrpc = RELAY_JSONRPC[protocol];
  if (typeof jsonrpc === "undefined") {
    throw new Error(`Relay Protocol not supported: ${protocol}`);
  }
  return jsonrpc;
}
