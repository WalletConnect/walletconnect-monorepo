import EventEmmiter from "events";
import { RELAYER_EVENTS, RELAYER_DEFAULT_PROTOCOL } from "@walletconnect/core";
import { EXPIRER_EVENTS } from "../constants";
import {
  formatJsonRpcRequest,
  formatJsonRpcResult,
  formatJsonRpcError,
  isJsonRpcRequest,
  isJsonRpcResponse,
  isJsonRpcResult,
  isJsonRpcError,
} from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES, SEVEN_DAYS, THIRTY_DAYS } from "@walletconnect/time";
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
    // TODO(ilja) validation
    const { pairingTopic, namespaces, relays } = params;
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
      namespaces: namespaces ?? [],
      relays: relays ?? [{ protocol: RELAYER_DEFAULT_PROTOCOL }],
      proposer: {
        publicKey,
        metadata: this.client.metadata,
      },
    };

    const { reject, resolve, done: approval } = createDelayedPromise<SessionTypes.Struct>();
    this.events.once<"connect">(engineEvent("connect"), async ({ error, data }) => {
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
    // TODO(ilja) validation
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
    // TODO(ilja) validation
    const { id, relayProtocol, accounts, namespaces } = params;
    const { pairingTopic, proposer } = this.client.proposal.get(id);

    const selfPublicKey = await this.client.core.crypto.generateKeyPair();
    const peerPublicKey = proposer.publicKey;
    const sessionTopic = await this.client.core.crypto.generateSharedKey(
      selfPublicKey,
      peerPublicKey,
    );
    const sessionExpiry = calcExpiry(SEVEN_DAYS);
    const sessionSettle = {
      relay: {
        protocol: relayProtocol ?? "waku",
      },
      accounts,
      namespaces,
      controller: {
        publicKey: selfPublicKey,
        metadata: this.client.metadata,
      },
      expiry: sessionExpiry,
    };

    await this.client.core.relayer.subscribe(sessionTopic);
    const requestId = await this.sendRequest(sessionTopic, "wc_sessionSettle", sessionSettle);
    const { done: acknowledged, resolve, reject } = createDelayedPromise<SessionTypes.Struct>();
    this.events.once(engineEvent("approve", requestId), ({ error }) => {
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
    await this.setExpiry(sessionTopic, sessionExpiry);

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
    // TODO(ilja) validation
    const { id, reason } = params;
    const { pairingTopic } = this.client.proposal.get(id);
    if (pairingTopic && id) {
      await this.sendError(id, pairingTopic, reason);
      await this.client.proposal.delete(id, ERROR.DELETED.format());
    }
  };

  public updateAccounts: IEngine["updateAccounts"] = async params => {
    // TODO(ilja) validation
    const { topic, accounts } = params;
    const id = await this.sendRequest(topic, "wc_sessionUpdateAccounts", { accounts });
    const { done, resolve, reject } = createDelayedPromise<void>();
    this.events.once(engineEvent("update_accounts", id), ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await done();

    await this.client.session.update(topic, { accounts });
  };

  public updateNamespaces: IEngine["updateNamespaces"] = async params => {
    // TODO(ilja) validation
    const { topic, namespaces } = params;
    const id = await this.sendRequest(topic, "wc_sessionUpdateNamespaces", { namespaces });
    const { done, resolve, reject } = createDelayedPromise<void>();
    this.events.once(engineEvent("update_namespaces", id), ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await done();
    await this.client.session.update(topic, { namespaces });
  };

  public updateExpiry: IEngine["updateExpiry"] = async params => {
    // TODO(ilja) validate
    const { topic, expiry } = params;
    const id = await this.sendRequest(topic, "wc_sessionUpdateExpiry", { expiry });
    const { done, resolve, reject } = createDelayedPromise<void>();
    this.events.once(engineEvent("update_expiry", id), ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await done();
    await this.setExpiry(topic, expiry);
  };

  public request: IEngine["request"] = async params => {
    // TODO(ilja) Validation
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
    const { topic, response } = params;
    const { id } = response;
    if (isJsonRpcResult(response)) {
      await this.sendResult(id, topic, response.result);
    } else if (isJsonRpcError(response)) {
      await this.sendError(id, topic, response.error);
    }
  };

  public ping: IEngine["ping"] = async params => {
    // TODO(ilja) validation
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
    } else {
      const error = ERROR.NO_MATCHING_TOPIC.format({
        context: "pairing or session",
        topic,
      });
      throw new Error(error.message);
    }
  };

  public emit: IEngine["emit"] = async params => {
    // TODO(ilja) validation
    const { topic, event, chainId } = params;
    await this.sendRequest(topic, "wc_sessionEvent", { event, chainId });
  };

  public disconnect: IEngine["disconnect"] = async params => {
    // TODO(ilja) validation
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
    await this.client.pairing.update(topic, { active: true });
    await this.setExpiry(topic, calcExpiry(THIRTY_DAYS));
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
    // TODO(ilja) validation
    const payload = formatJsonRpcRequest(method, params);
    const message = await this.client.core.crypto.encode(topic, payload);
    await this.client.core.relayer.publish(topic, message);
    this.client.history.set(topic, payload);

    return payload.id;
  };

  private sendResult: EnginePrivate["sendResult"] = async (id, topic, result) => {
    // TODO(ilja) validation
    const payload = formatJsonRpcResult(id, result);
    const message = this.client.core.crypto.encode(topic, payload);
    await this.client.core.relayer.publish(topic, message);
    await this.client.history.resolve(payload);
  };

  private sendError: EnginePrivate["sendError"] = async (id, topic, error) => {
    // TODO(ilja) validation
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
    // TODO(ilja) validation
    const { topic, payload } = event;
    const reqMethod = payload.method as JsonRpcTypes.WcMethod;

    switch (reqMethod) {
      case "wc_sessionPropose":
        return this.onSessionProposeRequest(topic, payload);
      case "wc_sessionSettle":
        return this.onSessionSettleRequest(topic, payload);
      case "wc_sessionUpdateAccounts":
        return this.onSessionUpdateAccountsRequest(topic, payload);
      case "wc_sessionUpdateNamespaces":
        return this.onSessionUpdateNamespacesRequest(topic, payload);
      case "wc_sessionUpdateExpiry":
        return this.onSessionUpdateExpiryRequest(topic, payload);
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
    // TODO(ilja) validation
    const { topic, payload } = event;
    const record = await this.client.history.get(topic, payload.id);
    const resMethod = record.request.method as JsonRpcTypes.WcMethod;

    switch (resMethod) {
      case "wc_sessionPropose":
        return this.onSessionProposeResponse(topic, payload);
      case "wc_sessionSettle":
        return this.onSessionSettleResponse(topic, payload);
      case "wc_sessionUpdateAccounts":
        return this.onSessionUpdateAccountsResponse(topic, payload);
      case "wc_sessionUpdateNamespaces":
        return this.onSessionUpdateNamespacesResponse(topic, payload);
      case "wc_sessionUpdateExpiry":
        return this.onSessionUpdateExpiryResponse(topic, payload);
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
    // TODO(ilja) validation
    const { params, id: id } = payload;
    await this.client.proposal.set(id, {
      id,
      pairingTopic: topic,
      ...params,
    });
    this.client.events.emit("session_proposal", { id, ...params });
  };

  private onSessionProposeResponse: EnginePrivate["onSessionProposeResponse"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
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
      this.events.emit(engineEvent("connect"), { error: payload.error });
    }
  };

  private onSessionSettleRequest: EnginePrivate["onSessionSettleRequest"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { relay, controller, expiry, accounts, namespaces } = payload.params;
    const session = {
      topic,
      relay,
      expiry,
      accounts,
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
    this.events.emit(engineEvent("connect"), { data: session });
  };

  private onSessionSettleResponse: EnginePrivate["onSessionSettleResponse"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      await this.client.session.update(topic, { acknowledged: true });
      this.events.emit(engineEvent("approve", id), {});
    } else if (isJsonRpcError(payload)) {
      await this.client.session.delete(topic, ERROR.DELETED.format());
      this.events.emit(engineEvent("approve", id), { error: payload.error });
    }
  };

  private onSessionUpdateAccountsRequest: EnginePrivate["onSessionUpdateAccountsRequest"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { params, id } = payload;
    await this.client.session.update(topic, { accounts: params.accounts });
    await this.sendResult<"wc_sessionUpdateAccounts">(id, topic, true);
    this.client.events.emit("update_accounts", { topic, accounts: params.accounts });
  };

  private onSessionUpdateAccountsResponse: EnginePrivate["onSessionUpdateAccountsResponse"] = (
    _topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("update_accounts", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("update_accounts", id), { error: payload.error });
    }
  };

  private onSessionUpdateNamespacesRequest: EnginePrivate["onSessionUpdateNamespacesRequest"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { params, id } = payload;
    await this.client.session.update(topic, { namespaces: params.namespaces });
    await this.sendResult<"wc_sessionUpdateNamespaces">(id, topic, true);
    this.client.events.emit("update_namespaces", { topic, namespaces: params.namespaces });
  };

  private onSessionUpdateNamespacesResponse: EnginePrivate["onSessionUpdateNamespacesResponse"] = (
    _topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("update_namespaces", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("update_namespaces", id), { error: payload.error });
    }
  };

  private onSessionUpdateExpiryRequest: EnginePrivate["onSessionUpdateExpiryRequest"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { params, id } = payload;
    await this.setExpiry(topic, params.expiry);
    await this.sendResult<"wc_sessionUpdateExpiry">(id, topic, true);
    this.client.events.emit("update_expiry", { topic, expiry: params.expiry });
  };

  private onSessionUpdateExpiryResponse: EnginePrivate["onSessionUpdateExpiryResponse"] = (
    _topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("update_expiry", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("update_expiry", id), { error: payload.error });
    }
  };

  private onSessionPingRequest: EnginePrivate["onSessionPingRequest"] = async (topic, payload) => {
    // TODO(ilja) validation
    const { id } = payload;
    await this.sendResult<"wc_sessionPing">(id, topic, true);
    this.client.events.emit("session_ping", { topic });
  };

  private onSessionPingResponse: EnginePrivate["onSessionPingResponse"] = (_topic, payload) => {
    // TODO(ilja) validation
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("session_ping", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("session_ping", id), { error: payload.error });
    }
  };

  private onPairingPingRequest: EnginePrivate["onPairingPingRequest"] = async (topic, payload) => {
    // TODO(ilja) validation
    const { id } = payload;
    await this.sendResult<"wc_pairingPing">(id, topic, true);
    this.client.events.emit("pairing_ping", { topic });
  };

  private onPairingPingResponse: EnginePrivate["onPairingPingResponse"] = (_topic, payload) => {
    // TODO(ilja) validation
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
    // TODO(ilja) validation
    const { id } = payload;
    await this.sendResult<"wc_sessionDelete">(id, topic, true);
    await this.deleteSession(topic);
    this.client.events.emit("session_delete", { topic });
  };

  private onSessionDeleteResponse: EnginePrivate["onSessionDeleteResponse"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
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
    // TODO(ilja) validation
    const { id } = payload;
    await this.sendResult<"wc_pairingDelete">(id, topic, true);
    await this.deletePairing(topic);
    this.client.events.emit("pairing_delete", { topic });
  };

  private onPairingDeleteResponse: EnginePrivate["onPairingDeleteResponse"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      await this.deletePairing(topic);
      this.events.emit(engineEvent("pairing_delete", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("pairing_delete", id), { error: payload.error });
    }
  };

  private onSessionRequest: EnginePrivate["onSessionRequest"] = async (topic, payload) => {
    // TODO(ilja) validation
    const { namespaces } = this.client.session.get(topic);
    const { id, params } = payload;
    const { chainId, request } = params;
    const isChain = chainId && namespaces.some(n => n.chains.includes(chainId));
    const isMethod = namespaces.some(n => n.methods.includes(request.method));

    if (!isChain) {
      await this.sendError(id, topic, ERROR.UNSUPPORTED_CHAINS.format());
    } else if (!isMethod) {
      await this.sendError(id, topic, ERROR.UNAUTHORIZED_JSON_RPC_METHOD.format());
    } else {
      this.client.events.emit("request", { topic, request, chainId });
    }
  };

  private onSessionRequestResponse: EnginePrivate["onSessionRequestResponse"] = (
    _topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("request", id), { data: payload.result });
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("request", id), { error: payload.error });
    }
  };

  private onSessionEventRequest: EnginePrivate["onSessionEventRequest"] = (topic, payload) => {
    // TODO(ilja) validation
    const { event, chainId } = payload.params;
    this.client.events.emit("event", { topic, event, chainId });
  };

  // ---------- Expirer Events ----------------------------------------- //

  private registerExpirerEvents() {
    this.client.expirer.on(EXPIRER_EVENTS.expired, async (event: ExpirerTypes.Expiration) => {
      const { topic } = event;
      if (this.client.session.keys.includes(topic)) {
        await this.deleteSession(topic);
        this.client.events.emit("session_delete", { topic });
      } else if (this.client.pairing.keys.includes(topic)) {
        await this.deletePairing(topic);
        this.client.events.emit("pairing_delete", { topic });
      }
    });
  }
}
