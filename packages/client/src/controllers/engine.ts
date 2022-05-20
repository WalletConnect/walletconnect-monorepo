import EventEmmiter from "events";
import { RELAYER_EVENTS, RELAYER_DEFAULT_PROTOCOL } from "@walletconnect/core";
import { EXPIRER_EVENTS, SESSION_EXPIRY, PROPOSAL_EXPIRY } from "../constants";
import {
  formatJsonRpcRequest,
  formatJsonRpcResult,
  formatJsonRpcError,
  isJsonRpcRequest,
  isJsonRpcResponse,
  isJsonRpcResult,
  isJsonRpcError,
} from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES } from "@walletconnect/time";
import {
  IEngine,
  IEngineEvents,
  RelayerTypes,
  EnginePrivate,
  SessionTypes,
  JsonRpcTypes,
  ExpirerTypes,
} from "@walletconnect/types";
import {
  calcExpiry,
  formatUri,
  generateRandomBytes32,
  parseUri,
  createDelayedPromise,
  ERROR,
  engineEvent,
  isValidNamespaces,
  isValidRelays,
  isValidUrl,
  isValidId,
  isValidParams,
  isValidString,
  isValidErrorReason,
  isValidNamespacesChainId,
  isValidNamespacesRequest,
  isValidNamespacesEvent,
  isValidRequest,
  isValidEvent,
  isValidResponse,
  isValidRequiredNamespaces,
  isSessionCompatible,
} from "@walletconnect/utils";
import { JsonRpcResponse } from "@walletconnect/jsonrpc-types";

export class Engine extends IEngine {
  private events: IEngineEvents = new EventEmmiter();

  constructor(client: IEngine["client"]) {
    super(client);
    this.registerRelayerEvents();
    this.registerExpirerEvents();
  }

  // ---------- Public ------------------------------------------------ //

  public connect: IEngine["connect"] = async params => {
    this.isValidConnect(params);
    const { pairingTopic, requiredNamespaces, relays } = params;
    let topic = pairingTopic;
    let uri: string | undefined = undefined;
    let active = false;

    if (topic) {
      const pairing = this.client.pairing.get(topic);
      active = pairing.active;
    }

    if (!topic || !active) {
      const { topic: newTopic, uri: newUri } = await this.createPairing();
      topic = newTopic;
      uri = newUri;
    }

    const publicKey = await this.client.core.crypto.generateKeyPair();
    const proposal = {
      requiredNamespaces,
      relays: relays ?? [{ protocol: RELAYER_DEFAULT_PROTOCOL }],
      proposer: {
        publicKey,
        metadata: this.client.metadata,
      },
    };

    const { reject, resolve, done: approval } = createDelayedPromise<SessionTypes.Struct>();
    this.events.once<"session_connect">(engineEvent("session_connect"), async ({ error, data }) => {
      if (error) reject(error);
      else if (data) {
        data.self.publicKey = publicKey;
        await this.client.session.set(data.topic, data);
        await this.setExpiry(data.topic, data.expiry);
        resolve(data);
      }
    });

    if (!topic) throw new Error(ERROR.MISSING_OR_INVALID.stringify({ name: "topic" }));

    const id = await this.sendRequest(topic, "wc_sessionPropose", proposal);
    await this.client.proposal.set(id, { id, ...proposal });

    return { uri, approval };
  };

  public pair: IEngine["pair"] = async params => {
    this.isValidPair(params);
    const { topic, symKey, relay } = parseUri(params.uri);
    const expiry = calcExpiry(FIVE_MINUTES);
    const pairing = { topic, relay, expiry, active: false };
    await this.client.pairing.set(topic, pairing);
    await this.client.core.crypto.setSymKey(symKey, topic);
    await this.client.core.relayer.subscribe(topic, { relay });
    await this.setExpiry(topic, expiry);

    return pairing;
  };

