import {
  EXPIRER_EVENTS,
  PAIRING_EVENTS,
  RELAYER_DEFAULT_PROTOCOL,
  RELAYER_EVENTS,
  VERIFY_SERVER,
} from "@walletconnect/core";

import {
  formatJsonRpcError,
  formatJsonRpcRequest,
  formatJsonRpcResult,
  payloadId,
  isJsonRpcError,
  isJsonRpcRequest,
  isJsonRpcResponse,
  isJsonRpcResult,
  JsonRpcRequest,
} from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES, ONE_SECOND, toMiliseconds } from "@walletconnect/time";
import {
  EnginePrivate,
  EngineTypes,
  ExpirerTypes,
  IEngine,
  IEngineEvents,
  JsonRpcTypes,
  PendingRequestTypes,
  Verify,
  CoreTypes,
  ProposalTypes,
  RelayerTypes,
  SessionTypes,
  PairingTypes,
} from "@walletconnect/types";
import {
  calcExpiry,
  createDelayedPromise,
  engineEvent,
  getInternalError,
  getRequiredNamespacesFromNamespaces,
  getSdkError,
  isConformingNamespaces,
  isExpired,
  isSessionCompatible,
  isUndefined,
  isValidController,
  isValidErrorReason,
  isValidEvent,
  isValidId,
  isValidNamespaces,
  isValidNamespacesChainId,
  isValidNamespacesEvent,
  isValidNamespacesRequest,
  isValidObject,
  isValidParams,
  isValidRelay,
  isValidRelays,
  isValidRequest,
  isValidRequestExpiry,
  hashMessage,
  isBrowser,
  isValidRequiredNamespaces,
  isValidResponse,
  isValidString,
  parseExpirerTarget,
  TYPE_1,
  handleDeeplinkRedirect,
  MemoryStore,
  getDeepLink,
} from "@walletconnect/utils";
import EventEmmiter from "events";
import {
  ENGINE_CONTEXT,
  ENGINE_RPC_OPTS,
  PROPOSAL_EXPIRY_MESSAGE,
  SESSION_EXPIRY,
  SESSION_REQUEST_EXPIRY_BOUNDARIES,
  METHODS_TO_VERIFY,
  WALLETCONNECT_DEEPLINK_CHOICE,
  ENGINE_QUEUE_STATES,
} from "../constants";

export class Engine extends IEngine {
  public name = ENGINE_CONTEXT;

  private events: IEngineEvents = new EventEmmiter();
  private initialized = false;
  private ignoredPayloadTypes = [TYPE_1];

  /**
   * Queue responsible for processing incoming requests such as session_update, session_event, session_ping etc
   * It's needed when the client receives multiple requests at once from the mailbox immediately after initialization and to avoid attempting to process them all at the same time
   */
  private requestQueue: EngineTypes.EngineQueue<EngineTypes.EventCallback<JsonRpcRequest>> = {
    state: ENGINE_QUEUE_STATES.idle,
    queue: [],
  };

  /**
   * Queue responsible for processing incoming session_request
   * The queue emits the next request only after the previous one has been responded to
   */
  private sessionRequestQueue: EngineTypes.EngineQueue<PendingRequestTypes.Struct> = {
    state: ENGINE_QUEUE_STATES.idle,
    queue: [],
  };

  private requestQueueDelay = ONE_SECOND;

  constructor(client: IEngine["client"]) {
    super(client);
  }

  public init: IEngine["init"] = async () => {
    if (!this.initialized) {
      await this.cleanup();
      this.registerRelayerEvents();
      this.registerExpirerEvents();
      this.registerPairingEvents();
      this.client.core.pairing.register({ methods: Object.keys(ENGINE_RPC_OPTS) });
      this.initialized = true;

      setTimeout(() => {
        this.sessionRequestQueue.queue = this.getPendingSessionRequests();
        this.processSessionRequestQueue();
      }, toMiliseconds(this.requestQueueDelay));
    }
  };

  // ---------- Public ------------------------------------------------ //

