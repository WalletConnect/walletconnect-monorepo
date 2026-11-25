import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import {
  ICore,
  PairingTypes,
  IPairing,
  IPairingPrivate,
  IStore,
  RelayerTypes,
  PairingJsonRpcTypes,
  ExpirerTypes,
  EventClientTypes,
} from "@walletconnect/types";
import {
  getInternalError,
  parseUri,
  calcExpiry,
  generateRandomBytes32,
  formatUri,
  getSdkError,
  engineEvent,
  createDelayedPromise,
  isValidParams,
  isValidUrl,
  isValidString,
  isExpired,
  parseExpirerTarget,
  TYPE_1,
  TYPE_2,
  BASE64URL,
} from "@walletconnect/utils";
import {
  formatJsonRpcRequest,
  formatJsonRpcResult,
  formatJsonRpcError,
  isJsonRpcRequest,
  isJsonRpcResponse,
  isJsonRpcResult,
  isJsonRpcError,
} from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES, toMiliseconds } from "@walletconnect/time";
import EventEmitter from "events";
import {
  PAIRING_CONTEXT,
  PAIRING_STORAGE_VERSION,
  CORE_STORAGE_PREFIX,
  RELAYER_DEFAULT_PROTOCOL,
  PAIRING_RPC_OPTS,
  RELAYER_EVENTS,
  EXPIRER_EVENTS,
  PAIRING_EVENTS,
  EVENT_CLIENT_PAIRING_TRACES,
  EVENT_CLIENT_PAIRING_ERRORS,
  TRANSPORT_TYPES,
} from "../constants/index.js";
import { Store } from "../controllers/store.js";

export class Pairing implements IPairing {
  public name = PAIRING_CONTEXT;
  public version = PAIRING_STORAGE_VERSION;

  public events: EventEmitter = new EventEmitter();
  public pairings: IStore<string, PairingTypes.Struct>;

  private initialized = false;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private storagePrefix = CORE_STORAGE_PREFIX;
  private ignoredPayloadTypes = [TYPE_1];
  private registeredMethods: string[] = [];

  constructor(
    public core: ICore,
    public logger: Logger,
  ) {
    this.core = core;
    this.logger = generateChildLogger(logger, this.name);
    this.pairings = new Store(this.core, this.logger, this.name, this.storagePrefix);
  }

  public init: IPairing["init"] = async () => {
    this.core.assertActive();
    if (!this.initialized) {
      await this.pairings.init();
      this.core.assertActive();
      await this.cleanup();
      this.core.assertActive();
      this.registerRelayerEvents();
      this.registerExpirerEvents();
      this.initialized = true;
      this.logger.trace(`Initialized`);
    }
  };