  public approve: IEngine["approve"] = async params => {
    this.isValidApprove(params);
    const { id, relayProtocol, namespaces } = params;
    const { pairingTopic, proposer } = this.client.proposal.get(id);

    const selfPublicKey = await this.client.core.crypto.generateKeyPair();
    const peerPublicKey = proposer.publicKey;
    const sessionTopic = await this.client.core.crypto.generateSharedKey(
      selfPublicKey,
      peerPublicKey,
    );
    const sessionSettle = {
      relay: {
        protocol: relayProtocol ?? "waku",
      },
      namespaces,
      controller: {
        publicKey: selfPublicKey,
        metadata: this.client.metadata,
      },
      expiry: SESSION_EXPIRY,
    };

    await this.client.core.relayer.subscribe(sessionTopic);
    const requestId = await this.sendRequest(sessionTopic, "wc_sessionSettle", sessionSettle);
    const { done: acknowledged, resolve, reject } = createDelayedPromise<SessionTypes.Struct>();
    this.events.once(engineEvent("session_approve", requestId), ({ error }) => {
      if (error) reject(error);
      else resolve(this.client.session.get(sessionTopic));
    });

    const session = {
      ...sessionSettle,
      topic: sessionTopic,
      acknowledged: false,
      self: sessionSettle.controller,
      peer: {
        publicKey: proposer.publicKey,
        metadata: proposer.metadata,
      },
      controller: selfPublicKey,
    };
    await this.client.session.set(sessionTopic, session);
    await this.setExpiry(sessionTopic, SESSION_EXPIRY);

    if (pairingTopic && id) {
      await this.sendResult<"wc_sessionPropose">(id, pairingTopic, {
        relay: {
          protocol: relayProtocol ?? "waku",
        },
        responderPublicKey: selfPublicKey,
      });
      await this.client.proposal.delete(id, ERROR.DELETED.format());
      await this.activatePairing(pairingTopic);
    }

    return { topic: sessionTopic, acknowledged };
  };

  public reject: IEngine["reject"] = async params => {
    this.isValidReject(params);
    const { id, reason } = params;
    const { pairingTopic } = this.client.proposal.get(id);
    if (pairingTopic) {
      await this.sendError(id, pairingTopic, reason);
      await this.client.proposal.delete(id, ERROR.DELETED.format());
    }
  };

