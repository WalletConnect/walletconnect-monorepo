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
import { FIVE_MINUTES, THIRTY_DAYS } from "@walletconnect/time";
import EventEmitter from "events";
import {
  PAIRING_CONTEXT,
  PAIRING_STORAGE_VERSION,
  CORE_STORAGE_PREFIX,
  RELAYER_DEFAULT_PROTOCOL,
  PAIRING_RPC_OPTS,
  RELAYER_EVENTS,
  EXPIRER_EVENTS,
} from "../constants";
import { Store } from "../controllers/store";

export class Pairing implements IPairing {
  public name = PAIRING_CONTEXT;
  public version = PAIRING_STORAGE_VERSION;

  public events = new EventEmitter();
  public pairings: IStore<string, PairingTypes.Struct>;

  private initialized = false;
  private storagePrefix = CORE_STORAGE_PREFIX;
  private ignoredPayloadTypes = [TYPE_1];
  private registeredMethods: string[] = [];

  constructor(public core: ICore, public logger: Logger) {
    this.core = core;
    this.logger = generateChildLogger(logger, this.name);
    this.pairings = new Store(this.core, this.logger, this.name, this.storagePrefix);
  }

  public init: IPairing["init"] = async () => {
    if (!this.initialized) {
      await this.pairings.init();
      await this.cleanup();
      this.registerRelayerEvents();
      this.registerExpirerEvents();
      this.initialized = true;
      this.logger.trace(`Initialized`);
    }
  };

  get context() {
    return getLoggerContext(this.logger);
  }

  public register: IPairing["register"] = ({ methods }) => {
    this.isInitialized();
    this.registeredMethods = [...new Set([...this.registeredMethods, ...methods])];
  };

  public create: IPairing["create"] = async () => {
    this.isInitialized();
    const symKey = generateRandomBytes32();
    const topic = await this.core.crypto.setSymKey(symKey);
    const expiry = calcExpiry(FIVE_MINUTES);
    const relay = { protocol: RELAYER_DEFAULT_PROTOCOL };
    const pairing = { topic, expiry, relay, active: false };
    const uri = formatUri({
      protocol: this.core.protocol,
      version: this.core.version,
      topic,
      symKey,
      relay,
    });
    await this.pairings.set(topic, pairing);
    await this.core.relayer.subscribe(topic);
    this.core.expirer.set(topic, expiry);

    return { topic, uri };
  };

  public pair: IPairing["pair"] = async (params) => {
    this.isInitialized();
    this.isValidPair(params);
    const { topic, symKey, relay } = parseUri(params.uri);

    if (this.pairings.keys.includes(topic)) {
      throw new Error(`Pairing already exists: ${topic}`);
    }

    if (this.core.crypto.hasKeys(topic)) {
      throw new Error(`Keychain already exists: ${topic}`);
    }

    const expiry = calcExpiry(FIVE_MINUTES);
    const pairing = { topic, relay, expiry, active: false };
    await this.pairings.set(topic, pairing);
    await this.core.crypto.setSymKey(symKey, topic);
    await this.core.relayer.subscribe(topic, { relay });
    this.core.expirer.set(topic, expiry);

    if (params.activatePairing) {
      await this.activate({ topic });
    }

    return pairing;
  };

  public activate: IPairing["activate"] = async ({ topic }) => {
    this.isInitialized();
    const expiry = calcExpiry(THIRTY_DAYS);
    await this.pairings.update(topic, { active: true, expiry });
    this.core.expirer.set(topic, expiry);
  };

  public ping: IPairing["ping"] = async (params) => {
    this.isInitialized();
    await this.isValidPing(params);
    const { topic } = params;
    if (this.pairings.keys.includes(topic)) {
      const id = await this.sendRequest(topic, "wc_pairingPing", {});
      const { done, resolve, reject } = createDelayedPromise<void>();
      this.events.once(engineEvent("pairing_ping", id), ({ error }) => {
        if (error) reject(error);
        else resolve();
      });
      await done();
    }
  };

  public updateExpiry: IPairing["updateExpiry"] = async ({ topic, expiry }) => {
    this.isInitialized();
    await this.pairings.update(topic, { expiry });
  };

  public updateMetadata: IPairing["updateMetadata"] = async ({ topic, metadata }) => {
    this.isInitialized();
    await this.pairings.update(topic, { peerMetadata: metadata });
  };

  public getPairings: IPairing["getPairings"] = () => {
    this.isInitialized();
    return this.pairings.values;
  };

  public disconnect: IPairing["disconnect"] = async (params) => {
    this.isInitialized();
    await this.isValidDisconnect(params);
    const { topic } = params;
    if (this.pairings.keys.includes(topic)) {
      await this.sendRequest(topic, "wc_pairingDelete", getSdkError("USER_DISCONNECTED"));
      await this.deletePairing(topic);
    }
  };

