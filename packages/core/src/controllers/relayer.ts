import { EventEmitter } from "events";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import {
  formatJsonRpcResult,
  getBigIntRpcId,
  IJsonRpcProvider,
  isJsonRpcRequest,
  isJsonRpcResponse,
  JsonRpcPayload,
  JsonRpcRequest,
  RequestArguments,
} from "@walletconnect/jsonrpc-utils";
import WsConnection from "@walletconnect/jsonrpc-ws-connection";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import {
  FIVE_MINUTES,
  ONE_SECOND,
  FIVE_SECONDS,
  THIRTY_SECONDS,
  toMiliseconds,
} from "@walletconnect/time";
import {
  ICore,
  IMessageTracker,
  IPublisher,
  IRelayer,
  ISubscriber,
  RelayerOptions,
  RelayerTypes,
} from "@walletconnect/types";
import {
  createExpiringPromise,
  formatRelayRpcUrl,
  isOnline,
  subscribeToNetworkChange,
  getAppId,
  isAndroid,
  isIos,
  getInternalError,
  isNode,
  calcExpiry,
  isAppVisible,
  createLogger,
} from "@walletconnect/utils";

import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { getLoggerContext, Logger } from "@walletconnect/logger";

import {
  RELAYER_SDK_VERSION,
  RELAYER_CONTEXT,
  RELAYER_DEFAULT_LOGGER,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  RELAYER_SUBSCRIBER_SUFFIX,
  RELAYER_DEFAULT_RELAY_URL,
  RELAYER_RECONNECT_TIMEOUT,
  TRANSPORT_TYPES,
  MESSAGE_DIRECTION,
} from "../constants/index.js";
import { MessageTracker } from "./messages.js";
import { Publisher } from "./publisher.js";
import { Subscriber } from "./subscriber.js";

export class Relayer extends IRelayer {
  public protocol = "wc";
  public version = 2;

  public core: ICore;
  public logger: Logger;
  public events: EventEmitter = new EventEmitter();
  public provider: IJsonRpcProvider;
  public messages: IMessageTracker;
  public subscriber: ISubscriber;
  public publisher: IPublisher;
  public name = RELAYER_CONTEXT;
  public transportExplicitlyClosed = false;

  private initialized = false;
  private disposal: Promise<void> | undefined;
  private disposed = false;
  private unsubscribeNetwork: (() => void) | undefined;
  private listenersReady: Promise<void> | undefined;
  private retryTimeout: ReturnType<typeof setTimeout> | undefined;
  private retryReject: ((error: Error) => void) | undefined;
  private connectionAttemptInProgress = false;

  private relayUrl: string;
  private projectId: string | undefined;
  private packageName: string | undefined;
  private bundleId: string | undefined;
  private hasExperiencedNetworkDisruption = false;
  private pingTimeout: NodeJS.Timeout | undefined;
  private pingSocket: { off(event: string, listener: () => void): unknown } | undefined;
  private readonly onPing = () => this.resetPingTimeout();
  /**
   * the relay pings the client 30 seconds after the last message was received
   * meaning if we don't receive a message in 30 seconds, the connection can be considered dead
   */
  private heartBeatTimeout = toMiliseconds(THIRTY_SECONDS + FIVE_SECONDS);
  private reconnectTimeout: NodeJS.Timeout | undefined;
  private connectPromise: Promise<void> | undefined;
  private reconnectInProgress = false;
  private requestsInFlight: string[] = [];
  private connectTimeout = toMiliseconds(ONE_SECOND * 15);
  private stalledRestartInProgress = false;
  private stalledRestartTimeout: NodeJS.Timeout | undefined;
  private stalledRestartBackoff = 0;
  private readonly stalledRestartBaseInterval = toMiliseconds(ONE_SECOND * 2);
  private readonly stalledRestartMaxInterval = toMiliseconds(THIRTY_SECONDS);
  constructor(opts: RelayerOptions) {
    super(opts);
    this.core = opts.core;
    this.logger = createLogger({
      logger: opts.logger ?? RELAYER_DEFAULT_LOGGER,
      name: this.name,
    });
    this.messages = new MessageTracker(this.logger, opts.core);
    this.subscriber = new Subscriber(this, this.logger);
    this.publisher = new Publisher(this, this.logger);

    this.projectId = opts.projectId;
    this.relayUrl = opts.relayUrl || RELAYER_DEFAULT_RELAY_URL;

    if (isAndroid()) {
      this.packageName = getAppId();
    } else if (isIos()) {
      this.bundleId = getAppId();
    }

    // re-assigned during init()
    this.provider = {} as IJsonRpcProvider;
  }