  public async dispose(): Promise<void> {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.events.removeAllListeners();
    await this.pairings.dispose();
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  public register: IPairing["register"] = ({ methods }) => {
    this.isInitialized();
    this.registeredMethods = [...new Set([...this.registeredMethods, ...methods])];
  };

  public create: IPairing["create"] = async (params, ownerSignal) => {
    this.assertOwner(ownerSignal);
    this.isInitialized();
    const symKey = generateRandomBytes32();
    const topic = await this.core.crypto.setSymKey(symKey);
    this.assertOwner(ownerSignal);
    const expiry = calcExpiry(FIVE_MINUTES);
    const relay = { protocol: RELAYER_DEFAULT_PROTOCOL };
    const pairing = { topic, expiry, relay, active: false, methods: params?.methods };
    const uri = formatUri({
      protocol: this.core.protocol,
      version: this.core.version,
      topic,
      symKey,
      relay,
      expiryTimestamp: expiry,
      methods: params?.methods,
    });
    this.events.emit(PAIRING_EVENTS.create, pairing);
    this.assertOwner(ownerSignal);
    await this.core.expirer.set(topic, expiry);
    this.assertOwner(ownerSignal);
    await this.pairings.set(topic, pairing);
    this.assertOwner(ownerSignal);
    await this.core.relayer.subscribe(
      topic,
      {
        transportType: params?.transportType,
        internal: params?.internal,
      },
      ownerSignal,
    );
    this.assertOwner(ownerSignal);

    return { topic, uri };
  };

  public pair: IPairing["pair"] = async (params, ownerSignal) => {
    this.assertOwner(ownerSignal);
    this.isInitialized();

    const event = this.core.eventClient.createEvent({
      properties: {
        topic: params?.uri,
        trace: [EVENT_CLIENT_PAIRING_TRACES.pairing_started],
      },
    });

    this.isValidPair(params, event);

    const { topic, symKey, relay, expiryTimestamp, methods } = parseUri(params.uri);

    event.props.properties.topic = topic;
    event.addTrace(EVENT_CLIENT_PAIRING_TRACES.pairing_uri_validation_success);
    event.addTrace(EVENT_CLIENT_PAIRING_TRACES.pairing_uri_not_expired);

    let existingPairing;
    if (this.pairings.keys.includes(topic)) {
      existingPairing = this.pairings.get(topic);
      event.addTrace(EVENT_CLIENT_PAIRING_TRACES.existing_pairing);
      if (existingPairing.active) {
        event.setError(EVENT_CLIENT_PAIRING_ERRORS.active_pairing_already_exists);
        throw new Error(
          `Pairing already exists: ${topic}. Please try again with a new connection URI.`,
        );
      } else {
        event.addTrace(EVENT_CLIENT_PAIRING_TRACES.pairing_not_expired);
      }
    }

    const expiry = expiryTimestamp || calcExpiry(FIVE_MINUTES);
    const pairing = { topic, relay, expiry, active: false, methods };
    await this.core.expirer.set(topic, expiry);
    this.assertOwner(ownerSignal);
    await this.pairings.set(topic, pairing);
    this.assertOwner(ownerSignal);

    event.addTrace(EVENT_CLIENT_PAIRING_TRACES.store_new_pairing);

    if (params.activatePairing) {
      await this.activate({ topic }, ownerSignal);
      this.assertOwner(ownerSignal);
    }

    this.events.emit(PAIRING_EVENTS.create, pairing);
    this.assertOwner(ownerSignal);

    event.addTrace(EVENT_CLIENT_PAIRING_TRACES.emit_inactive_pairing);

    // avoid overwriting keychain pairing already exists
    if (!this.core.crypto.keychain.has(topic)) {
      await this.core.crypto.setSymKey(symKey, topic);
      this.assertOwner(ownerSignal);
    }
    event.addTrace(EVENT_CLIENT_PAIRING_TRACES.subscribing_pairing_topic);

    try {
      await this.core.relayer.confirmOnlineStateOrThrow(ownerSignal);
      this.assertOwner(ownerSignal);
    } catch (error) {
      this.assertOwner(ownerSignal);
      event.setError(EVENT_CLIENT_PAIRING_ERRORS.no_internet_connection);
    }

    try {
      await this.core.relayer.subscribe(topic, { relay }, ownerSignal);
      this.assertOwner(ownerSignal);
    } catch (error) {
      this.assertOwner(ownerSignal);
      event.setError(EVENT_CLIENT_PAIRING_ERRORS.subscribe_pairing_topic_failure);
      throw error;
    }

    event.addTrace(EVENT_CLIENT_PAIRING_TRACES.subscribe_pairing_topic_success);

    return pairing;
  };

  public activate: IPairing["activate"] = async ({ topic }, ownerSignal) => {
    this.assertOwner(ownerSignal);
    this.isInitialized();
    const expiry = calcExpiry(FIVE_MINUTES);
    await this.core.expirer.set(topic, expiry);
    this.assertOwner(ownerSignal);
    await this.pairings.update(topic, { active: true, expiry });
    this.assertOwner(ownerSignal);
  };

  /**
   * @deprecated Ping will be removed in the next major release.
   */
  public ping: IPairing["ping"] = async (params, ownerSignal) => {
    this.assertOwner(ownerSignal);
    this.isInitialized();
    await this.isValidPing(params);
    this.assertOwner(ownerSignal);
    this.logger.warn("ping() is deprecated and will be removed in the next major release.");
    const { topic } = params;
    if (this.pairings.keys.includes(topic)) {
      const id = await this.sendRequest(topic, "wc_pairingPing", {}, ownerSignal);
      this.assertOwner(ownerSignal);
      await this.core.relayer.withOwner(async (signal) => {
        const { done, resolve, reject } = createDelayedPromise<void>(undefined, undefined, signal);
        const eventName = engineEvent("pairing_ping", id);
        const listener = ({ error }: { error?: any }) => {
          if (error) reject(error);
          else resolve();
        };
        this.events.once(eventName, listener);
        try {
          await done();
          this.assertOwner(ownerSignal);
        } finally {
          this.events.off(eventName, listener);
        }
      }, ownerSignal);
    }
  };

  public updateExpiry: IPairing["updateExpiry"] = async ({ topic, expiry }, ownerSignal) => {
    this.assertOwner(ownerSignal);
    this.isInitialized();
    await this.pairings.update(topic, { expiry });
    this.assertOwner(ownerSignal);
  };

  public updateMetadata: IPairing["updateMetadata"] = async ({ topic, metadata }, ownerSignal) => {
    this.assertOwner(ownerSignal);
    this.isInitialized();
    await this.pairings.update(topic, { peerMetadata: metadata });
    this.assertOwner(ownerSignal);
  };

  public getPairings: IPairing["getPairings"] = () => {
    this.isInitialized();
    return this.pairings.values;
  };

  public disconnect: IPairing["disconnect"] = async (params, ownerSignal) => {
    this.assertOwner(ownerSignal);
    this.isInitialized();
    await this.isValidDisconnect(params);
    this.assertOwner(ownerSignal);
    const { topic } = params;
    if (this.pairings.keys.includes(topic)) {
      await this.sendRequest(
        topic,
        "wc_pairingDelete",
        getSdkError("USER_DISCONNECTED"),
        ownerSignal,
      );
      this.assertOwner(ownerSignal);
      await this.deletePairing(topic, undefined, ownerSignal);
      this.assertOwner(ownerSignal);
    }
  };

  public formatUriFromPairing: IPairing["formatUriFromPairing"] = (pairing) => {
    this.isInitialized();
    const { topic, relay, expiry, methods } = pairing;
    const symKey = this.core.crypto.keychain.get(topic);
    return formatUri({
      protocol: this.core.protocol,
      version: this.core.version,
      topic,
      symKey,
      relay,
      expiryTimestamp: expiry,
      methods,
    });
  };

  // ---------- Private Helpers ----------------------------------------------- //

  private sendRequest: IPairingPrivate["sendRequest"] = async (
    topic,
    method,
    params,
    ownerSignal,
  ) => {
    this.assertOwner(ownerSignal);
    const payload = formatJsonRpcRequest(method, params);
    const message = await this.core.crypto.encode(topic, payload);
    this.assertOwner(ownerSignal);
    const opts = PAIRING_RPC_OPTS[method].req;
    await this.core.history.set(topic, payload);
    this.assertOwner(ownerSignal);
    await this.core.relayer.publish(topic, message, opts, ownerSignal);
    return payload.id;
  };

  private sendResult: IPairingPrivate["sendResult"] = async (id, topic, result) => {
    const payload = formatJsonRpcResult(id, result);
    const message = await this.core.crypto.encode(topic, payload);
    const record = await this.core.history.get(topic, id);
    const method = record.request.method as PairingJsonRpcTypes.WcMethod;
    const opts = PAIRING_RPC_OPTS[method].res;
    await this.core.relayer.publish(topic, message, opts);
    await this.core.history.resolve(payload);
  };

  private sendError: IPairingPrivate["sendError"] = async (id, topic, error) => {
    const payload = formatJsonRpcError(id, error);
    const message = await this.core.crypto.encode(topic, payload);
    const record = await this.core.history.get(topic, id);
    const method = record.request.method as PairingJsonRpcTypes.WcMethod;

    const opts = PAIRING_RPC_OPTS[method]
      ? PAIRING_RPC_OPTS[method].res
      : PAIRING_RPC_OPTS.unregistered_method.res;

    await this.core.relayer.publish(topic, message, opts);
    await this.core.history.resolve(payload);
  };

  private deletePairing: IPairingPrivate["deletePairing"] = async (
    topic,
    expirerHasDeleted,
    ownerSignal,
  ) => {
    this.assertOwner(ownerSignal);
    // Await the unsubscribe first to avoid deleting the symKey too early below.
    await this.core.relayer.unsubscribe(topic, undefined, ownerSignal);
    this.assertOwner(ownerSignal);
    await Promise.all([
      this.pairings.delete(topic, getSdkError("USER_DISCONNECTED")),
      this.core.crypto.deleteSymKey(topic),
      expirerHasDeleted ? Promise.resolve() : this.core.expirer.del(topic),
    ]);
    this.assertOwner(ownerSignal);
  };

  private assertOwner(ownerSignal?: AbortSignal) {
    this.core.assertActive();
    if (ownerSignal?.aborted) throw new Error("WalletConnect operation owner is disposed");
  }

  private isInitialized() {
    this.core.assertActive();
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }

  private cleanup = async () => {
    const expiredPairings = this.pairings.getAll().filter((pairing) => isExpired(pairing.expiry));
    await Promise.all(expiredPairings.map((pairing) => this.deletePairing(pairing.topic)));
  };

  // ---------- Relay Events Router ----------------------------------- //

  private registerRelayerEvents() {
    this.core.relayer.on(RELAYER_EVENTS.message, async (event: RelayerTypes.MessageEvent) => {
      const { topic, message, transportType } = event;

      // Do not handle if the topic is not related to known pairing topics.
      if (!this.pairings.keys.includes(topic)) return;

      // Do not handle link-mode messages
      if (transportType === TRANSPORT_TYPES.link_mode) return;

      try {
        // TYPE_2 payloads should only be handled in link mode
        if (this.core.crypto.getPayloadType(message, BASE64URL) === TYPE_2) {
          this.logger.warn(
            `registerRelayerEvents() -> non-link mode TYPE_2 payload ignored: ${message}`,
          );
          return;
        }
      } catch {}

      // messages of certain types should be ignored as they are handled by their respective SDKs
      if (this.ignoredPayloadTypes.includes(this.core.crypto.getPayloadType(message))) return;

      try {
        const payload = await this.core.crypto.decode(topic, message);

        if (isJsonRpcRequest(payload)) {
          await this.core.history.set(topic, payload);
          await this.onRelayEventRequest({ topic, payload });
        } else if (isJsonRpcResponse(payload)) {
          await this.core.history.resolve(payload);
          await this.onRelayEventResponse({ topic, payload });
          await this.core.history.delete(topic, payload.id);
        }
        await this.core.relayer.messages.ack(topic, message);
      } catch (error) {
        this.logger.error(error);
      }
    });
  }

  private onRelayEventRequest: IPairingPrivate["onRelayEventRequest"] = async (event) => {
    const { topic, payload } = event;
    const reqMethod = payload.method as PairingJsonRpcTypes.WcMethod;

    switch (reqMethod) {
      case "wc_pairingPing":
        return await this.onPairingPingRequest(topic, payload);
      case "wc_pairingDelete":
        return await this.onPairingDeleteRequest(topic, payload);
      default:
        return await this.onUnknownRpcMethodRequest(topic, payload);
    }
  };

  private onRelayEventResponse: IPairingPrivate["onRelayEventResponse"] = async (event) => {
    const { topic, payload } = event;
    const record = await this.core.history.get(topic, payload.id);
    const resMethod = record.request.method as PairingJsonRpcTypes.WcMethod;

    switch (resMethod) {
      case "wc_pairingPing":
        return this.onPairingPingResponse(topic, payload);
      default:
        return this.onUnknownRpcMethodResponse(resMethod);
    }
  };

  private onPairingPingRequest: IPairingPrivate["onPairingPingRequest"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    try {
      this.isValidPing({ topic });
      await this.sendResult<"wc_pairingPing">(id, topic, true);
      this.events.emit(PAIRING_EVENTS.ping, { id, topic });
    } catch (err: any) {
      await this.sendError(id, topic, err);
      this.logger.error(err);
    }
  };

  private onPairingPingResponse: IPairingPrivate["onPairingPingResponse"] = (_topic, payload) => {
    const { id } = payload;
    // put at the end of the stack to avoid a race condition
    // where pairing_ping listener is not yet initialized
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.core.signal.aborted) return;
      if (isJsonRpcResult(payload)) {
        this.events.emit(engineEvent("pairing_ping", id), {});
      } else if (isJsonRpcError(payload)) {
        this.events.emit(engineEvent("pairing_ping", id), { error: payload.error });
      }
    }, 500);
    this.timers.add(timer);
  };

  private onPairingDeleteRequest: IPairingPrivate["onPairingDeleteRequest"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    try {
      this.isValidDisconnect({ topic });
      await this.deletePairing(topic);
      this.events.emit(PAIRING_EVENTS.delete, { id, topic });
    } catch (err: any) {
      await this.sendError(id, topic, err);
      this.logger.error(err);
    }
  };

  private onUnknownRpcMethodRequest: IPairingPrivate["onUnknownRpcMethodRequest"] = async (
    topic,
    payload,
  ) => {
    const { id, method } = payload;

    try {
      // Ignore if the implementing client has registered this method as known.
      if (this.registeredMethods.includes(method)) return;
      const error = getSdkError("WC_METHOD_UNSUPPORTED", method);
      await this.sendError(id, topic, error);
      this.logger.error(error);
    } catch (err: any) {
      await this.sendError(id, topic, err);
      this.logger.error(err);
    }
  };

  private onUnknownRpcMethodResponse: IPairingPrivate["onUnknownRpcMethodResponse"] = (method) => {
    // Ignore if the implementing client has registered this method as known.
    if (this.registeredMethods.includes(method)) return;
    this.logger.error(getSdkError("WC_METHOD_UNSUPPORTED", method));
  };

  // ---------- Expirer Events ---------------------------------------- //

  private registerExpirerEvents() {
    this.core.expirer.on(EXPIRER_EVENTS.expired, async (event: ExpirerTypes.Expiration) => {
      const { topic } = parseExpirerTarget(event.target);
      if (!topic) return;
      if (!this.pairings.keys.includes(topic)) return;
      await this.deletePairing(topic, true);
      this.events.emit(PAIRING_EVENTS.expire, { topic });
    });
  }

  // ---------- Validation Helpers ----------------------------------- //

  private isValidPair = (params: { uri: string }, event: EventClientTypes.Event) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `pair() params: ${params}`);
      event.setError(EVENT_CLIENT_PAIRING_ERRORS.malformed_pairing_uri);
      throw new Error(message);
    }
    if (!isValidUrl(params.uri)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `pair() uri: ${params.uri}`);
      event.setError(EVENT_CLIENT_PAIRING_ERRORS.malformed_pairing_uri);
      throw new Error(message);
    }
    const uri = parseUri(params?.uri);
    if (!uri?.relay?.protocol) {
      const { message } = getInternalError("MISSING_OR_INVALID", `pair() uri#relay-protocol`);
      event.setError(EVENT_CLIENT_PAIRING_ERRORS.malformed_pairing_uri);
      throw new Error(message);
    }
    if (!uri?.symKey) {
      const { message } = getInternalError("MISSING_OR_INVALID", `pair() uri#symKey`);
      event.setError(EVENT_CLIENT_PAIRING_ERRORS.malformed_pairing_uri);
      throw new Error(message);
    }
    if (uri?.expiryTimestamp) {
      const expiration = toMiliseconds(uri?.expiryTimestamp);
      if (expiration < Date.now()) {
        event.setError(EVENT_CLIENT_PAIRING_ERRORS.pairing_expired);
        const { message } = getInternalError(
          "EXPIRED",
          `pair() URI has expired. Please try again with a new connection URI.`,
        );
        throw new Error(message);
      }
    }
  };

  private isValidPing = async (params: { topic: string }) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `ping() params: ${params}`);
      throw new Error(message);
    }
    const { topic } = params;
    await this.isValidPairingTopic(topic);
  };

  private isValidDisconnect = async (params: { topic: string }) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `disconnect() params: ${params}`);
      throw new Error(message);
    }
    const { topic } = params;
    await this.isValidPairingTopic(topic);
  };

  private isValidPairingTopic = async (topic: any) => {
    if (!isValidString(topic, false)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `pairing topic should be a string: ${topic}`,
      );
      throw new Error(message);
    }
    if (!this.pairings.keys.includes(topic)) {
      const { message } = getInternalError(
        "NO_MATCHING_KEY",
        `pairing topic doesn't exist: ${topic}`,
      );
      throw new Error(message);
    }
    if (isExpired(this.pairings.get(topic).expiry)) {
      await this.deletePairing(topic);
      const { message } = getInternalError("EXPIRED", `pairing topic: ${topic}`);
      throw new Error(message);
    }
  };
}
