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
  getError,
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
    const sequence = await this.settled.get(topic);
    if (isJsonRpcRequest(payload)) {
      if (!Object.values(this.config.jsonrpc).includes(payload.method)) {
        if (!sequence.permissions.jsonrpc.methods.includes(payload.method)) {
          const error = getError(ERROR.UNAUTHORIZED_JSON_RPC_METHOD, {
            method: payload.method,
          });
          this.logger.error(error.message);
          throw new Error(error.message);
        }
        if (
          typeof chainId !== "undefined" &&
          !sequence.permissions.blockchain.chains.includes(chainId)
        ) {
          const error = getError(ERROR.UNAUTHORIZED_TARGET_CHAIN, { chainId });
          this.logger.error(error.message);
          throw new Error(error.message);
        }
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
    await this.client.relayer.publish(sequence.topic, payload, {
      relay: sequence.relay,
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
        const error = getError(ERROR.SETTLE_TIMEOUT, {
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
                const sequence = await this.settled.get(outcome.topic);
                const reason = getError(ERROR.SETTLED, { context: this.context });
                await this.pending.delete(pending.topic, reason);
                resolve(sequence);
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
    const paramsValidation = validateSessionRespondParams(params);
    if (isValidationInvalid(paramsValidation)) {
      this.logger.error(paramsValidation.error.message);
      throw new Error(paramsValidation.error.message);
    }
    const { approved, proposal, response } = params;
    const { relay } = proposal;
    const self = {
      publicKey: await this.client.crypto.generateKeyPair(),
      metadata: params.response.metadata,
    };
    const pairing = await this.client.pairing.get(proposal.signal.params.topic);
    await this.client.crypto.generateSharedKey(pairing.self, pairing.peer, proposal.topic);
    if (approved) {
      try {
        const responder: SessionTypes.Participant = {
          publicKey: self.publicKey,
          metadata: response.metadata,
        };
        const expiry = Date.now() + proposal.ttl * 1000;
        const state: SessionTypes.State = {
          accounts: params.response.state.accounts,
        };
        const controller = proposal.proposer.controller
          ? { publicKey: proposal.proposer.publicKey }
          : { publicKey: self.publicKey };
        const sequence = await this.settle({
          relay,
          self,
          peer: proposal.proposer,
          permissions: {
            ...proposal.permissions,
            controller,
          },
          ttl: proposal.ttl,
          expiry,
          state,
        });
        const outcome: SessionTypes.Outcome = {
          topic: sequence.topic,
          relay: sequence.relay,
          state: sequence.state,
          responder,
          expiry,
        };
        const pending: SessionTypes.Pending = {
          status: this.config.status.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          self,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      } catch (e) {
        const reason = getError(ERROR.GENERIC, { message: e.message });
        const outcome: SessionTypes.Outcome = { reason };
        const pending: SessionTypes.Pending = {
          status: this.config.status.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          self,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      }
    } else {
      const defaultReason = getError(ERROR.NOT_APPROVED, { context: this.context });
      const outcome = { reason: params?.reason || defaultReason };
      const pending: SessionTypes.Pending = {
        status: this.config.status.responded,
        topic: proposal.topic,
        relay: proposal.relay,
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
    const sequence = await this.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: sequence.self.publicKey };
    const upgrade = await this.handleUpgrade(params.topic, params, participant);
    const request = formatJsonRpcRequest(this.config.jsonrpc.upgrade, upgrade);
    await this.send(sequence.topic, request);
    return sequence;
  }

  public async update(params: SessionTypes.UpdateParams): Promise<SessionTypes.Settled> {
    this.logger.info(`Update ${this.context}`);
    this.logger.trace({ type: "method", method: "update", params });
    const sequence = await this.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: sequence.self.publicKey };
    const update = await this.handleUpdate(params.topic, params, participant);
    const request = formatJsonRpcRequest(this.config.jsonrpc.update, update);
    await this.send(sequence.topic, request);
    return sequence;
  }

  public async request(params: SessionTypes.RequestParams): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const request = formatJsonRpcRequest(params.request.method, params.request.params);
      const maxTimeout = params?.timeout || FIVE_MINUTES * 1000;
      const timeout = setTimeout(() => {
        const error = getError(ERROR.JSONRPC_REQUEST_TIMEOUT, {
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

  public async notify(params: SessionTypes.NotifyParams): Promise<void> {
    const sequence = await this.settled.get(params.topic);
    if (
      sequence.self.publicKey !== sequence.permissions.controller.publicKey &&
      !sequence.permissions.notifications.types.includes(params.type)
    ) {
      const error = getError(ERROR.UNAUTHORIZED_NOTIFICATION_TYPE, { type: params.type });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    const notification: SessionTypes.Notification = { type: params.type, data: params.data };
    const request = formatJsonRpcRequest(this.config.jsonrpc.notification, notification);
    await this.send(params.topic, request);
  }

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
    const paramsValidation = validateSessionProposeParams(params);
    if (isValidationInvalid(paramsValidation)) {
      this.logger.error(paramsValidation.error.message);
      throw new Error(paramsValidation.error.message);
    }
    if (params.signal.method !== SESSION_SIGNAL_METHOD_PAIRING) {
      throw new Error(`Session proposal signal unsupported`);
    }
    const pairing = await this.client.pairing.settled.get(params.signal.params.topic);
    const signal: SessionTypes.Signal = {
      method: SESSION_SIGNAL_METHOD_PAIRING,
      params: { topic: pairing.topic },
    };
    const topic = generateRandomBytes32();
    const self = {
      publicKey: await this.client.crypto.generateKeyPair(),
      metadata: params.metadata,
    };
    const proposer: SessionTypes.ProposedPeer = {
      publicKey: self.publicKey,
      metadata: self.metadata,
      controller: this.client.controller,
    };
    const proposal: SessionTypes.Proposal = {
      topic,
      relay: params.relay,
      proposer,
      signal,
      permissions: params.permissions,
      ttl: params.ttl || SESSION_DEFAULT_TTL,
    };
    const pending: SessionTypes.Pending = {
      status: this.config.status.proposed,
      topic: proposal.topic,
      relay: proposal.relay,
      self,
      proposal,
    };
    await this.client.crypto.generateSharedKey(pairing.self, pairing.peer, proposal.topic);
    await this.pending.set(pending.topic, pending, { relay: pending.relay });
    return pending;
  }

  protected async settle(params: SessionTypes.SettleParams): Promise<SessionTypes.Settled> {
    this.logger.info(`Settle ${this.context}`);
    this.logger.trace({ type: "method", method: "settle", params });
    const topic = await this.client.crypto.generateSharedKey(params.self, params.peer);
    const sequence: SessionTypes.Settled = {
      topic,
      relay: params.relay,
      self: params.self,
      peer: params.peer,
      permissions: params.permissions,
      expiry: params.expiry,
      state: params.state,
    };
    await this.settled.set(sequence.topic, sequence, {
      relay: sequence.relay,
      expiry: sequence.expiry,
    });
    return sequence;
  }

  protected async onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.info(`Receiving ${this.context} response`);
    this.logger.trace({ type: "method", method: "onResponse", topic, payload });
    const request = payload as JsonRpcRequest<SessionTypes.Outcome>;
    const pending = await this.pending.get(topic);
    let error: ErrorResponse | undefined;
    if (!isSessionFailed(request.params)) {
      try {
        const controller = pending.proposal.proposer.controller
          ? { publicKey: pending.proposal.proposer.publicKey }
          : { publicKey: request.params.responder.publicKey };
        const sequence = await this.settle({
          relay: pending.relay,
          self: pending.self,
          peer: request.params.responder,
          permissions: {
            ...pending.proposal.permissions,
            controller,
          },
          ttl: pending.proposal.ttl,
          expiry: request.params.expiry,
          state: request.params.state,
        });
        await this.pending.update(topic, {
          status: this.config.status.responded,
          outcome: {
            topic: sequence.topic,
            relay: sequence.relay,
            responder: sequence.peer,
            expiry: sequence.expiry,
            state: sequence.state,
          },
        });
      } catch (e) {
        this.logger.error(e);
        error = getError(ERROR.GENERIC, { message: e.message });
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
      this.logger.error(request.params.reason);
      await this.pending.update(topic, {
        status: this.config.status.responded,
        outcome: { reason: request.params.reason },
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
    const reason = getError(ERROR.RESPONSE_ACKNOWLEDGED, { context: this.context });
    await this.pending.delete(topic, reason);
  }

  protected async onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving ${this.context} message`);
    this.logger.trace({ type: "method", method: "onMessage", topic, payload });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const sequence = await this.settled.get(payloadEvent.topic);
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
          await this.settled.delete(sequence.topic, request.params.reason);
          break;
        case this.config.jsonrpc.ping:
          await this.send(sequence.topic, formatJsonRpcResult(request.id, false));
          break;
        default:
          error = getError(ERROR.UNKNOWN_JSONRPC_METHOD, { method: request.method });
          this.logger.error(error.message);
          await this.send(sequence.topic, formatJsonRpcError(request.id, error));
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
      const sequence = await this.settled.get(topic);
      if (!sequence.permissions.jsonrpc.methods.includes(request.method)) {
        const error = getError(ERROR.UNAUTHORIZED_JSON_RPC_METHOD, {
          method: request.method,
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      const sequencePayloadEvent: SessionTypes.PayloadEvent = {
        topic,
        payload: request,
        chainId: params.chainId,
      };
      this.logger.debug(`Receiving ${this.context} payload`);
      this.logger.trace({ type: "method", method: "onPayload", ...sequencePayloadEvent });
      this.onPayloadEvent(sequencePayloadEvent);
    } else {
      const sequencePayloadEvent: SessionTypes.PayloadEvent = {
        topic,
        payload,
      };
      this.logger.debug(`Receiving ${this.context} payload`);
      this.logger.trace({ type: "method", method: "onPayload", ...sequencePayloadEvent });
      this.onPayloadEvent(sequencePayloadEvent);
    }
  }

  protected async onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving ${this.context} update`);
    this.logger.trace({ type: "method", method: "onUpdate", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const sequence = await this.settled.get(payloadEvent.topic);
    try {
      const participant: CryptoTypes.Participant = { publicKey: sequence.peer.publicKey };
      await this.handleUpdate(topic, request.params, participant);
      const response = formatJsonRpcResult(request.id, true);
      await this.send(sequence.topic, response);
    } catch (e) {
      this.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      await this.send(sequence.topic, response);
    }
  }

  protected async onUpgrade(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving ${this.context} upgrade`);
    this.logger.trace({ type: "method", method: "onUpgrade", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const sequence = await this.settled.get(payloadEvent.topic);
    try {
      const participant: CryptoTypes.Participant = { publicKey: sequence.peer.publicKey };
      await this.handleUpgrade(topic, request.params, participant);
      const response = formatJsonRpcResult(request.id, true);
      await this.send(sequence.topic, response);
    } catch (e) {
      this.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      await this.send(sequence.topic, response);
    }
  }

  protected async handleUpdate(
    topic: string,
    params: SessionTypes.Update,
    participant: CryptoTypes.Participant,
  ): Promise<SessionTypes.Update> {
    const sequence = await this.settled.get(topic);
    let update: SessionTypes.Update;
    if (typeof params.state !== "undefined") {
      const state = sequence.state;
      if (participant.publicKey !== sequence.permissions.controller.publicKey) {
        const error = getError(ERROR.UNAUTHORIZED_UPDATE_REQUEST, { context: this.context });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      state.accounts = params.state.accounts || state.accounts;
      update = { state };
    } else {
      const error = getError(ERROR.INVALID_UPDATE_REQUEST, { context: this.context });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    await this.settled.update(sequence.topic, sequence);
    return update;
  }

  protected async handleUpgrade(
    topic: string,
    params: SessionTypes.Upgrade,
    participant: CryptoTypes.Participant,
  ): Promise<SessionTypes.Upgrade> {
    const sequence = await this.settled.get(topic);
    let upgrade: SessionTypes.Upgrade = { permissions: {} };
    if (participant.publicKey !== sequence.permissions.controller.publicKey) {
      const error = getError(ERROR.UNAUTHORIZED_UPGRADE_REQUEST, { context: this.context });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    const permissions: Omit<SessionTypes.Permissions, "controller"> = {
      blockchain: {
        chains: [
          ...sequence.permissions.blockchain.chains,
          ...(params.permissions.blockchain?.chains || []),
        ],
      },
      jsonrpc: {
        methods: [
          ...sequence.permissions.jsonrpc.methods,
          ...(params.permissions.jsonrpc?.methods || []),
        ],
      },
      notifications: {
        types: [
          ...sequence.permissions.notifications?.types,
          ...(params.permissions.notifications?.types || []),
        ],
      },
    };
    upgrade = { permissions };
    sequence.permissions = { ...permissions, controller: sequence.permissions.controller };
    await this.settled.update(sequence.topic, sequence);
    return upgrade;
  }

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
        const pairing = await this.client.pairing.get(pending.proposal.signal.params.topic);
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
      const request = formatJsonRpcRequest(this.config.jsonrpc.propose, pending.proposal);
      await this.client.pairing.send(pending.proposal.signal.params.topic, request);
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
        const { data: sequence } = createdEvent;
        this.logger.info(`Emitting ${this.config.events.settled}`);
        this.logger.debug({ type: "event", event: this.config.events.settled, data: sequence });
        this.events.emit(this.config.events.settled, sequence);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<SessionTypes.Settled>) => {
        const { data: sequence, update } = updatedEvent;
        this.logger.info(`Emitting ${this.config.events.updated}`);
        this.logger.debug({
          type: "event",
          event: this.config.events.updated,
          data: sequence,
          update,
        });
        this.events.emit(this.config.events.updated, sequence, update);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.deleted,
      async (deletedEvent: SubscriptionEvent.Deleted<SessionTypes.Settled>) => {
        const { data: sequence, reason } = deletedEvent;
        this.logger.info(`Emitting ${this.config.events.deleted}`);
        this.logger.debug({
          type: "event",
          event: this.config.events.deleted,
          data: sequence,
          reason,
        });
        this.events.emit(this.config.events.deleted, sequence, reason);
        const request = formatJsonRpcRequest(this.config.jsonrpc.delete, { reason });
        await this.history.delete(sequence.topic);
        await this.client.relayer.publish(sequence.topic, request, {
          relay: sequence.relay,
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
