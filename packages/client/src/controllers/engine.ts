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
  RelayerTypes,
  EnginePrivate,
  SessionTypes,
  JsonRpcTypes,
} from "@walletconnect/types";
import {
  calcExpiry,
  formatUri,
  generateRandomBytes32,
  parseUri,
  createDelayedPromise,
  ERROR,
} from "@walletconnect/utils";
import { RELAYER_EVENTS, RELAYER_DEFAULT_PROTOCOL } from "../constants";

export default class Engine extends IEngine {
  constructor(client: IEngine["client"]) {
    super(client);
    this.registerRelayerEvents();
    this.registerExpirerEvents();
  }

  // ---------- Public ------------------------------------------------ //

  public connect: IEngine["connect"] = async params => {
    // TODO(ilja) validation
    const { pairingTopic, methods, events, chains, relays } = params;
    let topic = pairingTopic;
    let uri: string | undefined = undefined;
    let active = false;

    if (topic) {
      const pairing = await this.client.pairing.get(topic);
      active = pairing.active;
    }

    if (!topic || !active) {
      const { topic: newTopic, uri: newUri } = await this.createPairing();
      topic = newTopic;
      uri = newUri;
    }

    const publicKey = await this.client.crypto.generateKeyPair();
    const proposal = {
      methods: methods ?? [],
      events: events ?? [],
      chains: chains ?? [],
      relays: relays ?? [{ protocol: RELAYER_DEFAULT_PROTOCOL }],
      proposer: {
        publicKey,
        metadata: this.client.metadata,
      },
    };

    const { reject, resolve, done: approval } = createDelayedPromise<SessionTypes.Struct>();
    this.client.events.once("internal_connect_done", async ({ error, data }) => {
      if (error) reject(error);
      else if (data) {
        data.self.publicKey = publicKey;
        await this.client.session.set(data.topic, data);
        resolve(data);
      }
    });

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
    await this.client.crypto.setPairingKey(symKey, topic);
    await this.client.relayer.subscribe(topic, { relay });
    // TODO(ilja) this.expirer / timeout pairing ?

    return pairing;
  };

  public approve: IEngine["approve"] = async params => {
    // TODO(ilja) validation
    const { id, relayProtocol, accounts, methods, events } = params;
    const { pairingTopic, proposer } = await this.client.proposal.get(id);
    const selfPublicKey = await this.client.crypto.generateKeyPair();
    const peerPublicKey = proposer.publicKey;
    const topic = await this.client.crypto.generateSessionKey(selfPublicKey, peerPublicKey);
    const sessionSettle = {
      relay: {
        protocol: relayProtocol ?? "waku",
      },
      accounts,
      methods,
      events,
      controller: {
        publicKey: selfPublicKey,
        metadata: this.client.metadata,
      },
      expiry: calcExpiry(SEVEN_DAYS),
    };
    await this.client.relayer.subscribe(topic);
    await this.sendRequest(topic, "wc_sessionSettle", sessionSettle);

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

    const session = {
      ...sessionSettle,
      topic,
      acknowledged: false,
      self: sessionSettle.controller,
      peer: {
        publicKey: proposer.publicKey,
        metadata: proposer.metadata,
      },
      controller: selfPublicKey,
    };
    await this.client.session.set(topic, session);

    const { done: acknowledged, resolve, reject } = createDelayedPromise<SessionTypes.Struct>();
    this.client.events.once("internal_approve_done", async ({ error }) => {
      if (error) reject(error);
      else resolve(await this.client.session.get(topic));
    });

    return { topic, acknowledged };
  };

  public reject: IEngine["reject"] = async params => {
    // TODO(ilja) validation
    const { id, reason } = params;
    const { pairingTopic } = await this.client.proposal.get(id);
    if (pairingTopic && id) {
      await this.sendError(id, pairingTopic, reason);
      await this.client.proposal.delete(id, ERROR.DELETED.format());
    }
  };