  public async init() {
    this.logger.trace(`Initialized`);
    this.assertActive();
    this.listenersReady = this.registerEventListeners();
    await this.listenersReady;
    await Promise.all([this.messages.init(), this.subscriber.init()]);
    this.assertActive();
    this.initialized = true;
    // don't block init with transportOpen
    this.transportOpen().catch((e) => this.logger.warn(e, (e as Error)?.message));
  }

  public dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    this.transportExplicitlyClosed = true;
    this.unsubscribeNetwork?.();
    this.unsubscribeNetwork = undefined;
    clearTimeout(this.pingTimeout);
    clearTimeout(this.reconnectTimeout);
    clearTimeout(this.stalledRestartTimeout);
    clearTimeout(this.retryTimeout);
    this.retryReject?.(new Error("WalletConnect Core is disposed"));
    this.retryReject = undefined;
    if (this.provider.connection) this.unregisterProviderListeners();
    const provider = this.provider as IJsonRpcProvider & { dispose(): Promise<void> };
    const pending = provider.connection
      ? Promise.resolve().then(() => provider.dispose())
      : Promise.resolve();
    this.disposal = (async () => {
      const settled = await Promise.allSettled([this.listenersReady, this.connectPromise, pending]);
      this.unsubscribeNetwork?.();
      this.unsubscribeNetwork = undefined;
      this.events.removeAllListeners();
      await this.subscriber.dispose();
      await this.publisher.dispose();
      if (settled[2].status === "rejected") throw settled[2].reason;
    })();
    return this.disposal;
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  get connected() {
    // @ts-expect-error
    return this.provider?.connection?.socket?.readyState === 1;
  }

  get connecting() {
    return (
      // @ts-expect-error
      this.provider?.connection?.socket?.readyState === 0 || this.connectPromise !== undefined
    );
  }

  public assertOwner(signal = this.core.signal) {
    this.assertActive();
    if (signal.aborted) throw signal.reason || new Error("WalletConnect request owner is disposed");
  }