  public connect: IEngine["connect"] = async (params) => {
    await this.isInitialized();

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
    const {
      reject,
      resolve,
      done: approval,
    } = createDelayedPromise<SessionTypes.Struct>(FIVE_MINUTES, PROPOSAL_EXPIRY_MESSAGE);
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

    const id = await this.sendRequest({
      topic,
      method: "wc_sessionPropose",
      params: proposal,
    });

    const expiry = calcExpiry(FIVE_MINUTES);
    await this.setProposal(id, { id, expiry, ...proposal });
    return { uri, approval };
  };

  public pair: IEngine["pair"] = async (params) => {
    await this.isInitialized();
    return await this.client.core.pairing.pair(params);
  };

  public approve: IEngine["approve"] = async (params) => {
    await this.isInitialized();
    await this.isValidApprove(params);

    const { id, relayProtocol, namespaces, sessionProperties } = params;
    const proposal = this.client.proposal.get(id);
    let { pairingTopic, proposer, requiredNamespaces, optionalNamespaces } = proposal;
    pairingTopic = pairingTopic || "";
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
      await this.sendResult<"wc_sessionPropose">({
        id,
        topic: pairingTopic,
        result: {
          relay: {
            protocol: relayProtocol ?? "irn",
          },
          responderPublicKey: selfPublicKey,
        },
      });
      await this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED"));
      await this.client.core.pairing.activate({ topic: pairingTopic });
    }

