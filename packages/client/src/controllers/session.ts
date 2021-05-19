import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import {
  IClient,
  ISession,
  SessionTypes,
  SubscriptionEvent,
  CryptoTypes,
} from "@walletconnect/types";
import {
  generateRandomBytes32,
  isSessionFailed,
  isSessionResponded,
  isSubscriptionUpdatedEvent,
  validateSessionProposeParams,
  validateSessionRespondParams,
  isValidationInvalid,
  ERROR,
} from "@walletconnect/utils";
import {
  JsonRpcPayload,
  JsonRpcRequest,
  formatJsonRpcError,
  formatJsonRpcRequest,
  formatJsonRpcResult,
  isJsonRpcRequest,
  JsonRpcResponse,
  isJsonRpcError,
  ErrorResponse,
} from "@json-rpc-tools/utils";

import { Subscription } from "./subscription";
import { JsonRpcHistory } from "./history";
import {
  SESSION_CONTEXT,
  SESSION_EVENTS,
  SESSION_JSONRPC,
  SESSION_STATUS,
  SUBSCRIPTION_EVENTS,
  SESSION_SIGNAL_METHOD_PAIRING,
  SESSION_DEFAULT_TTL,
  FIVE_MINUTES,
  THIRTY_SECONDS,
  RELAYER_DEFAULT_PROTOCOL,
} from "../constants";

export class Session extends ISession {
  public pending: Subscription<SessionTypes.Pending>;
  public settled: Subscription<SessionTypes.Settled>;
  public history: JsonRpcHistory;

  public events = new EventEmitter();

  protected context: string = SESSION_CONTEXT;

