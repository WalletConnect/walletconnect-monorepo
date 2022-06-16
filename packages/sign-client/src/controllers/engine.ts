import EventEmmiter from "events";
import { RELAYER_EVENTS, RELAYER_DEFAULT_PROTOCOL } from "@walletconnect/core";
import { EXPIRER_EVENTS, SESSION_EXPIRY, PROPOSAL_EXPIRY, ENGINE_CONTEXT } from "../constants";
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
  EngineTypes,
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
  parseExpirerTarget,
  createDelayedPromise,
  getInternalError,
  getSdkError,
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
  isExpired,
  isUndefined,
  isValidNamespacesChange,
} from "@walletconnect/utils";

export class Engine extends IEngine {
  private events: IEngineEvents = new EventEmmiter();
  private initialized = false;
  public name = ENGINE_CONTEXT;

  constructor(client: IEngine["client"]) {
    super(client);
  }

  public init: IEngine["init"] = async () => {
    if (!this.initialized) {
      await this.cleanup();
      this.registerRelayerEvents();
      this.registerExpirerEvents();
      this.initialized = true;
    }
  };

  // ---------- Public ------------------------------------------------ //

  public connect: IEngine["connect"] = async params => {
    this.isInitialized();
    await this.isValidConnect(params);
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
    this.events.once<"session_connect">(
      engineEvent("session_connect"),
      async ({ error, session }) => {
        if (error) reject(error);
        else if (session) {
          session.self.publicKey = publicKey;
          const completeSession = { ...session, requiredNamespaces };
          await this.client.session.set(session.topic, completeSession);
          await this.setExpiry(session.topic, session.expiry);
          if (topic)
            await this.client.pairing.update(topic, { peerMetadata: session.peer.metadata });
          resolve(completeSession);
        }
      },
    );

    if (!topic) {
      throw getInternalError("NO_MATCHING_KEY", `${this.name}, ${topic}`);
    }

    const id = await this.sendRequest(topic, "wc_sessionPropose", proposal);
    const expiry = calcExpiry(FIVE_MINUTES);
    await this.setProposal(id, { id, expiry, ...proposal });

    return { uri, approval };
  };

