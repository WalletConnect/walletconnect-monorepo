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
  IPublisher,
  RelayerOptions,
  IRelayerStorage,
  IMessageTracker,
} from "@walletconnect/types";
import { IHeartBeat, HeartBeat } from "@walletconnect/heartbeat";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { formatRelayRpcUrl } from "@walletconnect/utils";
import { toMiliseconds } from "@walletconnect/time";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import WsConnection from "@walletconnect/jsonrpc-ws-connection";
import {
  IJsonRpcProvider,
  JsonRpcPayload,
  isJsonRpcRequest,
  JsonRpcRequest,
  formatJsonRpcResult,
} from "@walletconnect/jsonrpc-utils";

import { Subscriber } from "./subscriber";
import {
  RELAYER_CONTEXT,
  RELAYER_DEFAULT_LOGGER,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  RELAYER_SUBSCRIBER_SUFFIX,
  RELAYER_RECONNECT_TIMEOUT,
  RELAYER_STORAGE_OPTIONS,
  RELAYER_DEFAULT_RELAY_URL,
} from "../constants";
import { RelayerStorage } from "./storage";
import { Publisher } from "./publisher";
import { MessageTracker } from "./messages";

export class Relayer extends IRelayer {
  public readonly protocol = "irn";
  public readonly version = 1;

  public logger: Logger;

  public storage: IRelayerStorage;

  public heartbeat: IHeartBeat;

  public events = new EventEmitter();

  public provider: IJsonRpcProvider;

  public messages: IMessageTracker;

  public subscriber: ISubscriber;

  public publisher: IPublisher;

  public name: string = RELAYER_CONTEXT;

  constructor(opts?: RelayerOptions) {
    super(opts);
    this.logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? generateChildLogger(opts.logger, this.name)
        : pino(getDefaultLoggerOptions({ level: opts?.logger || RELAYER_DEFAULT_LOGGER }));
    const kvsOptions = { ...RELAYER_STORAGE_OPTIONS, ...opts?.keyValueStorageOptions };
    this.storage =
      typeof opts?.storage !== "undefined"
        ? opts.storage
        : new RelayerStorage(
            this.logger,
            opts?.keyValueStorage || new KeyValueStorage(kvsOptions),
            {
              protocol: this.protocol,
              version: this.version,
              context: this.context,
            },
          );
    this.heartbeat = opts?.heartbeat || new HeartBeat();
    const rpcUrl =
      opts?.rpcUrl ||
      formatRelayRpcUrl(this.protocol, this.version, RELAYER_DEFAULT_RELAY_URL, opts?.projectId);
    this.provider =
      typeof opts?.relayProvider !== "string" && typeof opts?.relayProvider !== "undefined"
        ? opts?.relayProvider
        : new JsonRpcProvider(new WsConnection(rpcUrl));
    this.messages = new MessageTracker(this.logger, this.storage);
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
    await this.messages.init();
    await this.provider.connect();
    await this.subscriber.init();
    await this.publisher.init();
  }

  public async publish(
    topic: string,
    message: string,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void> {
    await this.publisher.publish(topic, message, opts);
    await this.recordMessageEvent({ topic, message });
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

  private async recordMessageEvent(messageEvent: RelayerTypes.MessageEvent) {
    const { topic, message } = messageEvent;
    await this.messages.set(topic, message);
  }

  private async shouldIgnoreMessageEvent(messageEvent: RelayerTypes.MessageEvent) {
    const { topic, message } = messageEvent;
    if (!this.subscriber.topics.includes(topic)) return true;
    const exists = await this.messages.has(topic, message);
    return exists;
  }

  private async onProviderPayload(payload: JsonRpcPayload) {
    this.logger.debug(`Incoming Relay Payload`);
    this.logger.trace({ type: "payload", direction: "incoming", payload });
    if (isJsonRpcRequest(payload)) {
      if (!payload.method.endsWith(RELAYER_SUBSCRIBER_SUFFIX)) return;
      const event = (payload as JsonRpcRequest<RelayJsonRpc.SubscriptionParams>).params;
      const { topic, message } = event.data;
      const messageEvent = { topic, message } as RelayerTypes.MessageEvent;
      this.logger.debug(`Emitting Relayer Payload`);
      this.logger.trace({ type: "event", event: event.id, ...messageEvent });
      this.events.emit(event.id, messageEvent);
      await this.acknowledgePayload(payload);
      await this.onMessageEvent(messageEvent);
    }
  }

  private async onMessageEvent(messageEvent: RelayerTypes.MessageEvent) {
    if (await this.shouldIgnoreMessageEvent(messageEvent)) return;
    this.events.emit(RELAYER_EVENTS.message, messageEvent);
    await this.recordMessageEvent(messageEvent);
  }

  private async acknowledgePayload(payload: JsonRpcPayload) {
    const response = formatJsonRpcResult(payload.id, true);
    await this.provider.connection.send(response);
  }

  private registerEventListeners(): void {
    this.provider.on(RELAYER_PROVIDER_EVENTS.payload, (payload: JsonRpcPayload) =>
      this.onProviderPayload(payload),
    );
    this.provider.on(RELAYER_PROVIDER_EVENTS.connect, async () => {
      this.events.emit(RELAYER_EVENTS.connect);
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.disconnect, async () => {
      this.events.emit(RELAYER_EVENTS.disconnect);
      // Attempt reconnection after one second.
      setTimeout(() => {
        this.provider.connect();
      }, toMiliseconds(RELAYER_RECONNECT_TIMEOUT));
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.error, e => this.events.emit(RELAYER_EVENTS.error, e));
  }
}
