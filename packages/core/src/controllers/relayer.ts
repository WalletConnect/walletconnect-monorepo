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
  SubscriberTypes,
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
  SUBSCRIBER_EVENTS,
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
  public events = new EventEmitter();
  public provider: IJsonRpcProvider;
  public messages: IMessageTracker;
  public subscriber: ISubscriber;
  public publisher: IPublisher;
  public name = RELAYER_CONTEXT;
  public transportExplicitlyClosed = false;

  private initialized = false;
  private connectionAttemptInProgress = false;

  private relayUrl: string;
  private projectId: string | undefined;
  private packageName: string | undefined;
  private bundleId: string | undefined;
  private hasExperiencedNetworkDisruption = false;
  private pingTimeout: NodeJS.Timeout | undefined;
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

    this.projectId = opts?.projectId;
    this.relayUrl = opts?.relayUrl || RELAYER_DEFAULT_RELAY_URL;

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
    this.registerEventListeners();
    await Promise.all([this.messages.init(), this.subscriber.init()]);
    this.initialized = true;
    // don't block init with transportOpen
    this.transportOpen().catch((e) => this.logger.warn(e, (e as Error)?.message));
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  get connected() {
    // @ts-expect-error
    return this.provider?.connection?.socket?.readyState === 1 || false;
  }

  get connecting() {
    return (
      // @ts-expect-error
      this.provider?.connection?.socket?.readyState === 0 ||
      this.connectPromise !== undefined ||
      false
    );
  }

  public async publish(topic: string, message: string, opts?: RelayerTypes.PublishOptions) {
    this.isInitialized();
    await this.publisher.publish(topic, message, opts);
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
  }

  public async publishCustom(params: { payload: any; opts?: RelayerTypes.PublishOptions }) {
    this.isInitialized();
    await this.publisher.publishCustom(params);
  }

  public async subscribe(topic: string, opts?: RelayerTypes.SubscribeOptions) {
    this.isInitialized();
    if (!opts?.transportType || opts?.transportType === "relay") {
      await this.toEstablishConnection();
    }
    // throw unless explicitly set to false
    const shouldThrowOnFailure =
      typeof opts?.internal?.throwOnFailedPublish === "undefined"
        ? true
        : opts?.internal?.throwOnFailedPublish;

    let id = this.subscriber.topicMap.get(topic)?.[0] || "";
    let resolvePromise: () => void;
    const onSubCreated = (subscription: SubscriberTypes.Active) => {
      if (subscription.topic === topic) {
        this.subscriber.off(SUBSCRIBER_EVENTS.created, onSubCreated);
        resolvePromise();
      }
    };

    await Promise.all([
      new Promise<void>((resolve) => {
        resolvePromise = resolve;
        this.subscriber.on(SUBSCRIBER_EVENTS.created, onSubCreated);
      }),
      new Promise<void>(async (resolve, reject) => {
        const result = await this.subscriber
          .subscribe(topic, {
            internal: {
              throwOnFailedPublish: shouldThrowOnFailure,
            },
            ...opts,
          })
          .catch((error) => {
            if (shouldThrowOnFailure) {
              reject(error);
            }
          });
        id = result || id;
        resolve();
      }),
    ]);
    return id;
  }

  public request = async (request: RequestArguments<RelayJsonRpc.SubscribeParams>) => {
    this.logger.debug(`Publishing Request Payload`);
    const id = request.id || (getBigIntRpcId().toString() as any);
    await this.toEstablishConnection();
    try {
      this.logger.trace(
        {
          id,
          method: request.method,
          topic: request.params?.topic,
        },
        "relayer.request - publishing...",
      );
      const tag = `${id}:${(request.params as any)?.tag || ""}`;
      this.requestsInFlight.push(tag);
      const result = await this.provider.request(request);
      this.requestsInFlight = this.requestsInFlight.filter((i) => i !== tag);
      return result;
    } catch (e) {
      this.logger.debug(`Failed to Publish Request: ${id}`);
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

  public async transportDisconnect() {
    if (this.provider.disconnect && (this.hasExperiencedNetworkDisruption || this.connected)) {
      await createExpiringPromise(this.provider.disconnect(), 2000, "provider.disconnect()").catch(
        () => this.onProviderDisconnect(),
      );
    } else {
      this.onProviderDisconnect();
    }
  }

  public async transportClose() {
    this.transportExplicitlyClosed = true;
    await this.transportDisconnect();
  }

  async transportOpen(relayUrl?: string) {
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
      this.connectPromise = new Promise(async (resolve, reject) => {
        await this.connect(relayUrl)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.connectPromise = undefined;
          });
      });
      await this.connectPromise;
    }
    if (!this.connected) {
      throw new Error(`Couldn't establish socket connection to the relay server: ${this.relayUrl}`);
    }
  }

  public async restartTransport(relayUrl?: string) {
    this.logger.debug({}, "Restarting transport...");
    if (this.connectionAttemptInProgress) return;
    this.relayUrl = relayUrl || this.relayUrl;
    await this.confirmOnlineStateOrThrow();
    await this.transportClose();
    await this.transportOpen();
  }

  public async confirmOnlineStateOrThrow() {
    if (await isOnline()) return;
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

    this.connectionAttemptInProgress = true;
    this.transportExplicitlyClosed = false;
    let attempt = 1;
    while (attempt < 6) {
      try {
        if (this.transportExplicitlyClosed) {
          break;
        }
        this.logger.debug({}, `Connecting to ${this.relayUrl}, attempt: ${attempt}...`);
        // Always create new socket instance when trying to connect because if the socket was dropped due to `socket hang up` exception
        // It wont be able to reconnect
        await this.createProvider();

        await new Promise<void>(async (resolve, reject) => {
          const onDisconnect = () => {
            reject(new Error(`Connection interrupted while trying to connect`));
          };
          this.provider.once(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);

          await createExpiringPromise(
            new Promise((resolve, reject) => {
              this.provider.connect().then(resolve).catch(reject);
            }),
            this.connectTimeout,
            `Socket stalled when trying to connect to ${this.relayUrl}`,
          )
            .catch((e) => {
              reject(e);
            })
            .finally(() => {
              this.provider.off(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
              clearTimeout(this.reconnectTimeout);
            });
          await new Promise(async (_resolve, _reject) => {
            const onDisconnect = () => {
              reject(new Error(`Connection interrupted while trying to subscribe`));
            };
            this.provider.once(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
            await this.subscriber
              .start()
              .then(_resolve)
              .catch(_reject)
              .finally(() => {
                this.provider.off(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
              });
          });
          this.hasExperiencedNetworkDisruption = false;
          resolve();
        });
      } catch (e) {
        await this.subscriber.stop();
        const error = e as Error;
        this.logger.warn({}, error.message);
        this.hasExperiencedNetworkDisruption = true;
      } finally {
        this.connectionAttemptInProgress = false;
      }

      if (this.connected) {
        this.logger.debug({}, `Connected to ${this.relayUrl} successfully on attempt: ${attempt}`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, toMiliseconds(attempt * 1)));
      attempt++;
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
    if (!isNode()) return;
    try {
      //@ts-expect-error - Types are divergent between the node and browser WS API
      if (this.provider?.connection?.socket) {
        //@ts-expect-error
        this.provider?.connection?.socket?.on("ping", () => {
          this.resetPingTimeout();
        });
      }
      this.resetPingTimeout();
    } catch (e) {
      this.logger.warn(e, (e as Error)?.message);
    }
  }

  private resetPingTimeout = () => {
    if (!isNode()) return;
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
    }
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
    const response = formatJsonRpcResult(payload.id, true);
    await this.provider.connection.send(response);
  }

  // ---------- Events Handlers ----------------------------------------------- //
  private onPayloadHandler = (payload: JsonRpcPayload) => {
    this.onProviderPayload(payload);
    this.resetPingTimeout();
  };

  private onConnectHandler = () => {
    this.logger.warn({}, "Relayer connected 🛜");
    this.startPingTimeout();
    this.events.emit(RELAYER_EVENTS.connect);
  };

  private onDisconnectHandler = () => {
    this.logger.warn({}, `Relayer disconnected 🛑`);
    this.requestsInFlight = [];
    this.onProviderDisconnect();
  };

  private onProviderErrorHandler = (error: Error) => {
    this.logger.fatal(`Fatal socket error: ${error.message}`);
    this.events.emit(RELAYER_EVENTS.error, error);
    // close the transport when a fatal error is received as there's no way to recover from it
    // usual cases are missing/invalid projectId, expired jwt token, invalid origin etc
    this.logger.fatal("Fatal socket error received, closing transport");
    this.transportClose();
  };

  private registerProviderListeners = () => {
    this.provider.on(RELAYER_PROVIDER_EVENTS.payload, this.onPayloadHandler);
    this.provider.on(RELAYER_PROVIDER_EVENTS.connect, this.onConnectHandler);
    this.provider.on(RELAYER_PROVIDER_EVENTS.disconnect, this.onDisconnectHandler);
    this.provider.on(RELAYER_PROVIDER_EVENTS.error, this.onProviderErrorHandler);
  };

  private unregisterProviderListeners() {
    this.provider.off(RELAYER_PROVIDER_EVENTS.payload, this.onPayloadHandler);
    this.provider.off(RELAYER_PROVIDER_EVENTS.connect, this.onConnectHandler);
    this.provider.off(RELAYER_PROVIDER_EVENTS.disconnect, this.onDisconnectHandler);
    this.provider.off(RELAYER_PROVIDER_EVENTS.error, this.onProviderErrorHandler);
    clearTimeout(this.pingTimeout);
  }

  private async registerEventListeners() {
    let lastConnectedState = await isOnline();
    subscribeToNetworkChange(async (connected: boolean) => {
      // sometimes the network change event is triggered multiple times so avoid reacting to the samFe value
      if (lastConnectedState === connected) return;

      lastConnectedState = connected;
      if (!connected) {
        // when the device network is restarted, the socket might stay in false `connected` state
        this.hasExperiencedNetworkDisruption = true;
        await this.transportDisconnect();
        this.transportExplicitlyClosed = false;
      } else {
        await this.transportOpen().catch((error) =>
          this.logger.error(error, (error as Error)?.message),
        );
      }
    });

    this.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, async () => {
      if (this.transportExplicitlyClosed) return;
      if (!this.connected && isAppVisible()) {
        try {
          await this.confirmOnlineStateOrThrow();
          await this.transportOpen();
        } catch (error) {
          this.logger.warn(error, (error as Error)?.message);
        }
      }
    });
  }

  private async onProviderDisconnect() {
    clearTimeout(this.pingTimeout);
    this.events.emit(RELAYER_EVENTS.disconnect);
    this.connectionAttemptInProgress = false;
    if (this.reconnectInProgress) return;

    this.reconnectInProgress = true;
    await this.subscriber.stop();

    if (!this.subscriber.hasAnyTopics) return;
    if (this.transportExplicitlyClosed) return;

    this.reconnectTimeout = setTimeout(async () => {
      await this.transportOpen().catch((error) =>
        this.logger.error(error, (error as Error)?.message),
      );
      this.reconnectTimeout = undefined;
      this.reconnectInProgress = false;
    }, toMiliseconds(RELAYER_RECONNECT_TIMEOUT));
  }

  private isInitialized() {
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
    await this.connect();
  }
}
