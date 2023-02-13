import EventEmmiter from "events";
import { RELAYER_EVENTS, EXPIRER_EVENTS, RELAYER_DEFAULT_PROTOCOL } from "@walletconnect/core";
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
  PendingRequestTypes,
  ProposalTypes,
} from "@walletconnect/types";
import {
  calcExpiry,
  parseExpirerTarget,
  createDelayedPromise,
  getInternalError,
  getSdkError,
  engineEvent,
  isValidNamespaces,
  isValidRelays,
  isValidRelay,
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
  isConformingNamespaces,
  isValidController,
  TYPE_1,
  getRequiredNamespacesFromNamespaces,
  isValidObject,
  isValidRequestExpiry,
} from "@walletconnect/utils";
import {
  SESSION_EXPIRY,
  ENGINE_CONTEXT,
  ENGINE_RPC_OPTS,
  SESSION_REQUEST_EXPIRY_BOUNDARIES,
} from "../constants";

export class Engine extends IEngine {
  public name = ENGINE_CONTEXT;

  private events: IEngineEvents = new EventEmmiter();
  private initialized = false;
  private ignoredPayloadTypes = [TYPE_1];

  constructor(client: IEngine["client"]) {
    super(client);
  }

  public init: IEngine["init"] = async () => {
    if (!this.initialized) {
      await this.cleanup();
      this.registerRelayerEvents();
      this.registerExpirerEvents();
      this.client.core.pairing.register({ methods: Object.keys(ENGINE_RPC_OPTS) });
      this.initialized = true;
    }
  };

  // ---------- Public ------------------------------------------------ //

  public connect: IEngine["connect"] = async (params) => {
    this.isInitialized();
    const connectParams = {
      ...params,
      requiredNamespaces: params.requiredNamespaces || {},
      optionalNamespaces: params.optionalNamespaces || {},
    };
    await this.isValidConnect(connectParams);
    const { pairingTopic, requiredNamespaces, optionalNamespaces, sessionProperties, relays } =
      connectParams;
    let topic = pairingTopic;
    let uri: string | undefined;
    let active = false;

    if (topic) {
      const pairing = this.client.core.pairing.pairings.get(topic);
      active = pairing.active;
    }

    if (!topic || !active) {
      const { topic: newTopic, uri: newUri } = await this.client.core.pairing.create();
      topic = newTopic;
      uri = newUri;
    }

    const publicKey = await this.client.core.crypto.generateKeyPair();

    const proposal = {
      requiredNamespaces,
      optionalNamespaces,
      relays: relays ?? [{ protocol: RELAYER_DEFAULT_PROTOCOL }],
      proposer: {
        publicKey,
        metadata: this.client.metadata,
      },
      ...(sessionProperties && { sessionProperties }),
    };
    const { reject, resolve, done: approval } = createDelayedPromise<SessionTypes.Struct>();
    this.events.once<"session_connect">(
      engineEvent("session_connect"),
      async ({ error, session }) => {
        if (error) reject(error);
        else if (session) {
          session.self.publicKey = publicKey;
          const completeSession = {
            ...session,
            requiredNamespaces: session.requiredNamespaces,
            optionalNamespaces: session.optionalNamespaces,
          };
          await this.client.session.set(session.topic, completeSession);
          await this.setExpiry(session.topic, session.expiry);
          if (topic) {
            await this.client.core.pairing.updateMetadata({
              topic,
              metadata: session.peer.metadata,
            });
          }
          resolve(completeSession);
        }
      },
    );

    if (!topic) {
      const { message } = getInternalError("NO_MATCHING_KEY", `connect() pairing topic: ${topic}`);
      throw new Error(message);
    }

    const id = await this.sendRequest(topic, "wc_sessionPropose", proposal);

    const expiry = calcExpiry(FIVE_MINUTES);
    await this.setProposal(id, { id, expiry, ...proposal });
    return { uri, approval };
  };

  public pair: IEngine["pair"] = async (params) => {
    this.isInitialized();
    return await this.client.core.pairing.pair(params);
  };

