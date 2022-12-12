/* eslint-disable no-console */
import { EventEmitter } from "events";
import pino from "pino";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import {
  formatJsonRpcResult,
  IJsonRpcProvider,
  isJsonRpcRequest,
  JsonRpcPayload,
  JsonRpcRequest,
} from "@walletconnect/jsonrpc-utils";
import WsConnection from "@walletconnect/jsonrpc-ws-connection";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
  Logger,
} from "@walletconnect/logger";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { toMiliseconds } from "@walletconnect/time";
import {
  ICore,
  IMessageTracker,
  IPublisher,
  IRelayer,
  ISubscriber,
  RelayerOptions,
  RelayerTypes,
  SubscriberTypes,
} from "@walletconnect/types";
import { formatRelayRpcUrl, getInternalError } from "@walletconnect/utils";

import {
  RELAYER_SDK_VERSION,
  RELAYER_CONTEXT,
  RELAYER_DEFAULT_LOGGER,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  RELAYER_RECONNECT_TIMEOUT,
  RELAYER_SUBSCRIBER_SUFFIX,
  RELAYER_DEFAULT_RELAY_URL,
  SUBSCRIBER_EVENTS,
} from "../constants";
import { MessageTracker } from "./messages";
import { Publisher } from "./publisher";
import { Subscriber } from "./subscriber";

export class Relayer extends IRelayer {
  public protocol = "wc";
  public version = 2;

  public core: ICore;
  public logger: Logger;
  public events = new EventEmitter();
  public provider: IJsonRpcProvider;
  public messages: IMessageTracker;
  public subscriber: ISubscriber;
  public publisher: IPublisher;
  public name = RELAYER_CONTEXT;
  public transportExplicitlyClosed = false;

  private initialized = false;

  private relayUrl: string;
  private projectId: string | undefined;
  constructor(opts: RelayerOptions) {
    super(opts);
    this.core = opts.core;
    this.logger =
      typeof opts.logger !== "undefined" && typeof opts.logger !== "string"
        ? generateChildLogger(opts.logger, this.name)
        : pino(getDefaultLoggerOptions({ level: opts.logger || RELAYER_DEFAULT_LOGGER }));
    this.messages = new MessageTracker(this.logger, opts.core);
    this.subscriber = new Subscriber(this, this.logger);
    this.publisher = new Publisher(this, this.logger);

    this.relayUrl = opts?.relayUrl || RELAYER_DEFAULT_RELAY_URL;
    this.projectId = opts.projectId;

    // re-assigned during init()
    this.provider = {} as IJsonRpcProvider;
  }

  public async init() {
    this.logger.trace(`Initialized`);
    this.provider = await this.createProvider();
    await Promise.all([this.messages.init(), this.transportOpen(), this.subscriber.init()]);
    this.registerEventListeners();
    this.initialized = true;
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  get connected() {
    return this.provider.connection.connected;
  }

  get connecting() {
    return this.provider.connection.connecting;
  }

  public async publish(topic: string, message: string, opts?: RelayerTypes.PublishOptions) {
    this.isInitialized();
    await this.publisher.publish(topic, message, opts);
    await this.recordMessageEvent({ topic, message });
  }

  public async subscribe(topic: string, opts?: RelayerTypes.SubscribeOptions) {
    this.isInitialized();
    let id = "";
    console.log("relayer subscribe.. creating promise ⌛", topic, this.core.name);
    await Promise.all([
      new Promise<void>((resolve) => {
        this.subscriber.once(SUBSCRIBER_EVENTS.created, (subscription: SubscriberTypes.Active) => {
          if (subscription.topic === topic) {
            console.log("subscription created", subscription, this.core.name);
            id = subscription.id;
            resolve();
          }
        });
      }),
      this.subscriber.subscribe(topic, opts),
    ]);
    console.log("relayer subscribe.. released ✅", topic, this.core.name);
    return id;
  }

  public async unsubscribe(topic: string, opts?: RelayerTypes.UnsubscribeOptions) {
    this.isInitialized();
    await this.subscriber.unsubscribe(topic, opts);
  }

  public on(event: string, listener: any) {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any) {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any) {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any) {
    this.events.removeListener(event, listener);
  }

  public async transportClose() {
    this.transportExplicitlyClosed = true;
    if (this.connected) await this.provider.disconnect();
    this.events.emit(RELAYER_EVENTS.transport_closed);
    console.log("transport closed --- @!", this.core.name);
  }

  public async transportOpen(relayUrl?: string) {
    this.relayUrl = relayUrl || this.relayUrl;
    this.transportExplicitlyClosed = false;
    console.log("attempting to connect", this.core.name);
    try {
      await Promise.race([
        this.provider.connect(),
        new Promise<void>((_res, reject) =>
          this.once(RELAYER_EVENTS.transport_closed, () => {
            console.log("relayer events -> transport close... rejecting", this.core.name);
            reject();
          }),
        ),
      ]);
      console.log("provider.connect() done --- @!", this.core.name);
      if (this.initialized) {
        // wait for the subscriber to finish resubscribing to its topics
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.log("resubscribe timeout", this.core.name);
            resolve();
          }, 10_000);
          this.subscriber.once(SUBSCRIBER_EVENTS.resubscribed, () => {
            console.log("resubscribed --- @!", this.core.name);
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      console.log("connection restarted --- @!", this.core.name);
    } catch (e: unknown | Error) {
      console.log("transport Open catched error", e, this.core.name);
    }
  }

  public async restartTransport(relayUrl?: string) {
    await this.transportClose();
    await this.transportOpen(relayUrl).catch((e) => {
      console.log("restartTransport error", e);
    });
  }

  // ---------- Private ----------------------------------------------- //

  private async createProvider() {
    const auth = await this.core.crypto.signJWT(this.relayUrl);
    return new JsonRpcProvider(
      new WsConnection(
        formatRelayRpcUrl({
          sdkVersion: RELAYER_SDK_VERSION,
          protocol: this.protocol,
          version: this.version,
          relayUrl: this.relayUrl,
          projectId: this.projectId,
          auth,
        }),
      ),
    );
  }

  private async recordMessageEvent(messageEvent: RelayerTypes.MessageEvent) {
    const { topic, message } = messageEvent;
    await this.messages.set(topic, message);
  }

  private async shouldIgnoreMessageEvent(messageEvent: RelayerTypes.MessageEvent) {
    const { topic, message } = messageEvent;
    if (!(await this.subscriber.isSubscribed(topic))) return true;
    const exists = this.messages.has(topic, message);
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

  private registerEventListeners() {
    this.provider.on(RELAYER_PROVIDER_EVENTS.payload, (payload: JsonRpcPayload) =>
      this.onProviderPayload(payload),
    );
    this.provider.on(RELAYER_PROVIDER_EVENTS.connect, () => {
      this.events.emit(RELAYER_EVENTS.connect);
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.disconnect, () => {
      this.events.emit(RELAYER_EVENTS.disconnect);

      this.attemptToReconnect();
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.error, (err: unknown) =>
      this.events.emit(RELAYER_EVENTS.error, err),
    );

    this.events.on(RELAYER_EVENTS.connection_stalled, async () => {
      console.log("on relayer connection stalled --- @!", this.core.name);
      await this.restartTransport();
    });
  }

  private attemptToReconnect() {
    if (this.transportExplicitlyClosed) {
      return;
    }
    console.log("attempting to reconnect", this.core.name);
    // Attempt reconnection after one second.
    setTimeout(async () => {
      await this.transportOpen();
    }, toMiliseconds(RELAYER_RECONNECT_TIMEOUT));
  }

  private isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }
}