    const sessionSettle = {
      relay: { protocol: relayProtocol ?? "irn" },
      namespaces,
      requiredNamespaces,
      optionalNamespaces,
      pairingTopic,
      controller: { publicKey: selfPublicKey, metadata: this.client.metadata },
      expiry: calcExpiry(SESSION_EXPIRY),
      ...(sessionProperties && { sessionProperties }),
    };
    await this.client.core.relayer.subscribe(sessionTopic);
    await this.sendRequest({
      topic: sessionTopic,
      method: "wc_sessionSettle",
      params: sessionSettle,
      throwOnFailedPublish: true,
    });
    const session = {
      ...sessionSettle,
      topic: sessionTopic,
      pairingTopic,
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
    return {
      topic: sessionTopic,
      acknowledged: () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(this.client.session.get(sessionTopic)), 5_00),
        ), // artificial delay to allow for the session to be processed by the peer
    };
  };

  public reject: IEngine["reject"] = async (params) => {
    await this.isInitialized();
    await this.isValidReject(params);
    const { id, reason } = params;
    const { pairingTopic } = this.client.proposal.get(id);
    if (pairingTopic) {
      await this.sendError(id, pairingTopic, reason);
      await this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED"));
    }
  };

  public update: IEngine["update"] = async (params) => {
    await this.isInitialized();
    await this.isValidUpdate(params);
    const { topic, namespaces } = params;
    const id = await this.sendRequest({
      topic,
      method: "wc_sessionUpdate",
      params: { namespaces },
    });
    const { done: acknowledged, resolve, reject } = createDelayedPromise<void>();
    this.events.once(engineEvent("session_update", id), ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await this.client.session.update(topic, { namespaces });

    return { acknowledged };
  };

  public extend: IEngine["extend"] = async (params) => {
    await this.isInitialized();
    await this.isValidExtend(params);
    const { topic } = params;
    const id = await this.sendRequest({ topic, method: "wc_sessionExtend", params: {} });
    const { done: acknowledged, resolve, reject } = createDelayedPromise<void>();
    this.events.once(engineEvent("session_extend", id), ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await this.setExpiry(topic, calcExpiry(SESSION_EXPIRY));

    return { acknowledged };
  };

  public request: IEngine["request"] = async <T>(params: EngineTypes.RequestParams) => {
    await this.isInitialized();
    await this.isValidRequest(params);
    const { chainId, request, topic, expiry } = params;
    const id = payloadId();
    const { done, resolve, reject } = createDelayedPromise<T>(
      expiry,
      "Request expired. Please try again.",
    );
    this.events.once<"session_request">(engineEvent("session_request", id), ({ error, result }) => {
      if (error) reject(error);
      else resolve(result);
    });
    return await Promise.all([
      new Promise<void>(async (resolve) => {
        await this.sendRequest({
          clientRpcId: id,
          topic,
          method: "wc_sessionRequest",
          params: { request, chainId },
          expiry,
          throwOnFailedPublish: true,
        }).catch((error) => reject(error));
        this.client.events.emit("session_request_sent", { topic, request, chainId, id });
        resolve();
      }),
      new Promise<void>(async (resolve) => {
        const wcDeepLink = await getDeepLink(
          this.client.core.storage,
          WALLETCONNECT_DEEPLINK_CHOICE,
        );
        handleDeeplinkRedirect({ id, topic, wcDeepLink });
        resolve();
      }),
      done(),
    ]).then((result) => result[2]); // order is important here, we want to return the result of the `done` promise
  };

  public respond: IEngine["respond"] = async (params) => {
    await this.isInitialized();
    await this.isValidRespond(params);
    const { topic, response } = params;
    const { id } = response;
    if (isJsonRpcResult(response)) {
      await this.sendResult({ id, topic, result: response.result, throwOnFailedPublish: true });
    } else if (isJsonRpcError(response)) {
      await this.sendError(id, topic, response.error);
    }
    this.cleanupAfterResponse(params);
  };

  public ping: IEngine["ping"] = async (params) => {
    await this.isInitialized();
    await this.isValidPing(params);
    const { topic } = params;
    if (this.client.session.keys.includes(topic)) {
      const id = await this.sendRequest({ topic, method: "wc_sessionPing", params: {} });
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
    await this.isInitialized();
    await this.isValidEmit(params);
    const { topic, event, chainId } = params;
    await this.sendRequest({ topic, method: "wc_sessionEvent", params: { event, chainId } });
  };

  public disconnect: IEngine["disconnect"] = async (params) => {
    await this.isInitialized();
    await this.isValidDisconnect(params);
    const { topic } = params;
    if (this.client.session.keys.includes(topic)) {
      // await an ack to ensure the relay has received the disconnect request
      await this.sendRequest({
        topic,
        method: "wc_sessionDelete",
        params: getSdkError("USER_DISCONNECTED"),
        throwOnFailedPublish: true,
      });
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

  private cleanupDuplicatePairings: EnginePrivate["cleanupDuplicatePairings"] = async (
    session: SessionTypes.Struct,
  ) => {
    // older SDK versions are missing the `pairingTopic` prop thus we need to check for it
    if (!session.pairingTopic) return;

    try {
      const pairing = this.client.core.pairing.pairings.get(session.pairingTopic);
      const allPairings = this.client.core.pairing.pairings.getAll();
      const duplicates = allPairings.filter(
        (p) =>
          p.peerMetadata?.url &&
          p.peerMetadata?.url === session.peer.metadata.url &&
          p.topic &&
          p.topic !== pairing.topic,
      );
      if (duplicates.length === 0) return;
      this.client.logger.info(`Cleaning up ${duplicates.length} duplicate pairing(s)`);
      await Promise.all(
        duplicates.map((p) => this.client.core.pairing.disconnect({ topic: p.topic })),
      );
      this.client.logger.info(`Duplicate pairings clean up finished`);
    } catch (error) {
      this.client.logger.error(error);
    }
  };

  private deleteSession: EnginePrivate["deleteSession"] = async (topic, expirerHasDeleted) => {
    const { self } = this.client.session.get(topic);
    // Await the unsubscribe first to avoid deleting the symKey too early below.
    await this.client.core.relayer.unsubscribe(topic);
    this.client.session.delete(topic, getSdkError("USER_DISCONNECTED"));
    if (this.client.core.crypto.keychain.has(self.publicKey)) {
      await this.client.core.crypto.deleteKeyPair(self.publicKey);
    }
    if (this.client.core.crypto.keychain.has(topic)) {
      await this.client.core.crypto.deleteSymKey(topic);
    }
    if (!expirerHasDeleted) this.client.core.expirer.del(topic);
    // remove any deeplinks from storage after the session is deleted
    // to avoid navigating to incorrect deeplink later on
    this.client.core.storage
      .removeItem(WALLETCONNECT_DEEPLINK_CHOICE)
      .catch((e) => this.client.logger.warn(e));
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
    this.sessionRequestQueue.queue = this.sessionRequestQueue.queue.filter((r) => r.id !== id);
    // set the requestQueue state to idle if expirer has deleted a request as trying to respond to it would result in an exception
    if (expirerHasDeleted) {
      this.sessionRequestQueue.state = ENGINE_QUEUE_STATES.idle;
    }
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
    const { id, topic, params, verifyContext } = pendingRequest;
    await this.client.pendingRequest.set(id, {
      id,
      topic,
      params,
      verifyContext,
    });
    if (expiry) this.client.core.expirer.set(id, calcExpiry(expiry));
  };

  private sendRequest: EnginePrivate["sendRequest"] = async (args) => {
    const { topic, method, params, expiry, relayRpcId, clientRpcId, throwOnFailedPublish } = args;
    const payload = formatJsonRpcRequest(method, params, clientRpcId);
    if (isBrowser() && METHODS_TO_VERIFY.includes(method)) {
      const hash = hashMessage(JSON.stringify(payload));
      this.client.core.verify.register({ attestationId: hash });
    }
    const message = await this.client.core.crypto.encode(topic, payload);
    const opts = ENGINE_RPC_OPTS[method].req;
    if (expiry) opts.ttl = expiry;
    if (relayRpcId) opts.id = relayRpcId;
    this.client.core.history.set(topic, payload);
    if (throwOnFailedPublish) {
      opts.internal = {
        ...opts.internal,
        throwOnFailedPublish: true,
      };
      await this.client.core.relayer.publish(topic, message, opts);
    } else {
      this.client.core.relayer
        .publish(topic, message, opts)
        .catch((error) => this.client.logger.error(error));
    }
    return payload.id;
  };

  private sendResult: EnginePrivate["sendResult"] = async (args) => {
    const { id, topic, result, throwOnFailedPublish } = args;
    const payload = formatJsonRpcResult(id, result);
    const message = await this.client.core.crypto.encode(topic, payload);
    const record = await this.client.core.history.get(topic, id);
    const opts = ENGINE_RPC_OPTS[record.request.method].res;
    if (throwOnFailedPublish) {
      opts.internal = {
        ...opts.internal,
        throwOnFailedPublish: true,
      };
      await this.client.core.relayer.publish(topic, message, opts);
    } else {
      this.client.core.relayer
        .publish(topic, message, opts)
        .catch((error) => this.client.logger.error(error));
    }
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

  private async isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
    await this.client.core.relayer.confirmOnlineStateOrThrow();
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
        try {
          if (isJsonRpcRequest(payload)) {
            this.client.core.history.set(topic, payload);
            this.onRelayEventRequest({ topic, payload });
          } else if (isJsonRpcResponse(payload)) {
            await this.client.core.history.resolve(payload);
            await this.onRelayEventResponse({ topic, payload });
            this.client.core.history.delete(topic, payload.id);
          } else {
            this.onRelayEventUnknownPayload({ topic, payload });
          }
        } catch (error) {
          this.client.logger.error(error);
        }
      },
    );
  }

  private onRelayEventRequest: EnginePrivate["onRelayEventRequest"] = async (event) => {
    this.requestQueue.queue.push(event);
    await this.processRequestsQueue();
  };

  private processRequestsQueue = async () => {
    if (this.requestQueue.state === ENGINE_QUEUE_STATES.active) {
      this.client.logger.info(`Request queue already active, skipping...`);
      return;
    }

    this.client.logger.info(
      `Request queue starting with ${this.requestQueue.queue.length} requests`,
    );

    while (this.requestQueue.queue.length > 0) {
      this.requestQueue.state = ENGINE_QUEUE_STATES.active;
      const request = this.requestQueue.queue.shift();
      if (!request) continue;

      try {
        this.processRequest(request);
        // small delay to allow for any async tasks to complete
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        this.client.logger.warn(error);
      }
    }
    this.requestQueue.state = ENGINE_QUEUE_STATES.idle;
  };

  private processRequest: EnginePrivate["onRelayEventRequest"] = (event) => {
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

  private onRelayEventUnknownPayload: EnginePrivate["onRelayEventUnknownPayload"] = (event) => {
    const { topic } = event;
    const { message } = getInternalError(
      "MISSING_OR_INVALID",
      `Decoded payload on topic ${topic} is not identifiable as a JSON-RPC request or a response.`,
    );
    throw new Error(message);
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
      const hash = hashMessage(JSON.stringify(payload));
      const verifyContext = await this.getVerifyContext(hash, proposal.proposer.metadata);
      this.client.events.emit("session_proposal", { id, params: proposal, verifyContext });
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
        pairingTopic,
      } = payload.params;
      const session = {
        topic,
        relay,
        expiry,
        namespaces,
        acknowledged: true,
        pairingTopic,
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
      await this.sendResult<"wc_sessionSettle">({ id: payload.id, topic, result: true });
      this.events.emit(engineEvent("session_connect"), { session });
      this.cleanupDuplicatePairings(session);
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
      const memoryKey = `${topic}_session_update`;
      // compare the current request id with the last processed session update
      // we want to update only if the request is newer than the last processed one
      const lastSessionUpdateId = MemoryStore.get<number>(memoryKey);
      if (lastSessionUpdateId && this.isRequestOutOfSync(lastSessionUpdateId, id)) {
        this.client.logger.info(`Discarding out of sync request - ${id}`);
        return;
      }

      this.isValidUpdate({ topic, ...params });
      await this.client.session.update(topic, { namespaces: params.namespaces });
      await this.sendResult<"wc_sessionUpdate">({ id, topic, result: true });
      this.client.events.emit("session_update", { id, topic, params });
      MemoryStore.set(memoryKey, id);
    } catch (err: any) {
      await this.sendError(id, topic, err);
      this.client.logger.error(err);
    }
  };

  // compares the timestamp of the last processed request with the current request
  // client <-> client rpc ID is timestamp + 3 random digits
  private isRequestOutOfSync = (lastId: number, currentId: number) => {
    return parseInt(currentId.toString().slice(0, -3)) <= parseInt(lastId.toString().slice(0, -3));
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
      await this.sendResult<"wc_sessionExtend">({ id, topic, result: true });
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
      await this.sendResult<"wc_sessionPing">({ id, topic, result: true });
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
      await Promise.all([
        new Promise((resolve) => {
          // RPC request needs to happen before deletion as it utalises session encryption
          this.client.core.relayer.once(RELAYER_EVENTS.publish, async () => {
            resolve(await this.deleteSession(topic));
          });
        }),
        this.sendResult<"wc_sessionDelete">({ id, topic, result: true }),
      ]);
      this.client.events.emit("session_delete", { id, topic });
    } catch (err: any) {
      this.client.logger.error(err);
    }
  };

  private onSessionRequest: EnginePrivate["onSessionRequest"] = async (topic, payload) => {
    const { id, params } = payload;
    try {
      this.isValidRequest({ topic, ...params });
      const hash = hashMessage(
        JSON.stringify(formatJsonRpcRequest("wc_sessionRequest", params, id)),
      );
      const session = this.client.session.get(topic);
      const verifyContext = await this.getVerifyContext(hash, session.peer.metadata);
      const request = { id, topic, params, verifyContext };
      await this.setPendingSessionRequest(request);
      this.addSessionRequestToSessionRequestQueue(request);
      this.processSessionRequestQueue();
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
      // similar to session update, we want to discard out of sync requests
      // additionally we have to check the event type as well e.g. chainChanged/accountsChanged
      const memoryKey = `${topic}_session_event_${params.event.name}`;
      // compare the current request id with the last processed session update
      // we want to update only if the request is newer than the last processed one
      const lastSessionUpdateId = MemoryStore.get<number>(memoryKey);
      if (lastSessionUpdateId && this.isRequestOutOfSync(lastSessionUpdateId, id)) {
        this.client.logger.info(`Discarding out of sync request - ${id}`);
        return;
      }

      this.isValidEmit({ topic, ...params });
      this.client.events.emit("session_event", { id, topic, params });
      MemoryStore.set(memoryKey, id);
    } catch (err: any) {
      await this.sendError(id, topic, err);
      this.client.logger.error(err);
    }
  };

  private addSessionRequestToSessionRequestQueue = (request: PendingRequestTypes.Struct) => {
    this.sessionRequestQueue.queue.push(request);
  };

  private cleanupAfterResponse = (params: EngineTypes.RespondParams) => {
    this.deletePendingSessionRequest(params.response.id, { message: "fulfilled", code: 0 });
    // intentionally delay the emitting of the next pending request a bit
    setTimeout(() => {
      this.sessionRequestQueue.state = ENGINE_QUEUE_STATES.idle;
      this.processSessionRequestQueue();
    }, toMiliseconds(this.requestQueueDelay));
  };

  private processSessionRequestQueue = () => {
    if (this.sessionRequestQueue.state === ENGINE_QUEUE_STATES.active) {
      this.client.logger.info("session request queue is already active.");
      return;
    }
    // Select the first/oldest request in the array to ensure last-in-first-out (LIFO)
    const request = this.sessionRequestQueue.queue[0];
    if (!request) {
      this.client.logger.info("session request queue is empty.");
      return;
    }

    try {
      this.sessionRequestQueue.state = ENGINE_QUEUE_STATES.active;
      this.client.events.emit("session_request", request);
    } catch (error) {
      this.client.logger.error(error);
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

  // ---------- Pairing Events ---------------------------------------- //
  private registerPairingEvents() {
    this.client.core.pairing.events.on(PAIRING_EVENTS.create, (pairing: PairingTypes.Struct) =>
      this.onPairingCreated(pairing),
    );
  }

  /**
   * when a pairing is created, we check if there is a pending proposal for it.
   * if there is, we send it to onSessionProposeRequest to be processed as if it was received from the relay.
   * It allows QR/URI to be scanned multiple times without having to create new pairing.
   */
  private onPairingCreated = (pairing: PairingTypes.Struct) => {
    if (pairing.active) return;
    const proposals = this.client.proposal.getAll();
    const proposal = proposals.find((p) => p.pairingTopic === pairing.topic);
    if (!proposal) return;
    this.onSessionProposeRequest(
      pairing.topic,
      formatJsonRpcRequest(
        "wc_sessionPropose",
        {
          requiredNamespaces: proposal.requiredNamespaces,
          optionalNamespaces: proposal.optionalNamespaces,
          relays: proposal.relays,
          proposer: proposal.proposer,
          sessionProperties: proposal.sessionProperties,
        },
        proposal.id,
      ),
    );
  };

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
    );
    if (conformingNamespacesError) throw new Error(conformingNamespacesError.message);
    if (!isValidString(relayProtocol, true)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `approve() relayProtocol: ${relayProtocol}`,
      );
      throw new Error(message);
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

  private getVerifyContext = async (hash: string, metadata: CoreTypes.Metadata) => {
    const context: Verify.Context = {
      verified: {
        verifyUrl: metadata.verifyUrl || VERIFY_SERVER,
        validation: "UNKNOWN",
        origin: metadata.url || "",
      },
    };

    try {
      const result = await this.client.core.verify.resolve({
        attestationId: hash,
        verifyUrl: metadata.verifyUrl,
      });
      if (result) {
        context.verified.origin = result.origin;
        context.verified.isScam = result.isScam;
        context.verified.validation =
          result.origin === new URL(metadata.url).origin ? "VALID" : "INVALID";
      }
    } catch (e) {
      this.client.logger.info(e);
    }

    this.client.logger.info(`Verify context: ${JSON.stringify(context)}`);
    return context;
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