  public approve: IEngine["approve"] = async (params) => {
    this.isInitialized();
    await this.isValidApprove(params);
    const { id, relayProtocol, namespaces, sessionProperties } = params;
    const proposal = this.client.proposal.get(id);
    let { pairingTopic, proposer, requiredNamespaces, optionalNamespaces } = proposal;

    if (!isValidObject(requiredNamespaces)) {
      requiredNamespaces = getRequiredNamespacesFromNamespaces(namespaces, "approve()");
    }

    const selfPublicKey = await this.client.core.crypto.generateKeyPair();
    const peerPublicKey = proposer.publicKey;
    const sessionTopic = await this.client.core.crypto.generateSharedKey(
      selfPublicKey,
      peerPublicKey,
    );

    if (pairingTopic && id) {
      await this.client.core.pairing.updateMetadata({
        topic: pairingTopic,
        metadata: proposer.metadata,
      });
      await this.sendResult<"wc_sessionPropose">(id, pairingTopic, {
        relay: {
          protocol: relayProtocol ?? "irn",
        },
        responderPublicKey: selfPublicKey,
      });
      await this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED"));
      await this.client.core.pairing.activate({ topic: pairingTopic });
    }

    const sessionSettle = {
      relay: { protocol: relayProtocol ?? "irn" },
      namespaces,
      requiredNamespaces,
      optionalNamespaces,
      controller: { publicKey: selfPublicKey, metadata: this.client.metadata },
      expiry: calcExpiry(SESSION_EXPIRY),
      ...(sessionProperties && { sessionProperties }),
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
    await this.setExpiry(sessionTopic, calcExpiry(SESSION_EXPIRY));
    return { topic: sessionTopic, acknowledged };
  };

  public reject: IEngine["reject"] = async (params) => {
    this.isInitialized();
    await this.isValidReject(params);
    const { id, reason } = params;
    const { pairingTopic } = this.client.proposal.get(id);
    if (pairingTopic) {
      await this.sendError(id, pairingTopic, reason);
      await this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED"));
    }
  };

  public update: IEngine["update"] = async (params) => {
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

  public extend: IEngine["extend"] = async (params) => {
    this.isInitialized();
    await this.isValidExtend(params);
    const { topic } = params;
    const id = await this.sendRequest(topic, "wc_sessionExtend", {});
    const { done: acknowledged, resolve, reject } = createDelayedPromise<void>();
    this.events.once(engineEvent("session_extend", id), ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await this.setExpiry(topic, calcExpiry(SESSION_EXPIRY));

    return { acknowledged };
  };

  public request: IEngine["request"] = async <T>(params: EngineTypes.RequestParams) => {
    this.isInitialized();
    await this.isValidRequest(params);
    const { chainId, request, topic, expiry } = params;
    const id = await this.sendRequest(topic, "wc_sessionRequest", { request, chainId }, expiry);
    const { done, resolve, reject } = createDelayedPromise<T>(expiry);
    this.events.once<"session_request">(engineEvent("session_request", id), ({ error, result }) => {
      if (error) reject(error);
      else resolve(result);
    });
    return await done();
  };

  public respond: IEngine["respond"] = async (params) => {
    this.isInitialized();
    await this.isValidRespond(params);
    const { topic, response } = params;
    const { id } = response;
    if (isJsonRpcResult(response)) {
      await this.sendResult(id, topic, response.result);
    } else if (isJsonRpcError(response)) {
      await this.sendError(id, topic, response.error);
    }
    this.deletePendingSessionRequest(params.response.id, { message: "fulfilled", code: 0 });
  };

  public ping: IEngine["ping"] = async (params) => {
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
    } else if (this.client.core.pairing.pairings.keys.includes(topic)) {
      await this.client.core.pairing.ping({ topic });
    }
  };

  public emit: IEngine["emit"] = async (params) => {
    this.isInitialized();
    await this.isValidEmit(params);
    const { topic, event, chainId } = params;
    await this.sendRequest(topic, "wc_sessionEvent", { event, chainId });
  };

  public disconnect: IEngine["disconnect"] = async (params) => {
    this.isInitialized();
    await this.isValidDisconnect(params);
    const { topic } = params;
    if (this.client.session.keys.includes(topic)) {
      await this.sendRequest(topic, "wc_sessionDelete", getSdkError("USER_DISCONNECTED"));
      await this.deleteSession(topic);
    } else {
      await this.client.core.pairing.disconnect({ topic });
    }
  };

  public find: IEngine["find"] = (params) => {
    this.isInitialized();
    return this.client.session.getAll().filter((session) => isSessionCompatible(session, params));
  };

  public getPendingSessionRequests: IEngine["getPendingSessionRequests"] = () => {
    this.isInitialized();
    return this.client.pendingRequest.getAll();
  };

  // ---------- Private Helpers --------------------------------------- //

  private deleteSession: EnginePrivate["deleteSession"] = async (topic, expirerHasDeleted) => {
    const { self } = this.client.session.get(topic);
    // Await the unsubscribe first to avoid deleting the symKey too early below.
    await this.client.core.relayer.unsubscribe(topic);
    await Promise.all([
      this.client.session.delete(topic, getSdkError("USER_DISCONNECTED")),
      this.client.core.crypto.deleteKeyPair(self.publicKey),
      this.client.core.crypto.deleteSymKey(topic),
      expirerHasDeleted ? Promise.resolve() : this.client.core.expirer.del(topic),
    ]);
  };

  private deleteProposal: EnginePrivate["deleteProposal"] = async (id, expirerHasDeleted) => {
    await Promise.all([
      this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED")),
      expirerHasDeleted ? Promise.resolve() : this.client.core.expirer.del(id),
    ]);
  };

  private deletePendingSessionRequest: EnginePrivate["deletePendingSessionRequest"] = async (
    id,
    reason,
    expirerHasDeleted = false,
  ) => {
    await Promise.all([
      this.client.pendingRequest.delete(id, reason),
      expirerHasDeleted ? Promise.resolve() : this.client.core.expirer.del(id),
    ]);
  };

  private setExpiry: EnginePrivate["setExpiry"] = async (topic, expiry) => {
    if (this.client.session.keys.includes(topic)) {
      await this.client.session.update(topic, { expiry });
    }
    this.client.core.expirer.set(topic, expiry);
  };

  private setProposal: EnginePrivate["setProposal"] = async (id, proposal) => {
    await this.client.proposal.set(id, proposal);
    this.client.core.expirer.set(id, proposal.expiry);
  };

  private setPendingSessionRequest: EnginePrivate["setPendingSessionRequest"] = async (
    pendingRequest: PendingRequestTypes.Struct,
  ) => {
    const expiry = ENGINE_RPC_OPTS.wc_sessionRequest.req.ttl;
    const { id, topic, params } = pendingRequest;
    await this.client.pendingRequest.set(id, {
      id,
      topic,
      params,
    });
    if (expiry) this.client.core.expirer.set(id, calcExpiry(expiry));
  };

  private sendRequest: EnginePrivate["sendRequest"] = async (topic, method, params, expiry) => {
    const payload = formatJsonRpcRequest(method, params);
    const message = await this.client.core.crypto.encode(topic, payload);
    const opts = ENGINE_RPC_OPTS[method].req;
    if (expiry) opts.ttl = expiry;
    this.client.core.history.set(topic, payload);
    this.client.core.relayer.publish(topic, message, opts);
    return payload.id;
  };

  private sendResult: EnginePrivate["sendResult"] = async (id, topic, result) => {
    const payload = formatJsonRpcResult(id, result);
    const message = await this.client.core.crypto.encode(topic, payload);
    const record = await this.client.core.history.get(topic, id);
    const opts = ENGINE_RPC_OPTS[record.request.method].res;
    // await is intentionally omitted to speed up performance
    this.client.core.relayer.publish(topic, message, opts);
    await this.client.core.history.resolve(payload);
  };

  private sendError: EnginePrivate["sendError"] = async (id, topic, error) => {
    const payload = formatJsonRpcError(id, error);
    const message = await this.client.core.crypto.encode(topic, payload);
    const record = await this.client.core.history.get(topic, id);
    const opts = ENGINE_RPC_OPTS[record.request.method].res;
    // await is intentionally omitted to speed up performance
    this.client.core.relayer.publish(topic, message, opts);
    await this.client.core.history.resolve(payload);
  };

  private cleanup: EnginePrivate["cleanup"] = async () => {
    const sessionTopics: string[] = [];
    const proposalIds: number[] = [];
    this.client.session.getAll().forEach((session) => {
      if (isExpired(session.expiry)) sessionTopics.push(session.topic);
    });
    this.client.proposal.getAll().forEach((proposal) => {
      if (isExpired(proposal.expiry)) proposalIds.push(proposal.id);
    });
    await Promise.all([
      ...sessionTopics.map((topic) => this.deleteSession(topic)),
      ...proposalIds.map((id) => this.deleteProposal(id)),
    ]);
  };

  private isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }

  // ---------- Relay Events Router ----------------------------------- //

  private registerRelayerEvents() {
    this.client.core.relayer.on(
      RELAYER_EVENTS.message,
      async (event: RelayerTypes.MessageEvent) => {
        const { topic, message } = event;

        // messages of certain types should be ignored as they are handled by their respective SDKs
        if (this.ignoredPayloadTypes.includes(this.client.core.crypto.getPayloadType(message))) {
          return;
        }

        const payload = await this.client.core.crypto.decode(topic, message);
        if (isJsonRpcRequest(payload)) {
          this.client.core.history.set(topic, payload);
          this.onRelayEventRequest({ topic, payload });
        } else if (isJsonRpcResponse(payload)) {
          await this.client.core.history.resolve(payload);
          this.onRelayEventResponse({ topic, payload });
        }
      },
    );
  }

  private onRelayEventRequest: EnginePrivate["onRelayEventRequest"] = (event) => {
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
      case "wc_sessionDelete":
        return this.onSessionDeleteRequest(topic, payload);
      case "wc_sessionRequest":
        return this.onSessionRequest(topic, payload);
      case "wc_sessionEvent":
        return this.onSessionEventRequest(topic, payload);
      default:
        return this.client.logger.info(`Unsupported request method ${reqMethod}`);
    }
  };

