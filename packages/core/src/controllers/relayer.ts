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

  private connectionState = {
    connected: false,
    connecting: false,
    initiatedBy: "",
    completed: false,
  };

  // private publishAttempts = new Map<string, number>();

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
      this.connectionState.initiatedBy = "init";
      await this.transportOpen();
    } catch {
      this.logger.warn(
        `Connection via ${this.relayUrl} failed, attempting to connect via failover domain ${RELAYER_FAILOVER_RELAY_URL}...`,
      );
      this.connectionState.initiatedBy = "init_failover";
      await this.restartTransport(RELAYER_FAILOVER_RELAY_URL);
    }
    this.initialized = true;
    // setTimeout(async () => {
    //   if (this.subscriber.subscriptions.size === 0 && this.connected) {
    //     this.logger.info(`No topics subscribed to after init, closing transport`);
    //     console.log(" auto closing..", {
    //       name: this.name,
    //     });
    //     await this.transportClose();
    //   }
    // }, RELAYER_TRANSPORT_CUTOFF);
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
    const id = request.id || (getBigIntRpcId() as any);
    // const attempts = this.publishAttempts.get(id) || 0;

    // let requestPromise;
    // console.log("requestPromise", request.method, id);
    // if (
    //   request.method === "irn_subscribe" ||
    //   request.method === "irn_batchSubscribe" ||
    //   !id ||
    //   attempts > 3
    // ) {
    //   requestPromise = this.provider.request(request);
    // } else {
    //   requestPromise = new Promise(() => {
    //     //@ts-ignore
    //     console.log(`Request not published`, id, request.params.tag, attempts);
    //   });
    // }

    // this.publishAttempts.set(id, attempts + 1);
    const requestPromise = this.provider.request(request);
    this.requestsInFlight.set(id, {
      promise: requestPromise,
      request,
    });
    try {
      console.log("@rel request ", {
        id,
        // @ts-ignore
        tag: request.params?.tag,
        name: this.core.name,
      });
      await this.toEstablishConnection();
      console.log("@rel publishing..", {
        id,
        // @ts-ignore
        tag: request.params?.tag,
        name: this.core.name,
      });
      const res = await requestPromise;
      console.log("@rel published", {
        id,
        // @ts-ignore
        tag: request.params?.tag,
        name: this.core.name,
      });

      return res;
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
    console.log("transportDisconnect called", {
      name: this.core.name,
      hasExperiencedNetworkDisruption: this.hasExperiencedNetworkDisruption,
      connected: this.connected,
      requestsInFlight: this.requestsInFlight,
      connectionState: this.connectionState,
    });
    if (!this.hasExperiencedNetworkDisruption && this.connected && this.requestsInFlight.size > 0) {
      console.log("Transport close called while requests in flight", this.requestsInFlight.size);
      try {
        await Promise.all(
          Array.from(this.requestsInFlight.values()).map((request) => request.promise),
        );
      } catch (e) {
        this.logger.warn(e);
      }
    }

    /**
     * if there was a network disruption like restart of network driver, the socket is most likely stalled and we can't rely on it
     * as in this case provider.disconnect() is not reliable, since it might resolve after a long time or not emit disconnect event at all.
     */
    if (this.hasExperiencedNetworkDisruption && this.connected) {
      await createExpiringPromise(this.provider.disconnect(), 1000, "provider.disconnect()").catch(
        () => this.onProviderDisconnect(),
      );
    } else if (this.connected) {
      await this.provider.disconnect();
    }
    this.connectionState.connected = false;
  }

  public async transportClose() {
    this.transportExplicitlyClosed = true;
    this.connectionState.initiatedBy = "transportClose";
    await this.transportDisconnect();
  }

  public async transportOpen(relayUrl?: string) {
    await this.confirmOnlineStateOrThrow();

    const start = Date.now();
    if (relayUrl && relayUrl !== this.relayUrl) {
      this.relayUrl = relayUrl;
      await this.transportDisconnect();
      await this.createProvider();
    }

    this.connectionAttemptInProgress = true;
    this.transportExplicitlyClosed = false;
    this.connectionState.connecting = true;
    this.connectionState.completed = false;
    try {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          if (!this.initialized) resolve();

          const onSubscribed = () => {
            console.log("@rel - subscribed", {
              name: this.core.name,
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
          console.log("this.provider.connect() start", {
            name: this.core.name,
            connectionState: this.connectionState,
          });
          await createExpiringPromise(
            this.provider.connect(),
            toMiliseconds(ONE_MINUTE),
            `Socket stalled when trying to connect to ${this.relayUrl}`,
          ).catch((e) => {
            console.error("this.provider.connect() catch", e);
            reject(e);
          });
          console.log("this.provider.connect() end", {
            name: this.core.name,
          });
          this.connectionState.connected = true;
          resolve();
        }),
      ]);
    } catch (e) {
      this.logger.error(e);
      const error = e as Error;
      this.connectionState.connecting = false;
      this.connectionState.connected = false;
      this.connectionState.initiatedBy = "exception while connect()";
      if (!this.isConnectionStalled(error.message)) {
        throw e;
      }
    } finally {
      this.connectionAttemptInProgress = false;
      if (!this.connected) {
        setTimeout(() => {
          this.provider.events.emit(RELAYER_PROVIDER_EVENTS.disconnect);
        }, 0);
      }
    }
    this.connectionState.completed = true;
    const done = Date.now();

    console.log("transportOpen done", {
      name: this.core.name,
      connectionState: this.connectionState,
      duration: done - start,
    });
    this.connectionState.initiatedBy = "";
    // if (this.initialized) {
    //   console.log("throttle", { name: this.core.name });
    //   await new Promise((resolve) => setTimeout(resolve, 5_000));
    // }
    // setTimeout(() => {
    //   if (this.connected) {
    //     console.log("simulating drop", {
    //       name: this.core.name,
    //     });
    //     this.provider.connection.close();
    //   }
    // }, done - start + 1500);
  }

  public async restartTransport(relayUrl?: string) {
    console.log(`restartTransport called, skipping? ${this.connectionAttemptInProgress}`);
    this.connectionAttemptInProgress = true;
    this.relayUrl = relayUrl || this.relayUrl;
    await this.transportDisconnect();
    await this.createProvider();
    await this.transportOpen();
    this.connectionAttemptInProgress = false;
  }

  public async confirmOnlineStateOrThrow() {
    if (await isOnline()) return;
    throw new Error("No internet connection detected. Please restart your network and try again.");
  }

  // ---------- Private ----------------------------------------------- //

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
      console.log("@relayer received", {
        name: this.core.name,
        id: payload.id,
        //@ts-ignore
        tag: event.data.tag,
      });
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
  };

  private onConnectHandler = () => {
    console.log("onConnectHandler", {
      name: this.core.name,
    });
    this.events.emit(RELAYER_EVENTS.connect);
  };

  private onDisconnectHandler = () => {
    console.log("onDisconnectHandler", {
      name: this.core.name,
      connected: this.connected,
      connectionState: this.connectionState,
      requestsInFlight: this.requestsInFlight,
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
    this.events.on(RELAYER_EVENTS.connection_stalled, () => {
      if (this.connected) return;
      console.log("@rel connection stalled", {
        name: this.core.name,
      });
      this.connectionState.initiatedBy = "connection_stalled";
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
        this.connectionState.initiatedBy = "network_change";
        await this.restartTransport().catch((error) => this.logger.error(error));
      }
    });
  }

  private onProviderDisconnect() {
    this.events.emit(RELAYER_EVENTS.disconnect);
    this.attemptToReconnect();
  }

  private attemptToReconnect() {
    console.log("attemptToReconnect", {
      name: this.core.name,
      transportExplicitlyClosed: this.transportExplicitlyClosed,
      connectionAttemptInProgress: this.connectionAttemptInProgress,
      connecting: this.connecting,
      connected: this.connected,
    });
    if (this.transportExplicitlyClosed || this.connectionAttemptInProgress) {
      console.log("explicitly closed, returning", {
        name: this.core.name,
        connectionAttemptInProgress: this.connectionAttemptInProgress,
        transportExplicitlyClosed: this.transportExplicitlyClosed,
      });
      return;
    }

    this.logger.info("attemptToReconnect called. Connecting...");
    // Attempt reconnection
    setTimeout(async () => {
      this.connectionState.initiatedBy = "attemptToReconnect";
      await this.restartTransport().catch((error) => this.logger.error(error));
    }, 0);
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
      console.log("waiting for connection..", {
        name: this.core.name,
      });
      const interval = setInterval(() => {
        if (this.connected) {
          console.log("connection is back!", {
            name: this.core.name,
          });
          clearInterval(interval);
          resolve();
        }
      }, this.connectionStatusPollingInterval);
    });
  }
}