  // ---------- Private Helpers ----------------------------------------------- //

  private sendRequest: IPairingPrivate["sendRequest"] = async (topic, method, params) => {
    const payload = formatJsonRpcRequest(method, params);
    const message = await this.core.crypto.encode(topic, payload);
    const opts = PAIRING_RPC_OPTS[method].req;
    this.core.history.set(topic, payload);
    await this.core.relayer.publish(topic, message, opts);

    return payload.id;
  };

  private sendResult: IPairingPrivate["sendResult"] = async (id, topic, result) => {
    const payload = formatJsonRpcResult(id, result);
    const message = await this.core.crypto.encode(topic, payload);
    const record = await this.core.history.get(topic, id);
    const opts = PAIRING_RPC_OPTS[record.request.method].res;
    await this.core.relayer.publish(topic, message, opts);
    await this.core.history.resolve(payload);
  };

  private sendError: IPairingPrivate["sendError"] = async (id, topic, error) => {
    const payload = formatJsonRpcError(id, error);
    const message = await this.core.crypto.encode(topic, payload);
    const record = await this.core.history.get(topic, id);
    const opts = PAIRING_RPC_OPTS[record.request.method]
      ? PAIRING_RPC_OPTS[record.request.method].res
      : PAIRING_RPC_OPTS.unregistered_method.res;

    await this.core.relayer.publish(topic, message, opts);
    await this.core.history.resolve(payload);
  };

  private deletePairing: IPairingPrivate["deletePairing"] = async (topic, expirerHasDeleted) => {
    // Await the unsubscribe first to avoid deleting the symKey too early below.
    await this.core.relayer.unsubscribe(topic);
    await Promise.all([
      this.pairings.delete(topic, getSdkError("USER_DISCONNECTED")),
      this.core.crypto.deleteSymKey(topic),
      expirerHasDeleted ? Promise.resolve() : this.core.expirer.del(topic),
    ]);
  };

  private isInitialized() {
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
      const { topic, message } = event;

      // messages of certain types should be ignored as they are handled by their respective SDKs
      if (this.ignoredPayloadTypes.includes(this.core.crypto.getPayloadType(message))) {
        return;
      }

      const payload = await this.core.crypto.decode(topic, message);
      if (isJsonRpcRequest(payload)) {
        this.core.history.set(topic, payload);
        this.onRelayEventRequest({ topic, payload });
      } else if (isJsonRpcResponse(payload)) {
        await this.core.history.resolve(payload);
        this.onRelayEventResponse({ topic, payload });
      }
    });
  }

  private onRelayEventRequest: IPairingPrivate["onRelayEventRequest"] = (event) => {
    const { topic, payload } = event;
    const reqMethod = payload.method as PairingJsonRpcTypes.WcMethod;

    if (!this.pairings.keys.includes(topic)) return;

    switch (reqMethod) {
      case "wc_pairingPing":
        return this.onPairingPingRequest(topic, payload);
      case "wc_pairingDelete":
        return this.onPairingDeleteRequest(topic, payload);
      default:
        return this.onUnknownRpcMethodRequest(topic, payload);
    }
  };

  private onRelayEventResponse: IPairingPrivate["onRelayEventResponse"] = async (event) => {
    const { topic, payload } = event;
    const record = await this.core.history.get(topic, payload.id);
    const resMethod = record.request.method as PairingJsonRpcTypes.WcMethod;

    if (!this.pairings.keys.includes(topic)) return;

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
      this.events.emit("pairing_ping", { id, topic });
    } catch (err: any) {
      await this.sendError(id, topic, err);
      this.logger.error(err);
    }
  };

  private onPairingPingResponse: IPairingPrivate["onPairingPingResponse"] = (_topic, payload) => {
    const { id } = payload;
    // put at the end of the stack to avoid a race condition
    // where pairing_ping listener is not yet initialized
    setTimeout(() => {
      if (isJsonRpcResult(payload)) {
        this.events.emit(engineEvent("pairing_ping", id), {});
      } else if (isJsonRpcError(payload)) {
        this.events.emit(engineEvent("pairing_ping", id), { error: payload.error });
      }
    }, 500);
  };

  private onPairingDeleteRequest: IPairingPrivate["onPairingDeleteRequest"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    try {
      this.isValidDisconnect({ topic });
      await this.deletePairing(topic);
      this.events.emit("pairing_delete", { id, topic });
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
      if (topic) {
        if (this.pairings.keys.includes(topic)) {
          await this.deletePairing(topic, true);
          this.events.emit("pairing_expire", { topic });
        }
      }
    });
  }

  // ---------- Validation Helpers ----------------------------------- //

  private isValidPair = (params: { uri: string }) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `pair() params: ${params}`);
      throw new Error(message);
    }
    if (!isValidUrl(params.uri)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `pair() uri: ${params.uri}`);
      throw new Error(message);
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