  public update: IEngine["update"] = async params => {
    this.isValidUpdate(params);
    const { topic, namespaces } = params;
    const id = await this.sendRequest(topic, "wc_sessionUpdate", { namespaces });
    const { done, resolve, reject } = createDelayedPromise<void>();
    this.events.once(engineEvent("session_update", id), ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await done();
    await this.client.session.update(topic, { namespaces });
  };

  public extend: IEngine["extend"] = async params => {
    this.isValidExtend(params);
    const { topic } = params;
    const id = await this.sendRequest(topic, "wc_sessionExtend", {});
    const { done, resolve, reject } = createDelayedPromise<void>();
    this.events.once(engineEvent("session_extend", id), ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await done();
    await this.setExpiry(topic, SESSION_EXPIRY);
  };

  public request: IEngine["request"] = async params => {
    this.isValidRequest(params);
    const { chainId, request, topic } = params;
    const id = await this.sendRequest(topic, "wc_sessionRequest", { request, chainId });
    const { done, resolve, reject } = createDelayedPromise<JsonRpcResponse>();
    this.events.once<"request">(engineEvent("request", id), ({ error, data }) => {
      if (error) reject(error);
      else if (data) resolve(data);
    });
    return await done();
  };

  public respond: IEngine["respond"] = async params => {
    this.isValidRespond(params);
    const { topic, response } = params;
    const { id } = response;
    if (isJsonRpcResult(response)) {
      await this.sendResult(id, topic, response.result);
    } else if (isJsonRpcError(response)) {
      await this.sendError(id, topic, response.error);
    }
  };

  public ping: IEngine["ping"] = async params => {
    this.isValidPing(params);
    const { topic } = params;
    if (this.client.session.keys.includes(topic)) {
      const id = await this.sendRequest(topic, "wc_sessionPing", {});
      const { done, resolve, reject } = createDelayedPromise<void>();
      this.events.once(engineEvent("session_ping", id), ({ error }) => {
        if (error) reject(error);
        else resolve();
      });
      await done();
    } else if (this.client.pairing.keys.includes(topic)) {
      const id = await this.sendRequest(topic, "wc_pairingPing", {});
      const { done, resolve, reject } = createDelayedPromise<void>();
      this.events.once(engineEvent("pairing_ping", id), ({ error }) => {
        if (error) reject(error);
        else resolve();
      });
      await done();
    }
  };

  public emit: IEngine["emit"] = async params => {
    this.isValidEmit(params);
    const { topic, event, chainId } = params;
    await this.sendRequest(topic, "wc_sessionEvent", { event, chainId });
  };

  public disconnect: IEngine["disconnect"] = async params => {
    this.isValidDisconnect(params);
    const { topic } = params;
    if (this.client.session.keys.includes(topic)) {
      const id = await this.sendRequest(topic, "wc_sessionDelete", ERROR.DELETED.format());
      const { done, resolve, reject } = createDelayedPromise<void>();
      this.events.once(engineEvent("session_delete", id), ({ error }) => {
        if (error) reject(error);
        else resolve();
      });
      await done();
    } else if (this.client.pairing.keys.includes(topic)) {
      const id = await this.sendRequest(topic, "wc_pairingDelete", ERROR.DELETED.format());
      const { done, resolve, reject } = createDelayedPromise<void>();
      this.events.once(engineEvent("pairing_delete", id), ({ error }) => {
        if (error) reject(error);
        else resolve();
      });
      await done();
    }
  };

  public find: IEngine["find"] = params => {
    return this.client.session.values.filter(session => isSessionCompatible(session, params));
  };

  // ---------- Private Helpers --------------------------------------- //

  private async createPairing() {
    const symKey = generateRandomBytes32();
    const topic = await this.client.core.crypto.setSymKey(symKey);
    const expiry = calcExpiry(FIVE_MINUTES);
    const relay = { protocol: RELAYER_DEFAULT_PROTOCOL };
    const pairing = { topic, expiry, relay, active: false };
    const uri = formatUri({
      protocol: this.client.protocol,
      version: this.client.version,
      topic,
      symKey,
      relay,
    });
    await this.client.pairing.set(topic, pairing);
    await this.client.core.relayer.subscribe(topic);
    await this.setExpiry(topic, expiry);

    return { topic, uri };
  }

  private activatePairing: EnginePrivate["activatePairing"] = async topic => {
    await this.client.pairing.update(topic, { active: true, expiry: PROPOSAL_EXPIRY });
    await this.setExpiry(topic, PROPOSAL_EXPIRY);
  };

  private deleteSession: EnginePrivate["deleteSession"] = async topic => {
    const { self } = this.client.session.get(topic);
    await Promise.all([
      this.client.core.relayer.unsubscribe(topic),
      this.client.session.delete(topic, ERROR.DELETED.format()),
      this.client.core.crypto.deleteKeyPair(self.publicKey),
      this.client.core.crypto.deleteSymKey(topic),
      this.client.expirer.del(topic),
    ]);
  };

  private deletePairing: EnginePrivate["deleteSession"] = async topic => {
    await Promise.all([
      this.client.core.relayer.unsubscribe(topic),
      this.client.pairing.delete(topic, ERROR.DELETED.format()),
      this.client.core.crypto.deleteSymKey(topic),
      this.client.expirer.del(topic),
    ]);
  };

  private setExpiry: EnginePrivate["setExpiry"] = async (topic, expiry) => {
    if (this.client.pairing.keys.includes(topic)) {
      await this.client.pairing.update(topic, { expiry });
    } else if (this.client.session.keys.includes(topic)) {
      await this.client.session.update(topic, { expiry });
    }
    this.client.expirer.set(topic, { topic, expiry });
  };

  private sendRequest: EnginePrivate["sendRequest"] = async (topic, method, params) => {
    const payload = formatJsonRpcRequest(method, params);
    const message = this.client.core.crypto.encode(topic, payload);
    await this.client.core.relayer.publish(topic, message);
    this.client.history.set(topic, payload);

    return payload.id;
  };

  private sendResult: EnginePrivate["sendResult"] = async (id, topic, result) => {
    const payload = formatJsonRpcResult(id, result);
    const message = this.client.core.crypto.encode(topic, payload);
    await this.client.core.relayer.publish(topic, message);
    await this.client.history.resolve(payload);
  };

  private sendError: EnginePrivate["sendError"] = async (id, topic, error) => {
    const payload = formatJsonRpcError(id, error);
    const message = this.client.core.crypto.encode(topic, payload);
    await this.client.core.relayer.publish(topic, message);
    await this.client.history.resolve(payload);
  };

  // ---------- Relay Events Router ----------------------------------- //

  private registerRelayerEvents() {
    this.client.core.relayer.on(
      RELAYER_EVENTS.message,
      async (event: RelayerTypes.MessageEvent) => {
        const { topic, message } = event;
        const payload = this.client.core.crypto.decode(topic, message);
        if (isJsonRpcRequest(payload)) {
          this.client.history.set(topic, payload);
          this.onRelayEventRequest({ topic, payload });
        } else if (isJsonRpcResponse(payload)) {
          await this.client.history.resolve(payload);
          this.onRelayEventResponse({ topic, payload });
        }
      },
    );
  }

  private onRelayEventRequest: EnginePrivate["onRelayEventRequest"] = event => {
    const { topic, payload } = event;
    const reqMethod = payload.method as JsonRpcTypes.WcMethod;

    switch (reqMethod) {
      case "wc_sessionPropose":
        return this.onSessionProposeRequest(topic, payload);
      case "wc_sessionSettle":
        return this.onSessionSettleRequest(topic, payload);
      case "wc_sessionUpdate":
        return this.onSessionUpdateRequest(topic, payload);
      case "wc_sessionExtend":
        return this.onSessionExtendRequest(topic, payload);
      case "wc_sessionPing":
        return this.onSessionPingRequest(topic, payload);
      case "wc_pairingPing":
        return this.onPairingPingRequest(topic, payload);
      case "wc_sessionDelete":
        return this.onSessionDeleteRequest(topic, payload);
      case "wc_pairingDelete":
        return this.onPairingDeleteRequest(topic, payload);
      case "wc_sessionRequest":
        return this.onSessionRequest(topic, payload);
      case "wc_sessionEvent":
        return this.onSessionEventRequest(topic, payload);
      default:
        // TODO(ilja) throw / log unsuported event?
        return;
    }
  };

  private onRelayEventResponse: EnginePrivate["onRelayEventResponse"] = async event => {
    const { topic, payload } = event;
    const record = await this.client.history.get(topic, payload.id);
    const resMethod = record.request.method as JsonRpcTypes.WcMethod;

    switch (resMethod) {
      case "wc_sessionPropose":
        return this.onSessionProposeResponse(topic, payload);
      case "wc_sessionSettle":
        return this.onSessionSettleResponse(topic, payload);
      case "wc_sessionUpdate":
        return this.onSessionUpdateResponse(topic, payload);
      case "wc_sessionExtend":
        return this.onSessionExtendResponse(topic, payload);
      case "wc_sessionPing":
        return this.onSessionPingResponse(topic, payload);
      case "wc_pairingPing":
        return this.onPairingPingResponse(topic, payload);
      case "wc_sessionDelete":
        return this.onSessionDeleteResponse(topic, payload);
      case "wc_pairingDelete":
        return this.onPairingDeleteResponse(topic, payload);
      case "wc_sessionRequest":
        return this.onSessionRequestResponse(topic, payload);
      default:
        // TODO(ilja) throw / log unsuported event?
        return;
    }
  };

  // ---------- Relay Events Handlers ---------------------------------- //

  private onSessionProposeRequest: EnginePrivate["onSessionProposeRequest"] = async (
    topic,
    payload,
  ) => {
    try {
      this.isValidConnect({ ...payload.params });
      const { params, id } = payload;
      const proposal = { id, pairingTopic: topic, ...params };
      await this.client.proposal.set(id, proposal);
      this.client.events.emit("session_proposal", { id, params: proposal });
    } catch (err) {
      this.client.logger.error(err);
    }
  };

  private onSessionProposeResponse: EnginePrivate["onSessionProposeResponse"] = async (
    topic,
    payload,
  ) => {
    const { id: id } = payload;
    if (isJsonRpcResult(payload)) {
      const { result } = payload;
      this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", result });
      const proposal = this.client.proposal.get(id);
      this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", proposal });
      const selfPublicKey = proposal.proposer.publicKey;
      this.client.logger.trace({
        type: "method",
        method: "onSessionProposeResponse",
        selfPublicKey,
      });
      const peerPublicKey = result.responderPublicKey;
      this.client.logger.trace({
        type: "method",
        method: "onSessionProposeResponse",
        peerPublicKey,
      });
      const sessionTopic = await this.client.core.crypto.generateSharedKey(
        selfPublicKey,
        peerPublicKey,
      );
      this.client.logger.trace({
        type: "method",
        method: "onSessionProposeResponse",
        sessionTopic,
      });
      const subscriptionId = await this.client.core.relayer.subscribe(sessionTopic);
      this.client.logger.trace({
        type: "method",
        method: "onSessionProposeResponse",
        subscriptionId,
      });
      await this.activatePairing(topic);
    } else if (isJsonRpcError(payload)) {
      await this.client.proposal.delete(id, ERROR.DELETED.format());
      this.events.emit(engineEvent("session_connect"), { error: payload.error });
    }
  };

  private onSessionSettleRequest: EnginePrivate["onSessionSettleRequest"] = async (
    topic,
    payload,
  ) => {
    try {
      this.isValidApprove({ id: payload.id, ...payload.params });
      const { relay, controller, expiry, namespaces } = payload.params;
      const session = {
        topic,
        relay,
        expiry,
        namespaces,
        acknowledged: true,
        controller: controller.publicKey,
        self: {
          publicKey: "",
          metadata: this.client.metadata,
        },
        peer: {
          publicKey: controller.publicKey,
          metadata: controller.metadata,
        },
      };
      await this.sendResult<"wc_sessionSettle">(payload.id, topic, true);
      this.events.emit(engineEvent("session_connect"), { data: session });
    } catch (err) {
      this.client.logger.error(err);
    }
  };

  private onSessionSettleResponse: EnginePrivate["onSessionSettleResponse"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      await this.client.session.update(topic, { acknowledged: true });
      this.events.emit(engineEvent("session_approve", id), {});
    } else if (isJsonRpcError(payload)) {
      await this.client.session.delete(topic, ERROR.DELETED.format());
      this.events.emit(engineEvent("session_approve", id), { error: payload.error });
    }
  };

  private onSessionUpdateRequest: EnginePrivate["onSessionUpdateRequest"] = async (
    topic,
    payload,
  ) => {
    try {
      this.isValidUpdate({ topic, ...payload.params });
      const { params, id } = payload;
      await this.client.session.update(topic, { namespaces: params.namespaces });
      await this.sendResult<"wc_sessionUpdate">(id, topic, true);
      this.client.events.emit("session_update", { id, topic, params });
    } catch (err) {
      this.client.logger.error(err);
    }
  };

  private onSessionUpdateResponse: EnginePrivate["onSessionUpdateResponse"] = (_topic, payload) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("session_update", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("session_update", id), { error: payload.error });
    }
  };

  private onSessionExtendRequest: EnginePrivate["onSessionExtendRequest"] = async (
    topic,
    payload,
  ) => {
    try {
      this.isValidExtend({ topic });
      const { id } = payload;
      await this.setExpiry(topic, SESSION_EXPIRY);
      await this.sendResult<"wc_sessionExtend">(id, topic, true);
      this.client.events.emit("session_extend", { id, topic });
    } catch (err) {
      this.client.logger.error(err);
    }
  };

  private onSessionExtendResponse: EnginePrivate["onSessionExtendResponse"] = (_topic, payload) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("session_extend", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("session_extend", id), { error: payload.error });
    }
  };

  private onSessionPingRequest: EnginePrivate["onSessionPingRequest"] = async (topic, payload) => {
    try {
      this.isValidPing({ topic });
      const { id } = payload;
      await this.sendResult<"wc_sessionPing">(id, topic, true);
      this.client.events.emit("session_ping", { id, topic });
    } catch (err) {
      this.client.logger.error(err);
    }
  };

  private onSessionPingResponse: EnginePrivate["onSessionPingResponse"] = (_topic, payload) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("session_ping", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("session_ping", id), { error: payload.error });
    }
  };

  private onPairingPingRequest: EnginePrivate["onPairingPingRequest"] = async (topic, payload) => {
    try {
      this.isValidPing({ topic });
      const { id } = payload;
      await this.sendResult<"wc_pairingPing">(id, topic, true);
      this.client.events.emit("pairing_ping", { id, topic });
    } catch (err) {
      this.client.logger.error(err);
    }
  };

  private onPairingPingResponse: EnginePrivate["onPairingPingResponse"] = (_topic, payload) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("pairing_ping", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("pairing_ping", id), { error: payload.error });
    }
  };

  private onSessionDeleteRequest: EnginePrivate["onSessionDeleteRequest"] = async (
    topic,
    payload,
  ) => {
    try {
      this.isValidDisconnect({ topic, reason: payload.params });
      const { id } = payload;
      await this.sendResult<"wc_sessionDelete">(id, topic, true);
      await this.deleteSession(topic);
      this.client.events.emit("session_delete", { id, topic });
    } catch (err) {
      this.client.logger.error(err);
    }
  };

  private onSessionDeleteResponse: EnginePrivate["onSessionDeleteResponse"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      await this.deleteSession(topic);
      this.events.emit(engineEvent("session_delete", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("session_delete", id), { error: payload.error });
    }
  };

  private onPairingDeleteRequest: EnginePrivate["onPairingDeleteRequest"] = async (
    topic,
    payload,
  ) => {
    try {
      this.isValidDisconnect({ topic, reason: payload.params });
      const { id } = payload;
      await this.sendResult<"wc_pairingDelete">(id, topic, true);
      await this.deletePairing(topic);
      this.client.events.emit("pairing_delete", { id, topic });
    } catch (err) {
      this.client.logger.error(err);
    }
  };

  private onPairingDeleteResponse: EnginePrivate["onPairingDeleteResponse"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      await this.deletePairing(topic);
      this.events.emit(engineEvent("pairing_delete", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("pairing_delete", id), { error: payload.error });
    }
  };

  private onSessionRequest: EnginePrivate["onSessionRequest"] = (topic, payload) => {
    try {
      const { id, params } = payload;
      this.isValidRequest({ topic, ...params });
      this.client.events.emit("request", { id, topic, params });
    } catch (err) {
      this.client.logger.error(err);
    }
  };

  private onSessionRequestResponse: EnginePrivate["onSessionRequestResponse"] = (
    _topic,
    payload,
  ) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("request", id), { data: payload.result });
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("request", id), { error: payload.error });
    }
  };

  private onSessionEventRequest: EnginePrivate["onSessionEventRequest"] = (topic, payload) => {
    try {
      const { id, params } = payload;
      this.isValidEmit({ topic, ...params });
      this.client.events.emit("event", { id, topic, params });
    } catch (err) {
      this.client.logger.error(err);
    }
  };

  // ---------- Expirer Events ----------------------------------------- //

  private registerExpirerEvents() {
    this.client.expirer.on(EXPIRER_EVENTS.expired, async (event: ExpirerTypes.Expiration) => {
      const { topic } = event;
      if (this.client.session.keys.includes(topic)) {
        await this.deleteSession(topic);
        this.client.events.emit("session_expire", { topic });
      } else if (this.client.pairing.keys.includes(topic)) {
        await this.deletePairing(topic);
        this.client.events.emit("pairing_expire", { topic });
      }
    });
  }

  // ---------- Validation ---------------------------------------------- //
  private isValidConnect: EnginePrivate["isValidConnect"] = params => {
    if (!isValidParams(params)) throw ERROR.MISSING_OR_INVALID.format({ name: "connect params" });
    const { pairingTopic, requiredNamespaces, relays } = params;
    if (!isValidString(pairingTopic, true))
      throw ERROR.MISSING_OR_INVALID.format({ name: "connect pairingTopic" });
    if (pairingTopic && !this.client.pairing.keys.includes(pairingTopic))
      throw ERROR.NO_MATCHING_TOPIC.format({ context: "pairing", topic: pairingTopic });
    if (!isValidRequiredNamespaces(requiredNamespaces, false))
      throw ERROR.MISSING_OR_INVALID.format({ name: "connect requiredNamespaces" });
    if (!isValidRelays(relays, true))
      throw ERROR.MISSING_OR_INVALID.format({ name: "connect relays" });
  };

  private isValidPair: EnginePrivate["isValidPair"] = params => {
    if (!isValidParams(params)) throw ERROR.MISSING_OR_INVALID.format({ name: "pair params" });
    if (!isValidUrl(params.uri)) throw ERROR.MISSING_OR_INVALID.format({ name: "pair uri" });
  };

  private isValidApprove: EnginePrivate["isValidApprove"] = params => {
    if (!isValidParams(params)) throw ERROR.MISSING_OR_INVALID.format({ name: "approve params" });
    const { id, namespaces, relayProtocol } = params;
    if (!isValidId(id)) throw ERROR.MISSING_OR_INVALID.format({ name: "approve id" });
    if (!isValidNamespaces(namespaces, false))
      throw ERROR.MISSING_OR_INVALID.format({ name: "approve namespaces" });
    if (!isValidString(relayProtocol, true))
      throw ERROR.MISSING_OR_INVALID.format({ name: "approve relayProtocol" });
  };

  private isValidReject: EnginePrivate["isValidReject"] = params => {
    if (!isValidParams(params)) throw ERROR.MISSING_OR_INVALID.format({ name: "reject params" });
    const { id, reason } = params;
    if (!isValidId(id)) throw ERROR.MISSING_OR_INVALID.format({ name: "reject id" });
    if (!isValidErrorReason(reason))
      throw ERROR.MISSING_OR_INVALID.format({ name: "reject reason" });
  };

  private isValidUpdate: EnginePrivate["isValidUpdate"] = params => {
    if (!isValidParams(params)) throw ERROR.MISSING_OR_INVALID.format({ name: "update params" });
    const { topic, namespaces } = params;
    if (!isValidString(topic, false))
      throw ERROR.MISSING_OR_INVALID.format({ name: "update topic" });
    if (!this.client.session.keys.includes(topic))
      throw ERROR.NO_MATCHING_TOPIC.format({ context: "session", topic });
    if (!isValidNamespaces(namespaces, false))
      throw ERROR.MISSING_OR_INVALID.format({ name: "update namespaces" });
  };

  private isValidExtend: EnginePrivate["isValidExtend"] = params => {
    if (!isValidParams(params)) throw ERROR.MISSING_OR_INVALID.format({ name: "extend params" });
    const { topic } = params;
    if (!isValidString(topic, false))
      throw ERROR.MISSING_OR_INVALID.format({ name: "extend topic" });
    if (!this.client.session.keys.includes(topic))
      throw ERROR.NO_MATCHING_TOPIC.format({ context: "session", topic });
  };

  private isValidRequest: EnginePrivate["isValidRequest"] = params => {
    if (!isValidParams(params)) throw ERROR.MISSING_OR_INVALID.format({ name: "request params" });
    const { topic, request, chainId } = params;
    if (!isValidString(topic, false))
      throw ERROR.MISSING_OR_INVALID.format({ name: "request topic" });
    if (!this.client.session.keys.includes(topic))
      throw ERROR.NO_MATCHING_TOPIC.format({ context: "session", topic });
    const { namespaces } = this.client.session.get(topic);
    if (!isValidNamespacesChainId(namespaces, chainId))
      throw ERROR.MISSING_OR_INVALID.format({ name: "request chainId" });
    if (!isValidRequest(request)) throw ERROR.MISSING_OR_INVALID.format({ name: "request method" });
    if (!isValidNamespacesRequest(namespaces, chainId, request.method))
      throw ERROR.MISSING_OR_INVALID.format({ name: "request method" });
  };

  private isValidRespond: EnginePrivate["isValidRespond"] = params => {
    if (!isValidParams(params)) throw ERROR.MISSING_OR_INVALID.format({ name: "respond params" });
    const { topic, response } = params;
    if (!isValidString(topic, false))
      throw ERROR.MISSING_OR_INVALID.format({ name: "respond topic" });
    if (!this.client.session.keys.includes(topic))
      throw ERROR.NO_MATCHING_TOPIC.format({ context: "session", topic });
    if (!isValidResponse(response))
      throw ERROR.MISSING_OR_INVALID.format({ name: "respond response" });
  };

  private isValidPing: EnginePrivate["isValidPing"] = params => {
    if (!isValidParams(params)) throw ERROR.MISSING_OR_INVALID.format({ name: "ping params" });
    const { topic } = params;
    if (!isValidString(topic, false)) throw ERROR.MISSING_OR_INVALID.format({ name: "ping topic" });
    if (!this.client.session.keys.includes(topic) && !this.client.pairing.keys.includes(topic))
      throw ERROR.NO_MATCHING_TOPIC.format({ context: "pairing or session", topic });
  };

  private isValidEmit: EnginePrivate["isValidEmit"] = params => {
    if (!isValidParams(params)) throw ERROR.MISSING_OR_INVALID.format({ name: "emit params" });
    const { topic, event, chainId } = params;
    if (!isValidString(topic, false)) throw ERROR.MISSING_OR_INVALID.format({ name: "emit topic" });
    if (!this.client.session.keys.includes(topic))
      throw ERROR.NO_MATCHING_TOPIC.format({ context: "session", topic });
    const { namespaces } = this.client.session.get(topic);
    if (!isValidNamespacesChainId(namespaces, chainId))
      throw ERROR.MISSING_OR_INVALID.format({ name: "emit chainId" });
    if (!isValidEvent(event)) throw ERROR.MISSING_OR_INVALID.format({ name: "emit event" });
    if (!isValidNamespacesEvent(namespaces, chainId, event.name))
      throw ERROR.MISSING_OR_INVALID.format({ name: "emit event" });
  };

  private isValidDisconnect: EnginePrivate["isValidDisconnect"] = params => {
    if (!isValidParams(params))
      throw ERROR.MISSING_OR_INVALID.format({ name: "disconnect params" });
    const { topic } = params;
    if (!isValidString(topic, false))
      throw ERROR.MISSING_OR_INVALID.format({ name: "disconnect topic" });
    if (!this.client.session.keys.includes(topic) && !this.client.pairing.keys.includes(topic))
      throw ERROR.NO_MATCHING_TOPIC.format({ context: "pairing or session", topic });
  };
}