  protected config = {
    status: SESSION_STATUS,
    events: SESSION_EVENTS,
    jsonrpc: SESSION_JSONRPC,
  };

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = generateChildLogger(logger, this.context);
    this.pending = new Subscription<SessionTypes.Pending>(
      client,
      this.logger,
      this.config.status.pending,
    );
    this.settled = new Subscription<SessionTypes.Settled>(
      client,
      this.logger,
      this.config.status.settled,
    );
    this.history = new JsonRpcHistory(client, this.logger);
    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.pending.init();
    await this.settled.init();
    await this.history.init();
  }

  public async get(topic: string): Promise<SessionTypes.Settled> {
    return this.settled.get(topic);
  }

  public async ping(topic: string, timeout?: number): Promise<void> {
    const request = { method: this.config.jsonrpc.ping, params: {} };
    return this.request({ topic, request, timeout: timeout || THIRTY_SECONDS * 1000 });
  }

  public async send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void> {
    const settled = await this.settled.get(topic);
    if (isJsonRpcRequest(payload)) {
      if (!Object.values(this.config.jsonrpc).includes(payload.method)) {
        if (!settled.permissions.jsonrpc.methods.includes(payload.method)) {
          const error = ERROR.UNAUTHORIZED_JSON_RPC_METHOD.format({
            method: payload.method,
          });
          this.logger.error(error.message);
          throw new Error(error.message);
        }
        // TODO: session-specific (start)
        if (chainId && !settled.permissions.blockchain.chains.includes(chainId)) {
          const error = ERROR.UNAUTHORIZED_TARGET_CHAIN.format({ chainId });
          this.logger.error(error.message);
          throw new Error(error.message);
        }
        // TODO: session-specific (end)
        await this.history.set(topic, payload, chainId);
        payload = formatJsonRpcRequest<SessionTypes.Request>(
          this.config.jsonrpc.payload,
          {
            chainId,
            request: { method: payload.method, params: payload.params },
          },
          payload.id,
        );
      }
    } else {
      await this.history.update(topic, payload);
    }
    await this.client.relayer.publish(settled.topic, payload, {
      relay: settled.relay,
    });
  }

  get length(): number {
    return this.settled.length;
  }

  get topics(): string[] {
    return this.settled.topics;
  }

  get values(): SessionTypes.Settled[] {
    return this.settled.values.map(x => x.data);
  }

  public create(params: SessionTypes.CreateParams): Promise<SessionTypes.Settled> {
    return new Promise(async (resolve, reject) => {
      this.logger.info(`Create ${this.context}`);
      this.logger.trace({ type: "method", method: "create", params });
      const maxTimeout = params?.timeout || FIVE_MINUTES * 1000;
      const timeout = setTimeout(() => {
        const error = ERROR.SETTLE_TIMEOUT.format({
          context: this.context,
          timeout: maxTimeout,
        });
        this.logger.error(error.message);
        reject(error.message);
      }, maxTimeout);
      let pending: SessionTypes.Pending;
      try {
        pending = await this.propose(params);
      } catch (e) {
        clearTimeout(timeout);
        return reject(e);
      }
      this.pending.on(
        SUBSCRIPTION_EVENTS.updated,
        async (updatedEvent: SubscriptionEvent.Updated<SessionTypes.Pending>) => {
          if (pending.topic !== updatedEvent.data.topic) return;
          if (isSessionResponded(updatedEvent.data)) {
            const outcome = updatedEvent.data.outcome;
            clearTimeout(timeout);
            if (isSessionFailed(outcome)) {
              try {
                await this.pending.delete(pending.topic, outcome.reason);
              } catch (e) {
                return reject(e);
              }
              reject(new Error(outcome.reason.message));
            } else {
              try {
                const settled = await this.settled.get(outcome.topic);
                const reason = ERROR.SETTLED.format({ context: this.context });
                await this.pending.delete(pending.topic, reason);
                resolve(settled);
              } catch (e) {
                return reject(e);
              }
            }
          }
        },
      );
    });
  }

  public async respond(params: SessionTypes.RespondParams): Promise<SessionTypes.Pending> {
    this.logger.info(`Respond ${this.context}`);
    this.logger.trace({ type: "method", method: "respond", params });
    // TODO: session-specific (start)
    const paramsValidation = validateSessionRespondParams(params);
    if (isValidationInvalid(paramsValidation)) {
      this.logger.error(paramsValidation.error.message);
      throw new Error(paramsValidation.error.message);
    }
    // TODO: session-specific (end)
    const { approved, proposal, response } = params;
    const { relay, ttl } = proposal;
    const self = {
      publicKey: await this.client.crypto.generateKeyPair(),
      // TODO: session-specific (next-line)
      metadata: params.response.metadata,
    };
    // TODO: session-specific (next-line)
    const pairing = await this.client.pairing.get(proposal.signal.params.topic);
    // TODO: session-specific (next-line)
    await this.client.crypto.generateSharedKey(pairing.self, pairing.peer, proposal.topic);
    if (approved) {
      try {
        const responder: SessionTypes.Participant = {
          publicKey: self.publicKey,
          // TODO: session-specific (next-line)
          metadata: response.metadata,
        };
        const expiry = Date.now() + proposal.ttl * 1000;
        const state: SessionTypes.State = {
          accounts: params.response.state.accounts,
        };
        const peer: SessionTypes.Participant = {
          publicKey: proposal.proposer.publicKey,
          // TODO: session-specific (next-line)
          metadata: proposal.proposer.metadata,
        };
        const controller = proposal.proposer.controller
          ? { publicKey: peer.publicKey }
          : { publicKey: self.publicKey };
        const permissions: SessionTypes.Permissions = {
          ...proposal.permissions,
          controller,
        };
        const settled = await this.settle({
          relay,
          self,
          peer,
          permissions,
          ttl,
          expiry,
          state,
        });
        const outcome: SessionTypes.Outcome = {
          topic: settled.topic,
          relay,
          state,
          responder,
          expiry,
        };
        const pending: SessionTypes.Pending = {
          status: this.config.status.responded,
          topic: proposal.topic,
          relay,
          self,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      } catch (e) {
        const reason = ERROR.GENERIC.format({ message: e.message });
        const outcome: SessionTypes.Outcome = { reason };
        const pending: SessionTypes.Pending = {
          status: this.config.status.responded,
          topic: proposal.topic,
          relay,
          self,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      }
    } else {
      const defaultReason = ERROR.NOT_APPROVED.format({ context: this.context });
      const outcome = { reason: params?.reason || defaultReason };
      const pending: SessionTypes.Pending = {
        status: this.config.status.responded,
        topic: proposal.topic,
        relay,
        self,
        proposal,
        outcome,
      };
      await this.pending.set(pending.topic, pending, { relay: pending.relay });
      return pending;
    }
  }

  public async upgrade(params: SessionTypes.UpgradeParams): Promise<SessionTypes.Settled> {
    this.logger.info(`Upgrade ${this.context}`);
    this.logger.trace({ type: "method", method: "upgrade", params });
    const settled = await this.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: settled.self.publicKey };
    const upgrade = await this.handleUpgrade(params.topic, params, participant);
    const request = formatJsonRpcRequest(this.config.jsonrpc.upgrade, upgrade);
    await this.send(settled.topic, request);
    return settled;
  }

  public async update(params: SessionTypes.UpdateParams): Promise<SessionTypes.Settled> {
    this.logger.info(`Update ${this.context}`);
    this.logger.trace({ type: "method", method: "update", params });
    const settled = await this.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: settled.self.publicKey };
    const update = await this.handleUpdate(params.topic, params, participant);
    const request = formatJsonRpcRequest(this.config.jsonrpc.update, update);
    await this.send(settled.topic, request);
    return settled;
  }

  public async request(params: SessionTypes.RequestParams): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const request = formatJsonRpcRequest(params.request.method, params.request.params);
      const maxTimeout = params?.timeout || FIVE_MINUTES * 1000;
      const timeout = setTimeout(() => {
        const error = ERROR.JSONRPC_REQUEST_TIMEOUT.format({
          method: request.method,
          timeout: maxTimeout,
        });
        this.logger.error(error.message);
        reject(error.message);
      }, maxTimeout);
      this.events.on(this.config.events.response, (responseEvent: SessionTypes.ResponseEvent) => {
        if (params.topic !== responseEvent.topic) return;
        const response = responseEvent.response;
        if (response.id !== request.id) return;
        clearTimeout(timeout);
        if (isJsonRpcError(response)) {
          const errorMessage = response.error.message;
          this.logger.error(errorMessage);
          return reject(new Error(errorMessage));
        }
        return resolve(response.result);
      });
      try {
        await this.send(params.topic, request, params.chainId);
      } catch (e) {
        clearTimeout(timeout);
        return reject(e);
      }
    });
  }

  public async delete(params: SessionTypes.DeleteParams): Promise<void> {
    this.logger.info(`Delete ${this.context}`);
    this.logger.trace({ type: "method", method: "delete", params });
    this.settled.delete(params.topic, params.reason);
  }

  // TODO: session-specific (start)
  public async notify(params: SessionTypes.NotifyParams): Promise<void> {
    const settled = await this.settled.get(params.topic);
    if (
      settled.self.publicKey !== settled.permissions.controller.publicKey &&
      !settled.permissions.notifications.types.includes(params.type)
    ) {
      const error = ERROR.UNAUTHORIZED_NOTIFICATION_TYPE.format({ type: params.type });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    const notification: SessionTypes.Notification = { type: params.type, data: params.data };
    const request = formatJsonRpcRequest(this.config.jsonrpc.notification, notification);
    await this.send(params.topic, request);
  }
  // TODO: session-specific (end)

  public on(event: string, listener: any): void {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any): void {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any): void {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any): void {
    this.events.removeListener(event, listener);
  }

  // ---------- Protected ----------------------------------------------- //

  protected async propose(params: SessionTypes.ProposeParams): Promise<SessionTypes.Pending> {
    this.logger.info(`Propose ${this.context}`);
    this.logger.trace({ type: "method", method: "propose", params });
    // TODO: session-specific (start)
    const paramsValidation = validateSessionProposeParams(params);
    if (isValidationInvalid(paramsValidation)) {
      this.logger.error(paramsValidation.error.message);
      throw new Error(paramsValidation.error.message);
    }
    if (params.signal.method !== SESSION_SIGNAL_METHOD_PAIRING) {
      throw new Error(`Session proposal signal unsupported`);
    }
    // TODO: session-specific (end)
    const relay = params?.relay || { protocol: RELAYER_DEFAULT_PROTOCOL };
    const topic = generateRandomBytes32();
    const self = {
      publicKey: await this.client.crypto.generateKeyPair(),
      // TODO: session-specific (next-line)
      metadata: params.metadata,
    };
    const proposer: SessionTypes.ProposedPeer = {
      publicKey: self.publicKey,
      // TODO: session-specific (next-line)
      metadata: self.metadata,
      controller: this.client.controller,
    };
    // TODO: session-specific (start)
    const pairing = await this.client.pairing.settled.get(params.signal.params.topic);
    const signal: SessionTypes.Signal = {
      method: SESSION_SIGNAL_METHOD_PAIRING,
      params: { topic: pairing.topic },
    };
    const permissions = params.permissions;
    const ttl = params.ttl || SESSION_DEFAULT_TTL;
    // TODO: session-specific (end)
    const proposal: SessionTypes.Proposal = {
      topic,
      relay,
      proposer,
      signal,
      permissions,
      ttl,
    };
    const pending: SessionTypes.Pending = {
      status: this.config.status.proposed,
      topic: proposal.topic,
      relay: proposal.relay,
      self,
      proposal,
    };
    // TODO: session-specific (next-line)
    await this.client.crypto.generateSharedKey(pairing.self, pairing.peer, proposal.topic);
    await this.pending.set(pending.topic, pending, { relay: pending.relay });
    return pending;
  }

  protected async settle(params: SessionTypes.SettleParams): Promise<SessionTypes.Settled> {
    this.logger.info(`Settle ${this.context}`);
    this.logger.trace({ type: "method", method: "settle", params });
    const topic = await this.client.crypto.generateSharedKey(params.self, params.peer);
    const settled: SessionTypes.Settled = {
      topic,
      relay: params.relay,
      self: params.self,
      peer: params.peer,
      permissions: params.permissions,
      expiry: params.expiry,
      state: params.state,
    };
    await this.settled.set(settled.topic, settled, {
      relay: settled.relay,
      expiry: settled.expiry,
    });
    return settled;
  }

  protected async onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.info(`Receiving ${this.context} response`);
    this.logger.trace({ type: "method", method: "onResponse", topic, payload });
    const request = payload as JsonRpcRequest<SessionTypes.Outcome>;
    const outcome = request.params;
    const pending = await this.pending.get(topic);
    let error: ErrorResponse | undefined;
    if (!isSessionFailed(outcome)) {
      try {
        const controller = pending.proposal.proposer.controller
          ? { publicKey: pending.proposal.proposer.publicKey }
          : { publicKey: outcome.responder.publicKey };
        const peer: SessionTypes.Participant = {
          publicKey: outcome.responder.publicKey,
          // TODO: session-specific (next-line)
          metadata: outcome.responder.metadata,
        };
        const state: SessionTypes.State = outcome.state;
        const permissions: SessionTypes.Permissions = {
          ...pending.proposal.permissions,
          controller,
        };
        const settled = await this.settle({
          relay: pending.relay,
          self: pending.self,
          peer,
          permissions,
          ttl: pending.proposal.ttl,
          expiry: outcome.expiry,
          state,
        });
        await this.pending.update(topic, {
          status: this.config.status.responded,
          outcome: {
            topic: settled.topic,
            relay: settled.relay,
            responder: settled.peer,
            expiry: settled.expiry,
            state: settled.state,
          },
        });
      } catch (e) {
        this.logger.error(e);
        error = ERROR.GENERIC.format({ message: e.message });
        await this.pending.update(topic, {
          status: this.config.status.responded,
          outcome: { reason: error },
        });
      }
      const response =
        typeof error === "undefined"
          ? formatJsonRpcResult(request.id, true)
          : formatJsonRpcError(request.id, error);
      await this.client.relayer.publish(pending.topic, response, {
        relay: pending.relay,
      });
    } else {
      this.logger.error(outcome.reason);
      await this.pending.update(topic, {
        status: this.config.status.responded,
        outcome: { reason: outcome.reason },
      });
    }
  }

  protected async onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.info(`Receiving ${this.context} acknowledge`);
    this.logger.trace({ type: "method", method: "onAcknowledge", topic, payload });
    const response = payload as JsonRpcResponse;
    const pending = await this.pending.get(topic);
    if (!isSessionResponded(pending)) return;
    if (isJsonRpcError(response) && !isSessionFailed(pending.outcome)) {
      await this.settled.delete(pending.outcome.topic, response.error);
    }
    const reason = ERROR.RESPONSE_ACKNOWLEDGED.format({ context: this.context });
    await this.pending.delete(topic, reason);
  }

  protected async onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving ${this.context} message`);
    this.logger.trace({ type: "method", method: "onMessage", topic, payload });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const settled = await this.settled.get(payloadEvent.topic);
      let error: ErrorResponse | undefined;
      switch (request.method) {
        case this.config.jsonrpc.payload:
          await this.onPayload(payloadEvent);
          break;
        case this.config.jsonrpc.update:
          await this.onUpdate(payloadEvent);
          break;
        case this.config.jsonrpc.upgrade:
          await this.onUpgrade(payloadEvent);
          break;
        case this.config.jsonrpc.notification:
          await this.onNotification(payloadEvent);
          break;
        case this.config.jsonrpc.delete:
          await this.settled.delete(settled.topic, request.params.reason);
          break;
        case this.config.jsonrpc.ping:
          await this.send(settled.topic, formatJsonRpcResult(request.id, false));
          break;
        default:
          error = ERROR.UNKNOWN_JSONRPC_METHOD.format({ method: request.method });
          this.logger.error(error.message);
          await this.send(settled.topic, formatJsonRpcError(request.id, error));
          break;
      }
    } else {
      this.onPayloadEvent(payloadEvent);
    }
  }

  protected async onPayload(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    if (isJsonRpcRequest(payload)) {
      const { id, params } = payload as JsonRpcRequest<SessionTypes.Request>;
      const request = formatJsonRpcRequest(params.request.method, params.request.params, id);
      const settled = await this.settled.get(topic);
      if (!settled.permissions.jsonrpc.methods.includes(request.method)) {
        const error = ERROR.UNAUTHORIZED_JSON_RPC_METHOD.format({
          method: request.method,
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      // TODO: session-specific (start)
      const { chainId } = params;
      if (chainId && !settled.permissions.blockchain.chains.includes(chainId)) {
        const error = ERROR.UNAUTHORIZED_TARGET_CHAIN.format({ chainId });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      // TODO: session-specific (end)
      const settledPayloadEvent: SessionTypes.PayloadEvent = {
        topic,
        payload: request,
        // TODO: session-specific (next-line)
        chainId: params.chainId,
      };
      this.logger.debug(`Receiving ${this.context} payload`);
      this.logger.trace({ type: "method", method: "onPayload", ...settledPayloadEvent });
      this.onPayloadEvent(settledPayloadEvent);
    } else {
      const settledPayloadEvent: SessionTypes.PayloadEvent = {
        topic,
        payload,
      };
      this.logger.debug(`Receiving ${this.context} payload`);
      this.logger.trace({ type: "method", method: "onPayload", ...settledPayloadEvent });
      this.onPayloadEvent(settledPayloadEvent);
    }
  }

  protected async onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving ${this.context} update`);
    this.logger.trace({ type: "method", method: "onUpdate", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const settled = await this.settled.get(payloadEvent.topic);
    try {
      const participant: CryptoTypes.Participant = { publicKey: settled.peer.publicKey };
      await this.handleUpdate(topic, request.params, participant);
      const response = formatJsonRpcResult(request.id, true);
      await this.send(settled.topic, response);
    } catch (e) {
      this.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      await this.send(settled.topic, response);
    }
  }

  protected async onUpgrade(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving ${this.context} upgrade`);
    this.logger.trace({ type: "method", method: "onUpgrade", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const settled = await this.settled.get(payloadEvent.topic);
    try {
      const participant: CryptoTypes.Participant = { publicKey: settled.peer.publicKey };
      await this.handleUpgrade(topic, request.params, participant);
      const response = formatJsonRpcResult(request.id, true);
      await this.send(settled.topic, response);
    } catch (e) {
      this.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      await this.send(settled.topic, response);
    }
  }

  protected async handleUpdate(
    topic: string,
    params: SessionTypes.Update,
    participant: CryptoTypes.Participant,
  ): Promise<SessionTypes.Update> {
    const settled = await this.settled.get(topic);
    let update: SessionTypes.Update;
    if (typeof params.state !== "undefined") {
      const state = settled.state;
      if (participant.publicKey !== settled.permissions.controller.publicKey) {
        const error = ERROR.UNAUTHORIZED_UPDATE_REQUEST.format({ context: this.context });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      // TODO: session-specific (next-line)
      state.accounts = params.state.accounts || state.accounts;
      update = { state };
    } else {
      const error = ERROR.INVALID_UPDATE_REQUEST.format({ context: this.context });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    await this.settled.update(settled.topic, settled);
    return update;
  }

  protected async handleUpgrade(
    topic: string,
    params: SessionTypes.Upgrade,
    participant: CryptoTypes.Participant,
  ): Promise<SessionTypes.Upgrade> {
    const settled = await this.settled.get(topic);
    let upgrade: SessionTypes.Upgrade = { permissions: {} };
    if (participant.publicKey !== settled.permissions.controller.publicKey) {
      const error = ERROR.UNAUTHORIZED_UPGRADE_REQUEST.format({ context: this.context });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    const permissions: Omit<SessionTypes.Permissions, "controller"> = {
      jsonrpc: {
        methods: [
          ...settled.permissions.jsonrpc.methods,
          ...(params.permissions.jsonrpc?.methods || []),
        ],
      },
      // TODO: session-specific (start)
      blockchain: {
        chains: [
          ...settled.permissions.blockchain.chains,
          ...(params.permissions.blockchain?.chains || []),
        ],
      },
      notifications: {
        types: [
          ...settled.permissions.notifications?.types,
          ...(params.permissions.notifications?.types || []),
        ],
      },
      // TODO: session-specific (end)
    };
    upgrade = { permissions };
    settled.permissions = { ...permissions, controller: settled.permissions.controller };
    await this.settled.update(settled.topic, settled);
    return upgrade;
  }

  // TODO: session-specific (start)
  protected async onNotification(event: SubscriptionEvent.Payload) {
    const notification = (event.payload as JsonRpcRequest<SessionTypes.Notification>).params;
    const notificationEvent: SessionTypes.NotificationEvent = {
      topic: event.topic,
      type: notification.type,
      data: notification.data,
    };
    this.logger.info(`Emitting ${this.config.events.notification}`);
    this.logger.debug({ type: "event", event: this.config.events.notification, notificationEvent });
    this.events.emit(this.config.events.notification, notificationEvent);
  }
  // TODO: session-specific (end)

  // ---------- Private ----------------------------------------------- //

  private async shouldIgnorePayloadEvent(payloadEvent: SessionTypes.PayloadEvent) {
    const { topic, payload } = payloadEvent;
    if (!this.settled.subscriptions.has(topic)) return true;
    let exists = false;
    try {
      exists = await this.history.exists(topic, payload.id);
    } catch (e) {
      // skip error
    }
    return exists;
  }

  private async onPayloadEvent(payloadEvent: SessionTypes.PayloadEvent) {
    const { topic, payload, chainId } = payloadEvent;
    if (isJsonRpcRequest(payload)) {
      if (await this.shouldIgnorePayloadEvent(payloadEvent)) return;
      await this.history.set(topic, payload, chainId);
    } else {
      await this.history.update(topic, payload);
    }
    if (isJsonRpcRequest(payload)) {
      const requestEvent: SessionTypes.RequestEvent = { topic, request: payload, chainId };
      this.logger.info(`Emitting ${this.config.events.request}`);
      this.logger.debug({ type: "event", event: this.config.events.request, data: requestEvent });
      this.events.emit(this.config.events.request, requestEvent);
    } else {
      const responseEvent: SessionTypes.ResponseEvent = { topic, response: payload, chainId };
      this.logger.info(`Emitting ${this.config.events.response}`);
      this.logger.debug({ type: "event", event: this.config.events.response, data: responseEvent });
      this.events.emit(this.config.events.response, responseEvent);
    }
  }

  private async onPendingPayloadEvent(event: SubscriptionEvent.Payload) {
    if (isJsonRpcRequest(event.payload)) {
      switch (event.payload.method) {
        case this.config.jsonrpc.approve:
        case this.config.jsonrpc.reject:
          this.onResponse(event);
          break;
        default:
          break;
      }
    } else {
      this.onAcknowledge(event);
    }
  }
  private async onPendingStatusEvent(
    event:
      | SubscriptionEvent.Created<SessionTypes.Pending>
      | SubscriptionEvent.Updated<SessionTypes.Pending>,
  ) {
    const pending = event.data;
    if (isSessionResponded(pending)) {
      this.logger.info(`Emitting ${this.config.events.responded}`);
      this.logger.debug({ type: "event", event: this.config.events.responded, data: pending });
      this.events.emit(this.config.events.responded, pending);
      if (!isSubscriptionUpdatedEvent(event)) {
        const method = !isSessionFailed(pending.outcome)
          ? this.config.jsonrpc.approve
          : this.config.jsonrpc.reject;
        const request = formatJsonRpcRequest(method, pending.outcome);
        await this.client.relayer.publish(pending.topic, request, {
          relay: pending.relay,
        });
      }
    } else {
      this.logger.info(`Emitting ${this.config.events.proposed}`);
      this.logger.debug({ type: "event", event: this.config.events.proposed, data: pending });
      this.events.emit(this.config.events.proposed, pending);
      // send proposal signal through existing pairing
      // TODO: session-specific (start)
      const request = formatJsonRpcRequest(this.config.jsonrpc.propose, pending.proposal);
      await this.client.pairing.send(pending.proposal.signal.params.topic, request);
      // TODO: session-specific (end)
    }
  }

  private registerEventListeners(): void {
    // Pending Subscription Events
    this.pending.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onPendingPayloadEvent(payloadEvent),
    );
    this.pending.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<SessionTypes.Pending>) =>
        this.onPendingStatusEvent(createdEvent),
    );
    this.pending.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<SessionTypes.Pending>) =>
        this.onPendingStatusEvent(updatedEvent),
    );
    // Settled Subscription Events
    this.settled.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onMessage(payloadEvent),
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<SessionTypes.Settled>) => {
        const { data: settled } = createdEvent;
        this.logger.info(`Emitting ${this.config.events.settled}`);
        this.logger.debug({ type: "event", event: this.config.events.settled, data: settled });
        this.events.emit(this.config.events.settled, settled);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<SessionTypes.Settled>) => {
        const { data: settled, update } = updatedEvent;
        this.logger.info(`Emitting ${this.config.events.updated}`);
        this.logger.debug({
          type: "event",
          event: this.config.events.updated,
          data: settled,
          update,
        });
        this.events.emit(this.config.events.updated, settled, update);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.deleted,
      async (deletedEvent: SubscriptionEvent.Deleted<SessionTypes.Settled>) => {
        const { data: settled, reason } = deletedEvent;
        this.logger.info(`Emitting ${this.config.events.deleted}`);
        this.logger.debug({
          type: "event",
          event: this.config.events.deleted,
          data: settled,
          reason,
        });
        this.events.emit(this.config.events.deleted, settled, reason);
        const request = formatJsonRpcRequest(this.config.jsonrpc.delete, { reason });
        await this.history.delete(settled.topic);
        await this.client.relayer.publish(settled.topic, request, {
          relay: settled.relay,
        });
      },
    );
    this.settled.on(SUBSCRIPTION_EVENTS.sync, () => this.events.emit(this.config.events.sync));
    this.settled.on(SUBSCRIPTION_EVENTS.enabled, () =>
      this.events.emit(this.config.events.enabled),
    );
    this.settled.on(SUBSCRIPTION_EVENTS.disabled, () =>
      this.events.emit(this.config.events.disabled),
    );
  }
}