  public updateAccounts: IEngine["updateAccounts"] = async params => {
    // TODO(ilja) validation
    const { topic, accounts } = params;
    await this.sendRequest(topic, "wc_sessionUpdateAccounts", { accounts });
    const { done, resolve, reject } = createDelayedPromise<void>();
    this.client.events.once("internal_update_accounts_done", ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await done();
    await this.client.session.update(topic, { accounts });
  };

  public updateMethods: IEngine["updateMethods"] = async params => {
    // TODO(ilja) validation
    const { topic, methods } = params;
    await this.sendRequest(topic, "wc_sessionUpdateMethods", { methods });
    const { done, resolve, reject } = createDelayedPromise<void>();
    this.client.events.once("internal_update_methods_done", ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await done();
    await this.client.session.update(topic, { methods });
  };

  public updateEvents: IEngine["updateEvents"] = async params => {
    // TODO(ilja) validation
    const { topic, events } = params;
    await this.sendRequest(topic, "wc_sessionUpdateEvents", { events });
    const { done, resolve, reject } = createDelayedPromise<void>();
    this.client.events.once("internal_update_events_done", ({ error }) => {
      if (error) reject(error);
      else resolve();
    });
    await done();
    await this.client.session.update(topic, { events });
  };

  public updateExpiry: IEngine["updateExpiry"] = async () => {
    // TODO
  };

  public request: IEngine["request"] = async () => {
    // TODO
  };

  public respond: IEngine["respond"] = async () => {
    // TODO
  };

  public ping: IEngine["ping"] = async params => {
    // TODO(ilja) validation
    const { topic } = params;
    if (this.client.session.keys.includes(topic)) {
      await this.sendRequest(topic, "wc_sessionPing", {});
      const { done, resolve, reject } = createDelayedPromise<void>();
      this.client.events.once("internal_session_ping_done", ({ error }) => {
        if (error) reject(error);
        else resolve();
      });
      await done();
    } else if (this.client.pairing.keys.includes(topic)) {
      await this.sendRequest(topic, "wc_pairingPing", {});
      const { done, resolve, reject } = createDelayedPromise<void>();
      this.client.events.once("internal_pairing_ping_done", ({ error }) => {
        if (error) reject(error);
        else resolve();
      });
      await done();
    }
  };

  public emit: IEngine["emit"] = async () => {
    // TODO
  };

  public disconnect: IEngine["disconnect"] = async params => {
    // TODO(ilja) validation
    const { topic } = params;
    if (this.client.session.keys.includes(topic)) {
      await this.sendRequest(topic, "wc_sessionDelete", ERROR.DELETED.format());
      const { done, resolve, reject } = createDelayedPromise<void>();
      this.client.events.once("internal_session_delete_done", ({ error }) => {
        if (error) reject(error);
        else resolve();
      });
      await done();
    } else if (this.client.pairing.keys.includes(topic)) {
      await this.sendRequest(topic, "wc_pairingDelete", ERROR.DELETED.format());
      const { done, resolve, reject } = createDelayedPromise<void>();
      this.client.events.once("internal_pairing_delete_done", ({ error }) => {
        if (error) reject(error);
        else resolve();
      });
      await done();
    }
  };

  // ---------- Private ----------------------------------------------- //

  private async createPairing() {
    const symKey = generateRandomBytes32();
    const topic = await this.client.crypto.setPairingKey(symKey);
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
    await this.client.relayer.subscribe(topic);
    // TODO(ilja) this.expirer / timeout pairing ?

    return { topic, uri };
  }

  private async activatePairing(topic: string) {
    await this.client.pairing.update(topic, {
      active: true,
      expiry: calcExpiry(THIRTY_DAYS),
    });
  }

  private sendRequest: EnginePrivate["sendRequest"] = async (topic, method, params) => {
    // TODO(ilja) validation
    const payload = formatJsonRpcRequest(method, params);
    const message = await this.client.crypto.encode(topic, payload);
    await this.client.relayer.publish(topic, message);
    await this.client.history.set(topic, payload);

    return payload.id;
  };

  private sendResult: EnginePrivate["sendResult"] = async (id, topic, result) => {
    // TODO(ilja) validation
    const payload = formatJsonRpcResult(id, result);
    const message = await this.client.crypto.encode(topic, payload);
    await this.client.relayer.publish(topic, message);
    await this.client.history.resolve(payload);
  };

  private sendError: EnginePrivate["sendError"] = async (id, topic, error) => {
    // TODO(ilja) validation
    const payload = formatJsonRpcError(id, error);
    const message = await this.client.crypto.encode(topic, payload);
    await this.client.relayer.publish(topic, message);
    await this.client.history.resolve(payload);
  };

  // ---------- Relay Events Router ----------------------------------- //

  private registerRelayerEvents() {
    this.client.relayer.on(RELAYER_EVENTS.message, async (event: RelayerTypes.MessageEvent) => {
      const { topic, message } = event;
      const payload = await this.client.crypto.decode(topic, message);
      if (isJsonRpcRequest(payload)) {
        await this.client.history.set(topic, payload);
        this.onRelayEventRequest({ topic, payload });
      } else if (isJsonRpcResponse(payload)) {
        await this.client.history.resolve(payload);
        this.onRelayEventResponse({ topic, payload });
      }
    });
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
      case "wc_sessionUpdateMethods":
        return this.onSessionUpdateMethodsRequest(topic, payload);
      case "wc_sessionUpdateEvents":
        return this.onSessionUpdateEventsRequest(topic, payload);
      case "wc_sessionPing":
        return this.onSessionPingRequest(topic, payload);
      case "wc_pairingPing":
        return this.onPairingPingRequest(topic, payload);
      case "wc_sessionDelete":
        return this.onSessionDeleteRequest(topic, payload);
      case "wc_pairingDelete":
        return this.onPairingDeleteRequest(topic, payload);
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
      case "wc_sessionUpdateMethods":
        return this.onSessionUpdateMethodsResponse(topic, payload);
      case "wc_sessionUpdateEvents":
        return this.onSessionUpdateEventsResponse(topic, payload);
      case "wc_sessionPing":
        return this.onSessionPingResponse(topic, payload);
      case "wc_pairingPing":
        return this.onPairingPingResponse(topic, payload);
      case "wc_sessionDelete":
        return this.onSessionDeleteResponse(topic, payload);
      case "wc_pairingDelete":
        return this.onPairingDeleteResponse(topic, payload);
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
      const proposal = await this.client.proposal.get(id);
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
      const sessionTopic = await this.client.crypto.generateSessionKey(
        selfPublicKey,
        peerPublicKey,
      );
      this.client.logger.trace({
        type: "method",
        method: "onSessionProposeResponse",
        sessionTopic,
      });
      const subscriptionId = await this.client.relayer.subscribe(sessionTopic);
      this.client.logger.trace({
        type: "method",
        method: "onSessionProposeResponse",
        subscriptionId,
      });
      await this.activatePairing(topic);
    } else if (isJsonRpcError(payload)) {
      await this.client.proposal.delete(id, ERROR.DELETED.format());
      this.client.events.emit("internal_connect_done", { error: payload.error });
    }
  };

  private onSessionSettleRequest: EnginePrivate["onSessionSettleRequest"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { relay, controller, expiry, accounts, methods, events } = payload.params;
    const session = {
      topic,
      relay,
      expiry,
      accounts,
      methods,
      events,
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
    this.client.events.emit("internal_connect_done", { data: session });
  };

  private onSessionSettleResponse: EnginePrivate["onSessionSettleResponse"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    if (isJsonRpcResult(payload)) {
      await this.client.session.update(topic, { acknowledged: true });
      this.client.events.emit("internal_approve_done", {});
    } else if (isJsonRpcError(payload)) {
      await this.client.session.delete(topic, ERROR.DELETED.format());
      this.client.events.emit("internal_approve_done", { error: payload.error });
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
    this.client.events.emit("update_accounts", params.accounts);
  };

  private onSessionUpdateAccountsResponse: EnginePrivate["onSessionUpdateAccountsResponse"] = (
    _topic,
    payload,
  ) => {
    // TODO(ilja) validation
    if (isJsonRpcResult(payload)) {
      this.client.events.emit("internal_update_accounts_done", {});
    } else if (isJsonRpcError(payload)) {
      this.client.events.emit("internal_update_accounts_done", { error: payload.error });
    }
  };

  private onSessionUpdateMethodsRequest: EnginePrivate["onSessionUpdateMethodsRequest"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { params, id } = payload;
    await this.client.session.update(topic, { methods: params.methods });
    await this.sendResult<"wc_sessionUpdateMethods">(id, topic, true);
    this.client.events.emit("update_methods", params.methods);
  };

  private onSessionUpdateMethodsResponse: EnginePrivate["onSessionUpdateMethodsResponse"] = (
    _topic,
    payload,
  ) => {
    // TODO(ilja) validation
    if (isJsonRpcResult(payload)) {
      this.client.events.emit("internal_update_methods_done", {});
    } else if (isJsonRpcError(payload)) {
      this.client.events.emit("internal_update_methods_done", { error: payload.error });
    }
  };

  private onSessionUpdateEventsRequest: EnginePrivate["onSessionUpdateEventsRequest"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { params, id } = payload;
    await this.client.session.update(topic, { events: params.events });
    await this.sendResult<"wc_sessionUpdateEvents">(id, topic, true);
    this.client.events.emit("update_events", params.events);
  };

  private onSessionUpdateEventsResponse: EnginePrivate["onSessionUpdateEventsResponse"] = (
    _topic,
    payload,
  ) => {
    // TODO(ilja) validation
    if (isJsonRpcResult(payload)) {
      this.client.events.emit("internal_update_events_done", {});
    } else if (isJsonRpcError(payload)) {
      this.client.events.emit("internal_update_events_done", { error: payload.error });
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
    if (isJsonRpcResult(payload)) {
      this.client.events.emit("internal_session_ping_done", {});
    } else if (isJsonRpcError(payload)) {
      this.client.events.emit("internal_session_ping_done", { error: payload.error });
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
    if (isJsonRpcResult(payload)) {
      this.client.events.emit("internal_pairing_ping_done", {});
    } else if (isJsonRpcError(payload)) {
      this.client.events.emit("internal_pairing_ping_done", { error: payload.error });
    }
  };

  private onSessionDeleteRequest: EnginePrivate["onSessionDeleteRequest"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { id } = payload;
    await this.client.relayer.unsubscribe(topic);
    await this.sendResult<"wc_sessionDelete">(id, topic, true);
    await this.client.session.delete(topic, ERROR.DELETED.format());
    await this.client.crypto.deleteSessionKey(topic);
    this.client.events.emit("session_delete", { topic });
  };

  private onSessionDeleteResponse: EnginePrivate["onSessionDeleteResponse"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    if (isJsonRpcResult(payload)) {
      await this.client.relayer.unsubscribe(topic);
      await this.client.session.delete(topic, ERROR.DELETED.format());
      await this.client.crypto.deleteSessionKey(topic);
      this.client.events.emit("internal_session_delete_done", {});
    } else if (isJsonRpcError(payload)) {
      this.client.events.emit("internal_session_delete_done", { error: payload.error });
    }
  };

  private onPairingDeleteRequest: EnginePrivate["onPairingDeleteRequest"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    const { id } = payload;
    await this.client.relayer.unsubscribe(topic);
    await this.sendResult<"wc_pairingDelete">(id, topic, true);
    await this.client.pairing.delete(topic, ERROR.DELETED.format());
    await this.client.crypto.deletePairingKey(topic);
    this.client.events.emit("pairing_delete", { topic });
  };

  private onPairingDeleteResponse: EnginePrivate["onPairingDeleteResponse"] = async (
    topic,
    payload,
  ) => {
    // TODO(ilja) validation
    if (isJsonRpcResult(payload)) {
      await this.client.relayer.unsubscribe(topic);
      await this.client.pairing.delete(topic, ERROR.DELETED.format());
      await this.client.crypto.deletePairingKey(topic);
      this.client.events.emit("internal_pairing_delete_done", {});
    } else if (isJsonRpcError(payload)) {
      this.client.events.emit("internal_pairing_delete_done", { error: payload.error });
    }
  };

  // ---------- Expirer Events ----------------------------------------- //

  private registerExpirerEvents() {
    // TODO
  }
}