  private onRelayEventResponse: EnginePrivate["onRelayEventResponse"] = async (event) => {
    const { topic, payload } = event;
    const record = await this.client.core.history.get(topic, payload.id);
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
      case "wc_sessionRequest":
        return this.onSessionRequestResponse(topic, payload);
      default:
        return this.client.logger.info(`Unsupported response method ${resMethod}`);
    }
  };

  // ---------- Relay Events Handlers --------------------------------- //

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
    } catch (err: any) {
      await this.sendError(id, topic, err);
      this.client.logger.error(err);
    }
  };

  private onSessionProposeResponse: EnginePrivate["onSessionProposeResponse"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
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
      await this.client.core.pairing.activate({ topic });
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
      this.isValidSessionSettleRequest(params);
      const {
        relay,
        controller,
        expiry,
        namespaces,
        requiredNamespaces,
        optionalNamespaces,
        sessionProperties,
      } = payload.params;
      const session = {
        topic,
        relay,
        expiry,
        namespaces,
        acknowledged: true,
        requiredNamespaces,
        optionalNamespaces,
        controller: controller.publicKey,
        self: {
          publicKey: "",
          metadata: this.client.metadata,
        },
        peer: {
          publicKey: controller.publicKey,
          metadata: controller.metadata,
        },
        ...(sessionProperties && { sessionProperties }),
      };
      await this.sendResult<"wc_sessionSettle">(payload.id, topic, true);
      this.events.emit(engineEvent("session_connect"), { session });
    } catch (err: any) {
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
    } catch (err: any) {
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
      await this.setExpiry(topic, calcExpiry(SESSION_EXPIRY));
      await this.sendResult<"wc_sessionExtend">(id, topic, true);
      this.client.events.emit("session_extend", { id, topic });
    } catch (err: any) {
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
    } catch (err: any) {
      await this.sendError(id, topic, err);
      this.client.logger.error(err);
    }
  };

  private onSessionPingResponse: EnginePrivate["onSessionPingResponse"] = (_topic, payload) => {
    const { id } = payload;
    // put at the end of the stack to avoid a race condition
    // where session_ping listener is not yet initialized
    setTimeout(() => {
      if (isJsonRpcResult(payload)) {
        this.events.emit(engineEvent("session_ping", id), {});
      } else if (isJsonRpcError(payload)) {
        this.events.emit(engineEvent("session_ping", id), { error: payload.error });
      }
    }, 500);
  };

  private onSessionDeleteRequest: EnginePrivate["onSessionDeleteRequest"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    try {
      this.isValidDisconnect({ topic, reason: payload.params });
      // RPC request needs to happen before deletion as it utalises session encryption
      this.client.core.relayer.once(RELAYER_EVENTS.publish, async () => {
        await this.deleteSession(topic);
      });
      await this.sendResult<"wc_sessionDelete">(id, topic, true);
      this.client.events.emit("session_delete", { id, topic });
    } catch (err: any) {
      await this.sendError(id, topic, err);
      this.client.logger.error(err);
    }
  };

  private onSessionRequest: EnginePrivate["onSessionRequest"] = async (topic, payload) => {
    const { id, params } = payload;
    try {
      this.isValidRequest({ topic, ...params });
      await this.setPendingSessionRequest({ id, topic, params });
      this.client.events.emit("session_request", { id, topic, params });
    } catch (err: any) {
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
    } catch (err: any) {
      await this.sendError(id, topic, err);
      this.client.logger.error(err);
    }
  };

  // ---------- Expirer Events ---------------------------------------- //

  private registerExpirerEvents() {
    this.client.core.expirer.on(EXPIRER_EVENTS.expired, async (event: ExpirerTypes.Expiration) => {
      const { topic, id } = parseExpirerTarget(event.target);
      if (id && this.client.pendingRequest.keys.includes(id)) {
        return await this.deletePendingSessionRequest(id, getInternalError("EXPIRED"), true);
      }

      if (topic) {
        if (this.client.session.keys.includes(topic)) {
          await this.deleteSession(topic, true);
          this.client.events.emit("session_expire", { topic });
        }
      } else if (id) {
        await this.deleteProposal(id, true);
        this.client.events.emit("proposal_expire", { id });
      }
    });
  }

  // ---------- Validation Helpers ------------------------------------ //
  private isValidPairingTopic(topic: any) {
    if (!isValidString(topic, false)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `pairing topic should be a string: ${topic}`,
      );
      throw new Error(message);
    }
    if (!this.client.core.pairing.pairings.keys.includes(topic)) {
      const { message } = getInternalError(
        "NO_MATCHING_KEY",
        `pairing topic doesn't exist: ${topic}`,
      );
      throw new Error(message);
    }
    if (isExpired(this.client.core.pairing.pairings.get(topic).expiry)) {
      // await this.deletePairing(topic);
      const { message } = getInternalError("EXPIRED", `pairing topic: ${topic}`);
      throw new Error(message);
    }
  }

  private async isValidSessionTopic(topic: any) {
    if (!isValidString(topic, false)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `session topic should be a string: ${topic}`,
      );
      throw new Error(message);
    }
    if (!this.client.session.keys.includes(topic)) {
      const { message } = getInternalError(
        "NO_MATCHING_KEY",
        `session topic doesn't exist: ${topic}`,
      );
      throw new Error(message);
    }
    if (isExpired(this.client.session.get(topic).expiry)) {
      await this.deleteSession(topic);
      const { message } = getInternalError("EXPIRED", `session topic: ${topic}`);
      throw new Error(message);
    }
  }

  private async isValidSessionOrPairingTopic(topic: string) {
    if (this.client.session.keys.includes(topic)) {
      await this.isValidSessionTopic(topic);
    } else if (this.client.core.pairing.pairings.keys.includes(topic)) {
      this.isValidPairingTopic(topic);
    } else if (!isValidString(topic, false)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `session or pairing topic should be a string: ${topic}`,
      );
      throw new Error(message);
    } else {
      const { message } = getInternalError(
        "NO_MATCHING_KEY",
        `session or pairing topic doesn't exist: ${topic}`,
      );
      throw new Error(message);
    }
  }

  private async isValidProposalId(id: any) {
    if (!isValidId(id)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `proposal id should be a number: ${id}`,
      );
      throw new Error(message);
    }
    if (!this.client.proposal.keys.includes(id)) {
      const { message } = getInternalError("NO_MATCHING_KEY", `proposal id doesn't exist: ${id}`);
      throw new Error(message);
    }
    if (isExpired(this.client.proposal.get(id).expiry)) {
      await this.deleteProposal(id);
      const { message } = getInternalError("EXPIRED", `proposal id: ${id}`);
      throw new Error(message);
    }
  }

  // ---------- Validation  ------------------------------------------- //

  private isValidConnect: EnginePrivate["isValidConnect"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `connect() params: ${JSON.stringify(params)}`,
      );
      throw new Error(message);
    }
    const { pairingTopic, requiredNamespaces, optionalNamespaces, sessionProperties, relays } =
      params;
    if (!isUndefined(pairingTopic)) await this.isValidPairingTopic(pairingTopic);

    if (!isValidRelays(relays, true)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `connect() relays: ${relays}`);
      throw new Error(message);
    }

    // validate required namespaces only if they are defined
    if (!isUndefined(requiredNamespaces) && isValidObject(requiredNamespaces) !== 0) {
      this.validateNamespaces(requiredNamespaces, "requiredNamespaces");
    }

    // validate optional namespaces only if they are defined
    if (!isUndefined(optionalNamespaces) && isValidObject(optionalNamespaces) !== 0) {
      this.validateNamespaces(optionalNamespaces, "optionalNamespaces");
    }

    // validate session properties only if they are defined
    if (!isUndefined(sessionProperties)) {
      this.validateSessionProps(sessionProperties, "sessionProperties");
    }
  };

  private validateNamespaces = (
    namespaces: ProposalTypes.RequiredNamespaces | ProposalTypes.OptionalNamespaces,
    type: string,
  ) => {
    const validRequiredNamespacesError = isValidRequiredNamespaces(namespaces, "connect()", type);
    if (validRequiredNamespacesError) throw new Error(validRequiredNamespacesError.message);
  };

  private isValidApprove: EnginePrivate["isValidApprove"] = async (params) => {
    if (!isValidParams(params))
      throw new Error(
        getInternalError("MISSING_OR_INVALID", `approve() params: ${params}`).message,
      );
    const { id, namespaces, relayProtocol, sessionProperties } = params;
    await this.isValidProposalId(id);
    const proposal = this.client.proposal.get(id);
    const validNamespacesError = isValidNamespaces(namespaces, "approve()");
    if (validNamespacesError) throw new Error(validNamespacesError.message);
    const conformingNamespacesError = isConformingNamespaces(
      proposal.requiredNamespaces,
      namespaces,
      "approve()",
      "requiredNamespaces",
    );
    if (conformingNamespacesError) throw new Error(conformingNamespacesError.message);
    if (!isValidString(relayProtocol, true)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `approve() relayProtocol: ${relayProtocol}`,
      );
      throw new Error(message);
    }

    // if the length of the namespaces is greater than the length of the required namespaces
    // then the user is trying to approve part or all of the optional namespaces so we need to validate
    if (Object.keys(namespaces).length > Object.keys(proposal.requiredNamespaces).length) {
      // filter out the optional namespaces that are not being used
      const namespacesToValidate = Object.keys(proposal.optionalNamespaces).filter(
        (namespace) => namespaces[namespace],
      );
      const usedOptionalNamespaces = {};
      for (const key in proposal.optionalNamespaces) {
        if (namespacesToValidate.includes(key)) {
          usedOptionalNamespaces[key] = proposal.optionalNamespaces[key];
        }
      }
      const conformingNamespacesError = isConformingNamespaces(
        usedOptionalNamespaces,
        namespaces,
        "approve()",
        "optionalNamespaces",
      );
      if (conformingNamespacesError) throw new Error(conformingNamespacesError.message);
    }

    if (!isUndefined(sessionProperties)) {
      this.validateSessionProps(sessionProperties, "sessionProperties");
    }
  };

  private isValidReject: EnginePrivate["isValidReject"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `reject() params: ${params}`);
      throw new Error(message);
    }
    const { id, reason } = params;
    await this.isValidProposalId(id);
    if (!isValidErrorReason(reason)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `reject() reason: ${JSON.stringify(reason)}`,
      );
      throw new Error(message);
    }
  };

  private isValidSessionSettleRequest: EnginePrivate["isValidSessionSettleRequest"] = (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `onSessionSettleRequest() params: ${params}`,
      );
      throw new Error(message);
    }
    const { relay, controller, namespaces, expiry } = params;
    if (!isValidRelay(relay)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `onSessionSettleRequest() relay protocol should be a string`,
      );
      throw new Error(message);
    }
    const validControllerError = isValidController(controller, "onSessionSettleRequest()");
    if (validControllerError) throw new Error(validControllerError.message);
    const validNamespacesError = isValidNamespaces(namespaces, "onSessionSettleRequest()");
    if (validNamespacesError) throw new Error(validNamespacesError.message);
    if (isExpired(expiry)) {
      const { message } = getInternalError("EXPIRED", `onSessionSettleRequest()`);
      throw new Error(message);
    }
  };

  private isValidUpdate: EnginePrivate["isValidUpdate"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `update() params: ${params}`);
      throw new Error(message);
    }
    const { topic, namespaces } = params;
    await this.isValidSessionTopic(topic);
    const session = this.client.session.get(topic);
    const validNamespacesError = isValidNamespaces(namespaces, "update()");
    if (validNamespacesError) throw new Error(validNamespacesError.message);
    const conformingNamespacesError = isConformingNamespaces(
      session.requiredNamespaces,
      namespaces,
      "update()",
      "requiredNamespaces",
    );
    if (conformingNamespacesError) throw new Error(conformingNamespacesError.message);
    // TODO(ilja) - check if wallet
  };

  private isValidExtend: EnginePrivate["isValidExtend"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `extend() params: ${params}`);
      throw new Error(message);
    }
    const { topic } = params;
    await this.isValidSessionTopic(topic);
    // TODO(ilja) - check if wallet
  };

  private isValidRequest: EnginePrivate["isValidRequest"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `request() params: ${params}`);
      throw new Error(message);
    }
    const { topic, request, chainId, expiry } = params;
    await this.isValidSessionTopic(topic);
    const { namespaces } = this.client.session.get(topic);
    if (!isValidNamespacesChainId(namespaces, chainId)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `request() chainId: ${chainId}`);
      throw new Error(message);
    }
    if (!isValidRequest(request)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `request() ${JSON.stringify(request)}`,
      );
      throw new Error(message);
    }
    if (!isValidNamespacesRequest(namespaces, chainId, request.method)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `request() method: ${request.method}`,
      );
      throw new Error(message);
    }
    if (expiry && !isValidRequestExpiry(expiry, SESSION_REQUEST_EXPIRY_BOUNDARIES)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `request() expiry: ${expiry}. Expiry must be a number (in seconds) between ${SESSION_REQUEST_EXPIRY_BOUNDARIES.min} and ${SESSION_REQUEST_EXPIRY_BOUNDARIES.max}`,
      );
      throw new Error(message);
    }
  };

  private isValidRespond: EnginePrivate["isValidRespond"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `respond() params: ${params}`);
      throw new Error(message);
    }
    const { topic, response } = params;
    await this.isValidSessionTopic(topic);
    if (!isValidResponse(response)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `respond() response: ${JSON.stringify(response)}`,
      );
      throw new Error(message);
    }
  };

  private isValidPing: EnginePrivate["isValidPing"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `ping() params: ${params}`);
      throw new Error(message);
    }
    const { topic } = params;
    await this.isValidSessionOrPairingTopic(topic);
  };

  private isValidEmit: EnginePrivate["isValidEmit"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `emit() params: ${params}`);
      throw new Error(message);
    }
    const { topic, event, chainId } = params;
    await this.isValidSessionTopic(topic);
    const { namespaces } = this.client.session.get(topic);
    if (!isValidNamespacesChainId(namespaces, chainId)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `emit() chainId: ${chainId}`);
      throw new Error(message);
    }
    if (!isValidEvent(event)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `emit() event: ${JSON.stringify(event)}`,
      );
      throw new Error(message);
    }
    if (!isValidNamespacesEvent(namespaces, chainId, event.name)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `emit() event: ${JSON.stringify(event)}`,
      );
      throw new Error(message);
    }
  };

  private isValidDisconnect: EnginePrivate["isValidDisconnect"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `disconnect() params: ${params}`);
      throw new Error(message);
    }
    const { topic } = params;
    await this.isValidSessionOrPairingTopic(topic);
  };

  private validateSessionProps = (properties: ProposalTypes.SessionProperties, type: string) => {
    Object.values(properties).forEach((property) => {
      if (!isValidString(property, false)) {
        const { message } = getInternalError(
          "MISSING_OR_INVALID",
          `${type} must be in Record<string, string> format. Received: ${JSON.stringify(property)}`,
        );
        throw new Error(message);
      }
    });
  };
}
