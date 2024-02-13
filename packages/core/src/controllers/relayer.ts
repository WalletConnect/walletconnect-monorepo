/* eslint-disable no-console */
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
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
  pino,
  Logger,
} from "@walletconnect/logger";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { ONE_MINUTE, toMiliseconds } from "@walletconnect/time";
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
  getBundleId,
  getInternalError,
  isNode,
} from "@walletconnect/utils";

import {
  RELAYER_SDK_VERSION,
  RELAYER_CONTEXT,
  RELAYER_DEFAULT_LOGGER,
  RELAYER_EVENTS,
  RELAYER_PROVIDER_EVENTS,
  RELAYER_SUBSCRIBER_SUFFIX,
  RELAYER_DEFAULT_RELAY_URL,
  RELAYER_FAILOVER_RELAY_URL,
  SUBSCRIBER_EVENTS,
  // RELAYER_TRANSPORT_CUTOFF,
} from "../constants";
import { MessageTracker } from "./messages";
import { Publisher } from "./publisher";
import { Subscriber } from "./subscriber";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";

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
  private bundleId: string | undefined;
  private connectionStatusPollingInterval = 20;
  private staleConnectionErrors = ["socket hang up", "socket stalled"];
  private hasExperiencedNetworkDisruption = false;
  private requestsInFlight = new Map<
    number,
    {
      promise: Promise<any>;
      request: RequestArguments<RelayJsonRpc.SubscribeParams>;
    }
  >();

  private pingTimeout: NodeJS.Timeout | undefined;
  private start = Date.now();

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
    this.bundleId = getBundleId();

    // re-assigned during init()
    this.provider = {} as IJsonRpcProvider;
  }

  public async init() {
    this.logger.trace(`Initialized`);
    this.registerEventListeners();
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
    this.initialized = true;
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  get connected() {
    // @ts-ignore
    return this.provider?.connection?.socket?.readyState === 1;
  }

  get connecting() {
    // @ts-ignore
    return this.provider?.connection?.socket?.readyState === 0;
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
      new Promise<void>(async (resolve) => {
        id = await this.subscriber.subscribe(topic, opts);
        resolve();
      }),
    ]);
    return id;
  }

  public request = async (request: RequestArguments<RelayJsonRpc.SubscribeParams>) => {
    this.logger.debug(`Publishing Request Payload`);
    await this.toEstablishConnection();
    const id = request.id || (getBigIntRpcId().toString() as any);

    const requestPromise = this.provider.request(request);
    this.requestsInFlight.set(id, {
      promise: requestPromise,
      request,
    });
    const reqStart = Date.now();
    try {
      console.log("publishing message..", {
        id,
        method: request.method,
        topic: request.params?.topic,
        elapsed: Date.now() - reqStart,
      });

      const result = await new Promise(async (resolve, reject) => {
        const onDisconnect = () => {
          console.log("socket stalled", {
            id,
            method: request.method,
            topic: request.params?.topic,
            elapsed: Date.now() - reqStart,
          });
          reject(new Error(`Socket stalled - ${id}`));
        };
        this.provider.on(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
        const res = await requestPromise;
        this.provider.off(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
        resolve(res);
      });

      console.log("message published", {
        id,
        method: request.method,
        topic: request.params?.topic,
        elapsed: Date.now() - reqStart,
      });
      return result as any;
    } catch (e) {
      this.logger.debug(`Failed to Publish Request`);
      this.logger.error(e as any);
      throw e;
    } finally {
      this.requestsInFlight.delete(id);
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
    if (!this.hasExperiencedNetworkDisruption && this.connected && this.requestsInFlight.size > 0) {
      try {
        await Promise.all(
          Array.from(this.requestsInFlight.values()).map((request) => request.promise),
        );
      } catch (e) {
        this.logger.warn(e);
      }
    }

    if (this.connected) {
      await createExpiringPromise(this.provider.disconnect(), 2000, "provider.disconnect()").catch(
        () => this.onProviderDisconnect(),
      );
    }
  }

  public async transportClose() {
    this.transportExplicitlyClosed = true;
    await this.transportDisconnect();
  }

  public async transportOpen(relayUrl?: string) {
    await this.confirmOnlineStateOrThrow();
    if (relayUrl && relayUrl !== this.relayUrl) {
      this.relayUrl = relayUrl;
      await this.transportDisconnect();
      await this.createProvider();
    }
    const start = Date.now();
    this.connectionAttemptInProgress = true;
    this.transportExplicitlyClosed = false;
    try {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          // if (!this.initialized) resolve();
          const onSubscribed = () => {
            console.log("subscriber done", {
              name: this.core.name,
              elapsed: Date.now() - start,
            });
            this.subscriber.off(SUBSCRIBER_EVENTS.resubscribed, onSubscribed);
            this.provider.off(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
            resolve();
          };
          const onDisconnect = () => {
            this.subscriber.off(SUBSCRIBER_EVENTS.resubscribed, onSubscribed);
            this.provider.off(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
            reject(new Error(`Socket stalled when trying to connect to ${this.relayUrl}`));
          };
          this.subscriber.once(SUBSCRIBER_EVENTS.resubscribed, onSubscribed);
          this.provider.on(RELAYER_PROVIDER_EVENTS.disconnect, onDisconnect);
        }),
        new Promise<void>(async (resolve, reject) => {
          console.log("opening socket connection...", {
            name: this.core.name,
            elapsed: Date.now() - start,
          });
          await createExpiringPromise(
            this.provider.connect(),
            toMiliseconds(ONE_MINUTE),
            `Socket stalled when trying to connect to ${this.relayUrl}`,
          ).catch((e) => {
            reject(e);
          });
          console.log("socket connection opened, waiting for subscriber...", {
            name: this.core.name,
            elapsed: Date.now() - start,
          });
          this.hasExperiencedNetworkDisruption = false;
          resolve();
        }),
      ]);
    } catch (e) {
      this.logger.error(e);
      const error = e as Error;
      if (!this.isConnectionStalled(error.message)) {
        throw e;
      }
    } finally {
      this.connectionAttemptInProgress = false;
    }
  }

  public async restartTransport(relayUrl?: string) {
    if (this.connectionAttemptInProgress) return;
    this.relayUrl = relayUrl || this.relayUrl;
    await this.confirmOnlineStateOrThrow();
    await this.transportDisconnect();
    await this.createProvider();
    await this.transportOpen();
  }

  public async confirmOnlineStateOrThrow() {
    if (await isOnline()) return;
    throw new Error("No internet connection detected. Please restart your network and try again.");
  }

  // ---------- Private ----------------------------------------------- //

  private startPingTimeout() {
    if (!isNode()) return;
    console.log("starting ping timeout..", {
      name: this.core.name,
    });

    //@ts-ignore
    if (this.provider?.connection?.socket) {
      //@ts-ignore
      this.provider?.connection?.socket?.on("ping", () => {
        console.log("ping received, clearing timeout", {
          name: this.core.name,
        });
        this.heartbeat();
      });
    }

    this.heartbeat();
  }

  private heartbeat = () => {
    clearTimeout(this.pingTimeout);

    this.pingTimeout = setTimeout(() => {
      console.log("ping timeout reached, terminating..", {
        name: this.core.name,
        requestsInFlight: this.requestsInFlight.size,
      });
      //@ts-ignore
      this.provider?.connection?.socket?.terminate();
    }, 30000 + 1000);
  };

  private isConnectionStalled(message: string) {
    return this.staleConnectionErrors.some((error) => message.includes(error));
  }

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
        }),
      ),
    );
    this.registerProviderListeners();
  }

  private async recordMessageEvent(messageEvent: RelayerTypes.MessageEvent) {
    const { topic, message } = messageEvent;
    await this.messages.set(topic, message);
  }

  private async shouldIgnoreMessageEvent(
    messageEvent: RelayerTypes.MessageEvent,
  ): Promise<boolean> {
    const { topic, message } = messageEvent;

    // Ignore if incoming `message` is clearly invalid.
    if (!message || message.length === 0) {
      this.logger.debug(`Ignoring invalid/empty message: ${message}`);
      return true;
    }

    // Ignore if `topic` is not subscribed to.
    if (!(await this.subscriber.isSubscribed(topic))) {
      this.logger.debug(`Ignoring message for non-subscribed topic ${topic}`);
      return true;
    }

    // Ignore if `message` is a duplicate.
    const exists = this.messages.has(topic, message);
    if (exists) {
      this.logger.debug(`Ignoring duplicate message: ${message}`);
    }
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

  // ---------- Events Handlers ----------------------------------------------- //
  private onPayloadHandler = (payload: JsonRpcPayload) => {
    this.onProviderPayload(payload);
    this.startPingTimeout();
  };

  private onConnectHandler = () => {
    console.log("onConnectHandler", {
      name: this.core.name,
      elapsed: Date.now() - this.start,
    });
    this.startPingTimeout();
    this.events.emit(RELAYER_EVENTS.connect);
  };

  private onDisconnectHandler = () => {
    console.log("onDisconnectHandler", {
      name: this.core.name,
      elapsed: Date.now() - this.start,
    });
    this.onProviderDisconnect();
  };

  private onProviderErrorHandler = (error: Error) => {
    this.logger.error(error);
    this.events.emit(RELAYER_EVENTS.error, error);
    // close the transport when a fatal error is received as there's no way to recover from it
    // usual cases are missing/invalid projectId, expired jwt token, invalid origin etc
    this.logger.info("Fatal socket error received, closing transport");
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
  }

  private async registerEventListeners() {
    this.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, async () => {
      if (this.transportExplicitlyClosed) return;
      if (this.hasExperiencedNetworkDisruption || !this.connected) {
        await this.restartTransport().catch((e) => this.logger.error(e));
      }
    });

    this.events.on(RELAYER_EVENTS.connection_stalled, () => {
      if (this.connected) return;
      this.restartTransport().catch((error) => this.logger.error(error));
    });

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
        await this.restartTransport().catch((error) => this.logger.error(error));
      }
    });
  }

  private onProviderDisconnect() {
    this.events.emit(RELAYER_EVENTS.disconnect);
    this.connectionAttemptInProgress = false;
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
    return await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (this.connected) {
          clearInterval(interval);
          resolve();
        }
      }, this.connectionStatusPollingInterval);
    });
  }
}
