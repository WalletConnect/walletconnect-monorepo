import { EventEmitter } from "events";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import {
  formatJsonRpcResult,
  IJsonRpcProvider,
  isJsonRpcRequest,
  isJsonRpcResponse,
  JsonRpcPayload,
  JsonRpcRequest,
  RequestArguments,
} from "@walletconnect/jsonrpc-utils";
import WsConnection from "@walletconnect/jsonrpc-ws-connection";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
  pino,
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
import {
  createExpiringPromise,
  formatRelayRpcUrl,
  getInternalError,
  isOnline,
} from "@walletconnect/utils";

import {
  RELAYER_SDK_VERSION,
  RELAYER_CONTEXT,
  RELAYER_DEFAULT_LOGGER,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  RELAYER_RECONNECT_TIMEOUT,
  RELAYER_SUBSCRIBER_SUFFIX,
  RELAYER_DEFAULT_RELAY_URL,
  RELAYER_FAILOVER_RELAY_URL,
  SUBSCRIBER_EVENTS,
  RELAYER_TRANSPORT_CUTOFF,
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
  private reconnecting = false;
  private relayUrl: string;
  private projectId: string | undefined;
  private connectionStatusPollingInterval = 20;
  private staleConnectionErrors = ["socket hang up", "socket stalled"];

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
    await this.createProvider();
    await Promise.all([this.messages.init(), this.subscriber.init()]);
    try {
      await this.transportOpen();
    } catch {
      this.logger.warn(
        `Connection via ${this.relayUrl} failed, attempting to connect via failover domain ${RELAYER_FAILOVER_RELAY_URL}...`,
      );
      await this.restartTransport(RELAYER_FAILOVER_RELAY_URL);
    }
    this.registerEventListeners();
    this.initialized = true;
    setTimeout(async () => {
      if (this.subscriber.topics.length === 0) {
        this.logger.info(`No topics subscribed to after init, closing transport`);
        await this.transportClose();
        this.transportExplicitlyClosed = false;
      }
    }, RELAYER_TRANSPORT_CUTOFF);
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
    await this.recordMessageEvent({
      topic,
      message,
      // We don't have `publishedAt` from the relay server on outgoing, so use current time to satisfy type.
      publishedAt: Date.now(),
    });
  }

  public async subscribe(topic: string, opts?: RelayerTypes.SubscribeOptions) {
    this.isInitialized();
    let id = this.subscriber.topicMap.get(topic)?.[0] || "";

    if (id) return id;

    await Promise.all([
      new Promise<void>((resolve) => {
        this.subscriber.once(SUBSCRIBER_EVENTS.created, (subscription: SubscriberTypes.Active) => {
          if (subscription.topic === topic) {
            resolve();
          }
        });
      }),
      new Promise<void>(async (resolve) => {
        id = await this.subscriber.subscribe(topic, opts);
        resolve();
      }),
    ]);

    return id;
  }

  public request = async (request: RequestArguments<RelayJsonRpc.SubscribeParams>) => {
    this.logger.debug(`Publishing Request Payload`);
    try {
      await this.toEstablishConnection();
      return await this.provider.request(request);
    } catch (e) {
      this.logger.debug(`Failed to Publish Request`);
      this.logger.error(e as any);
      throw e;
    }
  };

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
    if (this.connected) {
      await this.provider.disconnect();
      this.events.emit(RELAYER_EVENTS.transport_closed);
    }
  }

  public async transportOpen(relayUrl?: string) {
    this.transportExplicitlyClosed = false;
    if (!(await isOnline())) {
      throw new Error(
        "No internet connection detected. Please restart your network and try again.",
      );
    }
    if (this.reconnecting) return;
    this.relayUrl = relayUrl || this.relayUrl;
    this.reconnecting = true;
    try {
      await Promise.all([
        new Promise<void>((resolve) => {
          if (!this.initialized) resolve();
          // wait for the subscriber to finish resubscribing to its topics
          this.subscriber.once(SUBSCRIBER_EVENTS.resubscribed, () => {
            resolve();
          });
        }),
        await Promise.race([
          new Promise<void>(async (resolve, reject) => {
            await createExpiringPromise(
              this.provider.connect(),
              5_000,
              `Socket stalled when trying to connect to ${this.relayUrl}`,
            )
              .catch((e) => reject(e))
              .then(() => resolve())
              .finally(() =>
                this.removeListener(RELAYER_EVENTS.transport_closed, this.rejectTransportOpen),
              );
          }),
          new Promise<void>((_res) =>
            // rejects pending promise if transport is closed before connection is established
            // useful when .connect() gets stuck resolving
            this.once(RELAYER_EVENTS.transport_closed, this.rejectTransportOpen),
          ),
        ]),
      ]);
    } catch (e: unknown | Error) {
      this.logger.error(e);
      const error = e as Error;
      if (!this.isConnectionStalled(error.message)) {
        throw e;
      }
      this.events.emit(RELAYER_EVENTS.transport_closed);
    } finally {
      this.reconnecting = false;
    }
  }

  public async restartTransport(relayUrl?: string) {
    if (this.transportExplicitlyClosed || this.reconnecting) return;
    this.relayUrl = relayUrl || this.relayUrl;
    if (this.connected) {
      await Promise.all([
        new Promise<void>((resolve) => {
          this.provider.once(RELAYER_PROVIDER_EVENTS.disconnect, () => {
            resolve();
          });
        }),
        this.transportClose(),
      ]);
    }
    await this.createProvider();
    await this.transportOpen();
  }

  // ---------- Private ----------------------------------------------- //

  private isConnectionStalled(message: string) {
    return this.staleConnectionErrors.some((error) => message.includes(error));
  }

  private rejectTransportOpen() {
    throw new Error("Attempt to connect to relay via `transportOpen` has stalled. Retrying...");
  }

  private async createProvider() {
    const auth = await this.core.crypto.signJWT(this.relayUrl);
    this.provider = new JsonRpcProvider(
      new WsConnection(
        formatRelayRpcUrl({
          sdkVersion: RELAYER_SDK_VERSION,
          protocol: this.protocol,
          version: this.version,
          relayUrl: this.relayUrl,
          projectId: this.projectId,
          auth,
          useOnCloseEvent: true,
        }),
      ),
    );
    this.registerProviderListeners();
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
      const { topic, message, publishedAt } = event.data;
      const messageEvent: RelayerTypes.MessageEvent = { topic, message, publishedAt };
      this.logger.debug(`Emitting Relayer Payload`);
      this.logger.trace({ type: "event", event: event.id, ...messageEvent });
      this.events.emit(event.id, messageEvent);
      await this.acknowledgePayload(payload);
      await this.onMessageEvent(messageEvent);
    } else if (isJsonRpcResponse(payload)) {
      this.events.emit(RELAYER_EVENTS.message_ack, payload);
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

  private registerProviderListeners() {
    this.provider.on(RELAYER_PROVIDER_EVENTS.payload, (payload: JsonRpcPayload) =>
      this.onProviderPayload(payload),
    );
    this.provider.on(RELAYER_PROVIDER_EVENTS.connect, () => {
      this.events.emit(RELAYER_EVENTS.connect);
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.disconnect, () => {
      this.onProviderDisconnect();
    });
    this.provider.on(RELAYER_PROVIDER_EVENTS.error, (err: unknown) => {
      this.logger.error(err);
      this.events.emit(RELAYER_EVENTS.error, err);
    });
  }

  private registerEventListeners() {
    this.events.on(RELAYER_EVENTS.connection_stalled, async () => {
      this.logger.info("RELAYER_EVENTS.connection_stalled emmited. Attempting to reconnect...");
      await this.restartTransport().catch((error) => this.logger.error(error));
    });
  }

  private onProviderDisconnect() {
    this.logger.info("Relayer provider disconnected");
    this.events.emit(RELAYER_EVENTS.disconnect);
    this.attemptToReconnect();
  }

  private attemptToReconnect() {
    if (this.transportExplicitlyClosed) {
      return;
    }

    this.logger.info("attemptToReconnect called. Connecting...");
    // Attempt reconnection after one second.
    setTimeout(async () => {
      await this.restartTransport().catch((error) => this.logger.error(error));
    }, toMiliseconds(RELAYER_RECONNECT_TIMEOUT));
  }

  private isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }

  private async toEstablishConnection() {
    if (this.connected && (await isOnline())) return;
    if (this.connecting) {
      return await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (this.connected) {
            clearInterval(interval);
            resolve();
          }
        }, this.connectionStatusPollingInterval);
      });
    }
    await this.restartTransport();
  }
}