  public withOwner<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    signal = this.core.signal,
  ): Promise<T> {
    this.assertOwner(signal);
    const lifetime = new AbortController();
    return new Promise<T>((resolve, reject) => {
      const signals = signal === this.core.signal ? [signal] : [signal, this.core.signal];
      const cleanup = () => signals.forEach((owner) => owner.removeEventListener("abort", abort));
      const abort = () => {
        cleanup();
        try {
          this.assertOwner(signal);
        } catch (error) {
          lifetime.abort(error);
          reject(error);
        }
      };
      signals.forEach((owner) => owner.addEventListener("abort", abort, { once: true }));
      Promise.resolve()
        .then(() => {
          this.assertOwner(signal);
          return operation(lifetime.signal);
        })
        .then(
          (value) => {
            cleanup();
            lifetime.abort();
            try {
              this.assertOwner(signal);
              resolve(value);
            } catch (error) {
              reject(error);
            }
          },
          (error) => {
            cleanup();
            lifetime.abort();
            reject(error);
          },
        );
      if (signals.some((owner) => owner.aborted)) abort();
    });
  }

  public async publish(
    topic: string,
    message: string,
    opts?: RelayerTypes.PublishOptions,
    signal = this.core.signal,
  ) {
    this.isInitialized();
    this.assertOwner(signal);
    await this.publisher.publish(topic, message, opts, signal);
    this.assertOwner(signal);
    await this.recordMessageEvent(
      {
        topic,
        message,
        // We don't have `publishedAt` from the relay server on outgoing, so use current time to satisfy type.
        publishedAt: Date.now(),
        transportType: TRANSPORT_TYPES.relay,
      },
      MESSAGE_DIRECTION.outbound,
    );
    this.assertOwner(signal);
  }

  public async publishCustom(
    params: { payload: any; opts?: RelayerTypes.PublishOptions },
    signal = this.core.signal,
  ) {
    this.isInitialized();
    this.assertOwner(signal);
    await this.publisher.publishCustom(params, signal);
    this.assertOwner(signal);
  }

  public async subscribe(
    topic: string,
    opts?: RelayerTypes.SubscribeOptions,
    signal = this.core.signal,
  ) {
    this.isInitialized();
    this.assertOwner(signal);
    if (!opts?.transportType || opts?.transportType === "relay") {
      await this.withOwner(() => this.toEstablishConnection(), signal);
    }
    const shouldThrowOnFailure = opts?.internal?.throwOnFailedPublish ?? true;

    const previous = this.subscriber.topicMap.get(topic)?.[0] || "";
    const id = await this.subscriber.subscribe(
      topic,
      {
        ...opts,
        internal: { ...opts?.internal, throwOnFailedPublish: shouldThrowOnFailure },
      },
      signal,
    );
    this.assertOwner(signal);
    return id || previous;
  }

  public request = async (
    request: RequestArguments<RelayJsonRpc.SubscribeParams>,
    signal = this.core.signal,
  ) => {
    this.assertOwner(signal);
    this.logger.debug(`Publishing Request Payload`);
    const id = request.id || (getBigIntRpcId().toString() as any);
    await this.withOwner(() => this.toEstablishConnection(), signal);
    this.assertOwner(signal);
    const tag = `${id}:${(request.params as any)?.tag || ""}`;
    try {
      this.logger.trace(
        {
          id,
          method: request.method,
          topic: request.params?.topic,
        },
        "relayer.request - publishing...",
      );
      this.requestsInFlight.push(tag);
      const result = await this.withOwner(
        () => this.provider.request(request, undefined, signal),
        signal,
      );
      this.assertOwner(signal);
      return result;
    } catch (e) {
      this.logger.debug(`Failed to Publish Request: ${id}`);
      throw e;
    } finally {
      this.requestsInFlight = this.requestsInFlight.filter((i) => i !== tag);
    }
  };

  public async unsubscribe(
    topic: string,
    opts?: RelayerTypes.UnsubscribeOptions,
    signal = this.core.signal,
  ) {
    this.isInitialized();
    this.assertOwner(signal);
    await this.subscriber.unsubscribe(topic, opts, signal);
    this.assertOwner(signal);
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

  public async transportDisconnect() {
    if (this.provider.disconnect && (this.hasExperiencedNetworkDisruption || this.connected)) {
      await createExpiringPromise(
        this.provider.disconnect(),
        2000,
        "provider.disconnect()",
        this.core.signal,
      ).catch(() => this.onProviderDisconnect());
    } else {
      this.onProviderDisconnect();
    }
  }

  public async transportClose() {
    this.transportExplicitlyClosed = true;
    clearTimeout(this.stalledRestartTimeout);
    this.stalledRestartInProgress = false;
    this.stalledRestartBackoff = 0;
    await this.resetTransport();
  }

  async transportOpen(relayUrl?: string) {
    this.assertActive();
    if (!this.subscriber.hasAnyTopics) {
      this.logger.info(
        "Starting WS connection skipped because the client has no topics to work with.",
      );
      return;
    }

    if (this.connectPromise) {
      this.logger.debug({}, `Waiting for existing connection attempt to resolve...`);
      await this.connectPromise;
      this.logger.debug({}, `Existing connection attempt resolved`);
    } else {
      this.connectPromise = this.connect(relayUrl).finally(() => {
        this.connectPromise = undefined;
      });
      await this.connectPromise;
    }
    if (!this.connected) {
      throw new Error(`Couldn't establish socket connection to the relay server: ${this.relayUrl}`);
    }
  }

  public async restartTransport(relayUrl?: string) {
    this.assertActive();
    this.logger.debug({}, "Restarting transport...");
    if (this.connectionAttemptInProgress) return;
    this.relayUrl = relayUrl || this.relayUrl;
    await this.confirmOnlineStateOrThrow();
    await this.resetTransport();
    await this.transportOpen();
  }

  private async resetTransport() {
    // Guards must be set synchronously before any async work:
    // - reconnectInProgress prevents onProviderDisconnect from scheduling a competing reconnect
    // - clearTimeout prevents a pending reconnectTimeout from firing during transportDisconnect
    this.reconnectInProgress = true;
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = undefined;
    await this.transportDisconnect();
    await this.subscriber.stop();
    this.reconnectInProgress = false;
  }

  public async confirmOnlineStateOrThrow(signal = this.core.signal) {
    const online = await this.withOwner(() => isOnline(), signal);
    this.assertOwner(signal);
    if (online) return;
    throw new Error("No internet connection detected. Please restart your network and try again.");
  }

  public async handleBatchMessageEvents(messages: RelayerTypes.MessageEvent[]) {
    if (messages?.length === 0) {
      this.logger.trace("Batch message events is empty. Ignoring...");
      return;
    }
    const sortedMessages = messages.sort((a, b) => a.publishedAt - b.publishedAt);
    this.logger.debug(`Batch of ${sortedMessages.length} message events sorted`);
    for (const message of sortedMessages) {
      try {
        await this.onMessageEvent(message);
      } catch (e) {
        this.logger.warn(e, "Error while processing batch message event: " + (e as Error)?.message);
      }
    }
    this.logger.trace(`Batch of ${sortedMessages.length} message events processed`);
  }

  public async onLinkMessageEvent(
    messageEvent: RelayerTypes.MessageEvent,
    opts: { sessionExists: boolean },
  ) {
    const { topic } = messageEvent;

    if (!opts.sessionExists) {
      const expiry = calcExpiry(FIVE_MINUTES);
      const pairing = { topic, expiry, relay: { protocol: "irn" }, active: false };
      await this.core.pairing.pairings.set(topic, pairing);
    }

    this.events.emit(RELAYER_EVENTS.message, messageEvent);
    await this.recordMessageEvent(messageEvent, MESSAGE_DIRECTION.inbound);
  }

  // ---------- Private ----------------------------------------------- //

  private async connect(relayUrl?: string) {
    await this.confirmOnlineStateOrThrow();
    if (relayUrl && relayUrl !== this.relayUrl) {
      this.relayUrl = relayUrl;
      await this.transportDisconnect();
    }

    this.assertActive();
    this.transportExplicitlyClosed = false;
    let attempt = 1;
    try {
      while (attempt < 6) {
        this.connectionAttemptInProgress = true;
        try {
          if (this.transportExplicitlyClosed) {
            break;
          }
          this.logger.debug({}, `Connecting to ${this.relayUrl}, attempt: ${attempt}...`);
          await this.createProvider();
          this.assertActive();

          // Step A: establish WebSocket connection
          await new Promise<void>((resolve, reject) => {
            const onDisconnect = () => {
              reject(new Error(`Connection interrupted while trying to connect`));
            };
            this.provider.once(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
            createExpiringPromise(
              this.provider.connect(),
              this.connectTimeout,
              `Socket stalled when trying to connect to ${this.relayUrl}`,
              this.core.signal,
            )
              .then(() => resolve())
              .catch(reject)
              .finally(() => {
                this.provider.off(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
                clearTimeout(this.reconnectTimeout);
              });
          });

          this.assertActive();
          // Step B: re-subscribe (only reached if Step A resolved)
          await new Promise<void>((resolve, reject) => {
            const onDisconnect = () => {
              reject(new Error(`Connection interrupted while trying to subscribe`));
            };
            this.provider.once(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
            this.subscriber
              .start()
              .then(resolve)
              .catch(reject)
              .finally(() => {
                this.provider.off(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
              });
          });

          this.assertActive();
          this.hasExperiencedNetworkDisruption = false;
        } catch (e) {
          this.assertActive();
          await this.subscriber.stop();
          const error = e as Error;
          this.logger.warn({}, error.message);
          this.hasExperiencedNetworkDisruption = true;
        }

        if (this.connected) {
          this.logger.debug(
            {},
            `Connected to ${this.relayUrl} successfully on attempt: ${attempt}`,
          );
          break;
        }

        await new Promise<void>((resolve, reject) => {
          this.assertActive();
          this.retryReject = reject;
          this.retryTimeout = setTimeout(resolve, toMiliseconds(attempt));
        });
        this.retryReject = undefined;
        this.assertActive();
        attempt++;
      }
    } finally {
      this.connectionAttemptInProgress = false;
      clearTimeout(this.retryTimeout);
      this.retryReject = undefined;
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
      this.reconnectInProgress = false;
    }
  }

  /*
   * In Node, we must detect when the connection is stalled and terminate it.
   * The logic is, if we don't receive ping from the relay within a certain time, we terminate the connection.
   * The timer is refreshed on every message received from the relay.
   *
   * In the browser, ping/pong events are not exposed, so the above behaviour is handled by `subscribeToNetworkChange` and `isOnline` functions.
   */
  private startPingTimeout() {
    if (!isNode() || this.core.signal.aborted) return;
    this.pingSocket?.off("ping", this.onPing);
    // Node sockets expose ping events; browsers do not.
    const socket = (
      this.provider.connection as unknown as {
        socket?: {
          on(event: string, listener: () => void): unknown;
          off(event: string, listener: () => void): unknown;
        };
      }
    ).socket;
    socket?.on("ping", this.onPing);
    this.pingSocket = socket;
    this.resetPingTimeout();
  }

  private resetPingTimeout = () => {
    if (this.core.signal.aborted || !isNode()) return;
    clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => {
      try {
        this.logger.debug({}, "pingTimeout: Connection stalled, terminating...");
        //@ts-expect-error
        this.provider?.connection?.socket?.terminate?.();
      } catch (e) {
        this.logger.warn(e, (e as Error)?.message);
      }
    }, this.heartBeatTimeout);
  };

  private async createProvider() {
    if (this.provider.connection) {
      this.unregisterProviderListeners();
      const previous = this.provider as IJsonRpcProvider & { dispose(): Promise<void> };
      await previous.dispose();
      this.assertActive();
    }
    const auth = await this.core.crypto.signJWT(this.relayUrl);
    this.assertActive();

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
          bundleId: this.bundleId,
          packageName: this.packageName,
        }),
      ),
    );
    this.registerProviderListeners();
  }

  private async recordMessageEvent(
    messageEvent: RelayerTypes.MessageEvent,
    direction?: RelayerTypes.MessageDirection,
  ) {
    const { topic, message } = messageEvent;
    await this.messages.set(topic, message, direction);
  }

  private async shouldIgnoreMessageEvent(
    messageEvent: RelayerTypes.MessageEvent,
  ): Promise<boolean> {
    const { topic, message } = messageEvent;

    // Ignore if incoming `message` is clearly invalid.
    if (!message || message.length === 0) {
      this.logger.warn(`Ignoring invalid/empty message: ${message}`);
      return true;
    }

    // Ignore if `topic` is not known to the subscriber.
    if (!(await this.subscriber.isKnownTopic(topic))) {
      this.logger.warn(`Ignoring message for unknown topic ${topic}`);
      return true;
    }

    // Ignore if `message` is a duplicate.
    const exists = this.messages.has(topic, message);
    if (exists) {
      this.logger.warn(`Ignoring duplicate message: ${message}`);
    }
    return exists;
  }

  private async onProviderPayload(payload: JsonRpcPayload) {
    this.logger.debug(`Incoming Relay Payload`);
    this.logger.trace({ type: "payload", direction: "incoming", payload });
    if (isJsonRpcRequest(payload)) {
      if (!payload.method.endsWith(RELAYER_SUBSCRIBER_SUFFIX)) return;
      const event = (payload as JsonRpcRequest<RelayJsonRpc.SubscriptionParams>).params;
      const { topic, message, publishedAt, attestation } = event.data;
      const messageEvent: RelayerTypes.MessageEvent = {
        topic,
        message,
        publishedAt,
        transportType: TRANSPORT_TYPES.relay,
        attestation,
      };
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
    if (await this.shouldIgnoreMessageEvent(messageEvent)) {
      return;
    }
    await this.recordMessageEvent(messageEvent, MESSAGE_DIRECTION.inbound);
    this.events.emit(RELAYER_EVENTS.message, messageEvent);
  }

  private async acknowledgePayload(payload: JsonRpcPayload) {
    this.assertActive();
    const response = formatJsonRpcResult(payload.id, true);
    await this.provider.connection.send(response);
  }

  // ---------- Events Handlers ----------------------------------------------- //
  private onPayloadHandler = (payload: JsonRpcPayload) => {
    if (this.core.signal.aborted) return;
    this.onProviderPayload(payload).catch((error) => this.logger.warn(error));
    this.resetPingTimeout();
  };

  private onConnectHandler = () => {
    if (this.core.signal.aborted) return;
    this.logger.warn({}, "Relayer connected 🛜");
    this.startPingTimeout();
    this.stalledRestartBackoff = 0;
    this.events.emit(RELAYER_EVENTS.connect);
  };

  private onDisconnectHandler = () => {
    if (this.core.signal.aborted) return;
    this.logger.warn({}, `Relayer disconnected 🛑`);
    this.requestsInFlight = [];
    this.onProviderDisconnect();
  };

  private onProviderErrorHandler = (error: Error) => {
    if (this.core.signal.aborted) return;
    this.logger.fatal(`Fatal socket error: ${error.message}`);
    this.events.emit(RELAYER_EVENTS.error, error);
    this.logger.fatal("Fatal socket error received, closing transport");
    this.transportExplicitlyClosed = true;
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = undefined;
    this.reconnectInProgress = false;
    this.transportClose().catch((e) => this.logger.warn(e));
  };

  private registerProviderListeners = () => {
    this.provider.on(RELAYER_PROVIDER_EVENTS.payload, this.onPayloadHandler);
    this.provider.on(RELAYER_PROVIDER_EVENTS.connect, this.onConnectHandler);
    this.provider.on(RELAYER_PROVIDER_EVENTS.disconnect, this.onDisconnectHandler);
    this.provider.on(RELAYER_PROVIDER_EVENTS.error, this.onProviderErrorHandler);
  };

  private unregisterProviderListeners() {
    this.pingSocket?.off("ping", this.onPing);
    this.pingSocket = undefined;
    this.provider.off(RELAYER_PROVIDER_EVENTS.payload, this.onPayloadHandler);
    this.provider.off(RELAYER_PROVIDER_EVENTS.connect, this.onConnectHandler);
    this.provider.off(RELAYER_PROVIDER_EVENTS.disconnect, this.onDisconnectHandler);
    this.provider.off(RELAYER_PROVIDER_EVENTS.error, this.onProviderErrorHandler);
    clearTimeout(this.pingTimeout);
  }

  private async registerEventListeners() {
    let lastConnectedState = await this.core.run(() => isOnline());
    this.assertActive();
    const onNetworkChange = async (connected: boolean) => {
      this.assertActive();
      // sometimes the network change event is triggered multiple times so avoid reacting to the samFe value
      if (lastConnectedState === connected) return;

      lastConnectedState = connected;
      if (!connected) {
        // when the device network is restarted, the socket might stay in false `connected` state
        this.hasExperiencedNetworkDisruption = true;
        await this.transportDisconnect();
        this.assertActive();
        this.transportExplicitlyClosed = false;
      } else {
        await this.transportOpen().catch((error) =>
          this.logger.error(error, (error as Error)?.message),
        );
      }
    };

    this.unsubscribeNetwork = subscribeToNetworkChange((connected: boolean) => {
      onNetworkChange(connected).catch((error) => {
        if (!this.core.signal.aborted) this.logger.warn(error);
      });
    });

    this.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, async () => {
      if (this.core.signal.aborted || this.transportExplicitlyClosed) return;
      if (!this.connected && isAppVisible()) {
        try {
          await this.confirmOnlineStateOrThrow();
          await this.transportOpen();
        } catch (error) {
          this.logger.warn(error, (error as Error)?.message);
        }
      }
    });

    this.events.on(RELAYER_EVENTS.connection_stalled, () => {
      if (this.core.signal.aborted || this.transportExplicitlyClosed) return;
      if (this.stalledRestartInProgress) return;
      this.stalledRestartInProgress = true;

      const delay =
        this.stalledRestartBackoff === 0
          ? 0
          : Math.min(
              Math.pow(2, this.stalledRestartBackoff - 1) * this.stalledRestartBaseInterval,
              this.stalledRestartMaxInterval,
            );
      this.stalledRestartBackoff++;

      this.logger.warn(
        `Connection stalled, restarting transport${delay ? ` in ${delay}ms` : ""}...`,
      );
      this.stalledRestartTimeout = setTimeout(async () => {
        try {
          if (this.core.signal.aborted || this.transportExplicitlyClosed) return;
          await this.restartTransport();
        } catch (error) {
          this.logger.error(error, (error as Error)?.message);
        } finally {
          this.stalledRestartInProgress = false;
        }
      }, delay);
    });
  }

  private async onProviderDisconnect() {
    if (this.core.signal.aborted) return;
    clearTimeout(this.pingTimeout);
    this.events.emit(RELAYER_EVENTS.disconnect);
    if (this.reconnectInProgress) return;

    this.reconnectInProgress = true;
    try {
      await this.subscriber.stop();
    } catch (e) {
      this.logger.warn(e, "subscriber.stop() failed during disconnect");
    }

    if (
      this.core.signal.aborted ||
      !this.subscriber.hasAnyTopics ||
      this.transportExplicitlyClosed
    ) {
      this.reconnectInProgress = false;
      return;
    }

    this.reconnectTimeout = setTimeout(async () => {
      await this.transportOpen().catch((error) =>
        this.logger.error(error, (error as Error)?.message),
      );
      this.reconnectTimeout = undefined;
      this.reconnectInProgress = false;
    }, toMiliseconds(RELAYER_RECONNECT_TIMEOUT));
  }

  private assertActive() {
    this.core.assertActive();
    if (this.disposed) throw new Error("WalletConnect relayer is disposed");
  }

  private isInitialized() {
    this.assertActive();
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }

  private async toEstablishConnection() {
    await this.confirmOnlineStateOrThrow();
    if (this.connected) return;
    if (this.connectPromise) {
      await this.connectPromise;
      return;
    }
    this.connectPromise = this.connect().finally(() => {
      this.connectPromise = undefined;
    });
    await this.connectPromise;
  }
}