  public pair: IEngine["pair"] = async params => {
    this.isInitialized();
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
    this.isInitialized();
    this.isValidApprove(params);
    const { id, relayProtocol, namespaces } = params;
    const { pairingTopic, proposer, requiredNamespaces } = this.client.proposal.get(id);

    const selfPublicKey = await this.client.core.crypto.generateKeyPair();
    const peerPublicKey = proposer.publicKey;
    const sessionTopic = await this.client.core.crypto.generateSharedKey(
      selfPublicKey,
      peerPublicKey,
    );
    const sessionSettle = {
      relay: { protocol: relayProtocol ?? "waku" },
      namespaces,
      requiredNamespaces,
      controller: { publicKey: selfPublicKey, metadata: this.client.metadata },
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
    if (pairingTopic)
      await this.client.pairing.update(pairingTopic, { peerMetadata: session.peer.metadata });

    if (pairingTopic && id) {
      await this.sendResult<"wc_sessionPropose">(id, pairingTopic, {
        relay: {
          protocol: relayProtocol ?? "waku",
        },
        responderPublicKey: selfPublicKey,
      });
      await this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED"));
      await this.activatePairing(pairingTopic);
    }

    return { topic: sessionTopic, acknowledged };
  };

  public reject: IEngine["reject"] = async params => {
    this.isInitialized();
    this.isValidReject(params);
    const { id, reason } = params;
    const { pairingTopic } = this.client.proposal.get(id);
    if (pairingTopic) {
      await this.sendError(id, pairingTopic, reason);
      await this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED"));
    }
  };

  public update: IEngine["update"] = async params => {
    this.isInitialized();
    await this.isValidUpdate(params);
    const { topic, namespaces } = params;
    const id = await this.sendRequest(topic, "wc_sessionUpdate", { namespaces });
    const { done: acknowledged, resolve, reject } = createDelayedPromise<void>();
    this.events.once(engineEvent("session_update", id), ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await this.client.session.update(topic, { namespaces });

    return { acknowledged };
  };

  public extend: IEngine["extend"] = async params => {
    this.isInitialized();
    await this.isValidExtend(params);
    const { topic } = params;
    const id = await this.sendRequest(topic, "wc_sessionExtend", {});
    const { done: acknowledged, resolve, reject } = createDelayedPromise<void>();
    this.events.once(engineEvent("session_extend", id), ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await this.setExpiry(topic, SESSION_EXPIRY);

    return { acknowledged };
  };

  public request: IEngine["request"] = async <T>(params: EngineTypes.RequestParams) => {
    this.isInitialized();
    await this.isValidRequest(params);
    const { chainId, request, topic } = params;
    const id = await this.sendRequest(topic, "wc_sessionRequest", { request, chainId });
    const { done, resolve, reject } = createDelayedPromise<T>();
    this.events.once<"session_request">(engineEvent("session_request", id), ({ error, result }) => {
      if (error) reject(error);
      else resolve(result);
    });
    return await done();
  };

  public respond: IEngine["respond"] = async params => {
    this.isInitialized();
    await this.isValidRespond(params);
    const { topic, response } = params;
    const { id } = response;
    if (isJsonRpcResult(response)) {
      await this.sendResult(id, topic, response.result);
    } else if (isJsonRpcError(response)) {
      await this.sendError(id, topic, response.error);
    }
  };

  public ping: IEngine["ping"] = async params => {
    this.isInitialized();
    await this.isValidPing(params);
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
    this.isInitialized();
    await this.isValidEmit(params);
    const { topic, event, chainId } = params;
    await this.sendRequest(topic, "wc_sessionEvent", { event, chainId });
  };

  public disconnect: IEngine["disconnect"] = async params => {
    this.isInitialized();
    await this.isValidDisconnect(params);
    const { topic } = params;
    if (this.client.session.keys.includes(topic)) {
      await this.sendRequest(topic, "wc_sessionDelete", getSdkError("USER_DISCONNECTED"));
      await this.deleteSession(topic);
    } else if (this.client.pairing.keys.includes(topic)) {
      await this.sendRequest(topic, "wc_pairingDelete", getSdkError("USER_DISCONNECTED"));
      await this.deletePairing(topic);
    }
  };

  public find: IEngine["find"] = params => {
    this.isInitialized();
    return this.client.session.getAll().filter(session => isSessionCompatible(session, params));
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
      this.client.session.delete(topic, getSdkError("USER_DISCONNECTED")),
      this.client.core.crypto.deleteKeyPair(self.publicKey),
      this.client.core.crypto.deleteSymKey(topic),
      this.client.expirer.del(topic),
    ]);
  };

  private deletePairing: EnginePrivate["deleteSession"] = async topic => {
    await Promise.all([
      this.client.core.relayer.unsubscribe(topic),
      this.client.pairing.delete(topic, getSdkError("USER_DISCONNECTED")),
      this.client.core.crypto.deleteSymKey(topic),
      this.client.expirer.del(topic),
    ]);
  };

  private deleteProposal: EnginePrivate["deleteProposal"] = async id => {
    await Promise.all([
      this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED")),
      this.client.expirer.del(id),
    ]);
  };

  private setExpiry: EnginePrivate["setExpiry"] = async (topic, expiry) => {
    if (this.client.pairing.keys.includes(topic)) {
      await this.client.pairing.update(topic, { expiry });
    } else if (this.client.session.keys.includes(topic)) {
      await this.client.session.update(topic, { expiry });
    }
    this.client.expirer.set(topic, expiry);
  };

  private setProposal: EnginePrivate["setProposal"] = async (id, proposal) => {
    await this.client.proposal.set(id, proposal);
    this.client.expirer.set(id, proposal.expiry);
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

  private cleanup: EnginePrivate["cleanup"] = async () => {
    const sessionTopics: string[] = [];
    const pairingTopics: string[] = [];
    const proposalIds: number[] = [];
    this.client.session.getAll().forEach(session => {
      if (isExpired(session.expiry)) sessionTopics.push(session.topic);
    });
    this.client.pairing.getAll().forEach(pairing => {
      if (isExpired(pairing.expiry)) pairingTopics.push(pairing.topic);
    });
    this.client.proposal.getAll().forEach(proposal => {
      if (isExpired(proposal.expiry)) proposalIds.push(proposal.id);
    });
    await Promise.all([
      ...sessionTopics.map(this.deleteSession),
      ...pairingTopics.map(this.deletePairing),
      ...proposalIds.map(this.deleteProposal),
    ]);
  };

  private isInitialized() {
    if (!this.initialized) throw getInternalError("NOT_INITIALIZED", this.name);
  }

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
    const { params, id } = payload;
    try {
      this.isValidConnect({ ...payload.params });
      const expiry = calcExpiry(FIVE_MINUTES);
      const proposal = { id, pairingTopic: topic, expiry, ...params };
      await this.setProposal(id, proposal);
      this.client.events.emit("session_proposal", { id, params: proposal });
    } catch (err) {
      await this.sendError(id, topic, err);
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
      await this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED"));
      this.events.emit(engineEvent("session_connect"), { error: payload.error });
    }
  };

  private onSessionSettleRequest: EnginePrivate["onSessionSettleRequest"] = async (
    topic,
    payload,
  ) => {
    const { id, params } = payload;
    try {
      this.isValidApprove({ id, ...params });
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
      this.events.emit(engineEvent("session_connect"), { session });
    } catch (err) {
      await this.sendError(id, topic, err);
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
      await this.client.session.delete(topic, getSdkError("USER_DISCONNECTED"));
      this.events.emit(engineEvent("session_approve", id), { error: payload.error });
    }
  };

  private onSessionUpdateRequest: EnginePrivate["onSessionUpdateRequest"] = async (
    topic,
    payload,
  ) => {
    const { params, id } = payload;
    try {
      this.isValidUpdate({ topic, ...params });
      await this.client.session.update(topic, { namespaces: params.namespaces });
      await this.sendResult<"wc_sessionUpdate">(id, topic, true);
      this.client.events.emit("session_update", { id, topic, params });
    } catch (err) {
      await this.sendError(id, topic, err);
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
    const { id } = payload;
    try {
      this.isValidExtend({ topic });
      await this.setExpiry(topic, SESSION_EXPIRY);
      await this.sendResult<"wc_sessionExtend">(id, topic, true);
      this.client.events.emit("session_extend", { id, topic });
    } catch (err) {
      await this.sendError(id, topic, err);
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
    const { id } = payload;
    try {
      this.isValidPing({ topic });
      await this.sendResult<"wc_sessionPing">(id, topic, true);
      this.client.events.emit("session_ping", { id, topic });
    } catch (err) {
      await this.sendError(id, topic, err);
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
    const { id } = payload;
    try {
      this.isValidPing({ topic });
      await this.sendResult<"wc_pairingPing">(id, topic, true);
      this.client.events.emit("pairing_ping", { id, topic });
    } catch (err) {
      await this.sendError(id, topic, err);
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
    const { id } = payload;
    try {
      this.isValidDisconnect({ topic, reason: payload.params });
      // RPC request needs to happen before deletion as it utalises session encryption
      await this.sendResult<"wc_sessionDelete">(id, topic, true);
      await this.deleteSession(topic);
      this.client.events.emit("session_delete", { id, topic });
    } catch (err) {
      await this.sendError(id, topic, err);
      this.client.logger.error(err);
    }
  };

  private onPairingDeleteRequest: EnginePrivate["onPairingDeleteRequest"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    try {
      this.isValidDisconnect({ topic, reason: payload.params });
      // RPC request needs to happen before deletion as it utalises pairing encryption
      await this.sendResult<"wc_pairingDelete">(id, topic, true);
      await this.deletePairing(topic);
      this.client.events.emit("pairing_delete", { id, topic });
    } catch (err) {
      await this.sendError(id, topic, err);
      this.client.logger.error(err);
    }
  };

  private onSessionRequest: EnginePrivate["onSessionRequest"] = async (topic, payload) => {
    const { id, params } = payload;
    try {
      this.isValidRequest({ topic, ...params });
      this.client.events.emit("session_request", { id, topic, params });
    } catch (err) {
      await this.sendError(id, topic, err);
      this.client.logger.error(err);
    }
  };

  private onSessionRequestResponse: EnginePrivate["onSessionRequestResponse"] = (
    _topic,
    payload,
  ) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("session_request", id), { result: payload.result });
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("session_request", id), { error: payload.error });
    }
  };

  private onSessionEventRequest: EnginePrivate["onSessionEventRequest"] = async (
    topic,
    payload,
  ) => {
    const { id, params } = payload;
    try {
      this.isValidEmit({ topic, ...params });
      this.client.events.emit("session_event", { id, topic, params });
    } catch (err) {
      await this.sendError(id, topic, err);
      this.client.logger.error(err);
    }
  };

  // ---------- Expirer Events ----------------------------------------- //

  private registerExpirerEvents() {
    this.client.expirer.on(EXPIRER_EVENTS.expired, async (event: ExpirerTypes.Expiration) => {
      const { topic, id } = parseExpirerTarget(event.target);
      if (topic) {
        if (this.client.session.keys.includes(topic)) {
          await this.deleteSession(topic);
          this.client.events.emit("session_expire", { topic });
        } else if (this.client.pairing.keys.includes(topic)) {
          await this.deletePairing(topic);
          this.client.events.emit("pairing_expire", { topic });
        }
      } else if (id) {
        await this.deleteProposal(id);
      }
    });
  }

  // ---------- Validation ---------------------------------------------- //
  private async isValidPairingTopic(topic: string) {
    if (!isValidString(topic, false))
      throw getInternalError("MISSING_OR_INVALID", `Pairing topic, ${topic}`);
    if (!this.client.pairing.keys.includes(topic))
      throw getInternalError("NO_MATCHING_KEY", `Pairing topic, ${topic}`);
    if (isExpired(this.client.pairing.get(topic).expiry)) {
      await this.deletePairing(topic);
      throw getInternalError("EXPIRED", `Pairing topic: ${topic}`);
    }
  }

  private async isValidSessionTopic(topic: string) {
    if (!isValidString(topic, false))
      throw getInternalError("MISSING_OR_INVALID", `Session topic, ${topic}`);
    if (!this.client.session.keys.includes(topic))
      throw getInternalError("NO_MATCHING_KEY", `Session topic, ${topic}`);
    if (isExpired(this.client.session.get(topic).expiry)) {
      await this.deleteSession(topic);
      throw getInternalError("EXPIRED", `Session topic: ${topic}`);
    }
  }

  private async isValidSessionOrPairingTopic(topic: string) {
    if (this.client.session.keys.includes(topic)) await this.isValidSessionTopic(topic);
    else if (this.client.pairing.keys.includes(topic)) await this.isValidPairingTopic(topic);
    else throw getInternalError("MISSING_OR_INVALID", `Session or pairing topic, ${topic}`);
  }

  private isValidConnect: EnginePrivate["isValidConnect"] = async params => {
    if (!isValidParams(params))
      throw getInternalError("MISSING_OR_INVALID", `Connect params, ${params}`);
    const { pairingTopic, requiredNamespaces, relays } = params;
    if (!isUndefined(pairingTopic)) await this.isValidPairingTopic(pairingTopic);
    if (!isValidRequiredNamespaces(requiredNamespaces))
      throw getInternalError(
        "MISSING_OR_INVALID",
        `Connect requiredNamespaces, ${requiredNamespaces}`,
      );
    if (!isValidRelays(relays, true))
      throw getInternalError("MISSING_OR_INVALID", `Connect relays ${relays}`);
  };

  private isValidPair: EnginePrivate["isValidPair"] = params => {
    if (!isValidParams(params))
      throw getInternalError("MISSING_OR_INVALID", `Pair params, ${params}`);
    if (!isValidUrl(params.uri))
      throw getInternalError("MISSING_OR_INVALID", `Pair uri, ${params.uri}`);
  };

  private isValidApprove: EnginePrivate["isValidApprove"] = params => {
    if (!isValidParams(params))
      throw getInternalError("MISSING_OR_INVALID", `Approve params, ${params}`);
    const { id, namespaces, relayProtocol } = params;
    if (!isValidId(id)) throw getInternalError("MISSING_OR_INVALID", `Approve id, ${id}`);
    if (!isValidNamespaces(namespaces))
      throw getInternalError("MISSING_OR_INVALID", `Approve namespaces, ${namespaces}`);
    if (!isValidString(relayProtocol, true))
      throw getInternalError("MISSING_OR_INVALID", `Approve relayProtocol, ${relayProtocol}`);
  };

  private isValidReject: EnginePrivate["isValidReject"] = params => {
    if (!isValidParams(params))
      throw getInternalError("MISSING_OR_INVALID", `Reject params, ${params}`);
    const { id, reason } = params;
    if (!isValidId(id)) throw getInternalError("MISSING_OR_INVALID", `Reject id, ${id}`);
    if (!isValidErrorReason(reason))
      throw getInternalError("MISSING_OR_INVALID", `Reject reason, ${reason}`);
  };

  private isValidUpdate: EnginePrivate["isValidUpdate"] = async params => {
    if (!isValidParams(params))
      throw getInternalError("MISSING_OR_INVALID", `Update params, ${params}`);
    const { topic, namespaces } = params;
    await this.isValidSessionTopic(topic);
    const session = this.client.session.get(topic);
    if (!isValidNamespaces(namespaces))
      throw getInternalError("MISSING_OR_INVALID", `Update namespaces, ${namespaces}`);
    if (!isValidNamespacesChange(session.requiredNamespaces, namespaces))
      throw getInternalError("MISSING_OR_INVALID", `Update namespaces, ${namespaces}`);
  };

  private isValidExtend: EnginePrivate["isValidExtend"] = async params => {
    if (!isValidParams(params))
      throw getInternalError("MISSING_OR_INVALID", `Extend params, ${params}`);
    const { topic } = params;
    await this.isValidSessionTopic(topic);
  };

  private isValidRequest: EnginePrivate["isValidRequest"] = async params => {
    if (!isValidParams(params))
      throw getInternalError("MISSING_OR_INVALID", `Request params, ${params}`);
    const { topic, request, chainId } = params;
    await this.isValidSessionTopic(topic);
    const { namespaces } = this.client.session.get(topic);
    if (!isValidNamespacesChainId(namespaces, chainId))
      throw getInternalError("MISSING_OR_INVALID", `Request chainId, ${chainId}`);
    if (!isValidRequest(request))
      throw getInternalError("MISSING_OR_INVALID", `Request method, ${request.method}`);
    if (!isValidNamespacesRequest(namespaces, chainId, request.method))
      throw getInternalError("MISSING_OR_INVALID", `Request method, ${request.method}`);
  };

  private isValidRespond: EnginePrivate["isValidRespond"] = async params => {
    if (!isValidParams(params))
      throw getInternalError("MISSING_OR_INVALID", `Respond params, ${params}`);
    const { topic, response } = params;
    await this.isValidSessionTopic(topic);
    if (!isValidResponse(response))
      throw getInternalError("MISSING_OR_INVALID", `Respond response, ${response}`);
  };

  private isValidPing: EnginePrivate["isValidPing"] = async params => {
    if (!isValidParams(params))
      throw getInternalError("MISSING_OR_INVALID", `Ping params, ${params}`);
    const { topic } = params;
    await this.isValidSessionOrPairingTopic(topic);
  };

  private isValidEmit: EnginePrivate["isValidEmit"] = async params => {
    if (!isValidParams(params))
      throw getInternalError("MISSING_OR_INVALID", `Emit params, ${params}`);
    const { topic, event, chainId } = params;
    await this.isValidSessionTopic(topic);
    const { namespaces } = this.client.session.get(topic);
    if (!isValidNamespacesChainId(namespaces, chainId))
      throw getInternalError("MISSING_OR_INVALID", `Emit chainId, ${chainId}`);
    if (!isValidEvent(event)) throw getInternalError("MISSING_OR_INVALID", `Emit event, ${event}`);
    if (!isValidNamespacesEvent(namespaces, chainId, event.name))
      throw getInternalError("MISSING_OR_INVALID", `Emit event, ${event}`);
  };

  private isValidDisconnect: EnginePrivate["isValidDisconnect"] = async params => {
    if (!isValidParams(params))
      throw getInternalError("MISSING_OR_INVALID", `Disconnect params, ${params}`);
    const { topic } = params;
    await this.isValidSessionOrPairingTopic(topic);
  };
}
