import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import {
  PairingTypes,
  IClient,
  IPairing,
  SubscriptionEvent,
  CryptoTypes,
} from "@walletconnect/types";
import {
  generateRandomBytes32,
  isPairingFailed,
  isPairingResponded,
  formatUri,
  isSubscriptionUpdatedEvent,
  ERROR,
  getError,
} from "@walletconnect/utils";
import {
  JsonRpcPayload,
  JsonRpcRequest,
  JsonRpcResponse,
  formatJsonRpcError,
  formatJsonRpcRequest,
  formatJsonRpcResult,
  isJsonRpcError,
  isJsonRpcRequest,
  ErrorResponse,
} from "@json-rpc-tools/utils";

import { Subscription } from "./subscription";
import { JsonRpcHistory } from "./history";
import {
  PAIRING_CONTEXT,
  PAIRING_EVENTS,
  PAIRING_JSONRPC,
  PAIRING_STATUS,
  SUBSCRIPTION_EVENTS,
  RELAYER_DEFAULT_PROTOCOL,
  PAIRING_SIGNAL_METHOD_URI,
  SESSION_JSONRPC,
  PAIRING_DEFAULT_TTL,
  FIVE_MINUTES,
  THIRTY_SECONDS,
} from "../constants";

export class Pairing extends IPairing {
  public pending: Subscription<PairingTypes.Pending>;
  public settled: Subscription<PairingTypes.Settled>;
  public history: JsonRpcHistory;

  public events = new EventEmitter();

  protected context: string = PAIRING_CONTEXT;

  protected config = {
    status: PAIRING_STATUS,
    events: PAIRING_EVENTS,
    jsonrpc: PAIRING_JSONRPC,
  };

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = generateChildLogger(logger, this.context);
    this.pending = new Subscription<PairingTypes.Pending>(
      client,
      this.logger,
      this.config.status.pending,
    );
    this.settled = new Subscription<PairingTypes.Settled>(
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

  public async get(topic: string): Promise<PairingTypes.Settled> {
    return this.settled.get(topic);
  }

  public async ping(topic: string, timeout?: number): Promise<void> {
    const request = { method: this.config.jsonrpc.ping, params: {} };
    return this.request({ topic, request, timeout: timeout || THIRTY_SECONDS * 1000 });
  }

  public async send(topic: string, payload: JsonRpcPayload): Promise<void> {
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
        await this.history.set(topic, payload);
        payload = formatJsonRpcRequest<PairingTypes.Request>(
          this.config.jsonrpc.payload,
          {
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

  get values(): PairingTypes.Settled[] {
    return this.settled.values.map(x => x.data);
  }

  public create(params?: PairingTypes.CreateParams): Promise<PairingTypes.Settled> {
    return new Promise(async (resolve, reject) => {
      this.logger.debug(`Create ${this.context}`);
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
      let pending: PairingTypes.Pending;
      try {
        pending = await this.propose(params);
      } catch (e) {
        clearTimeout(timeout);
        return reject(e);
      }
      this.pending.on(
        SUBSCRIPTION_EVENTS.updated,
        async (updatedEvent: SubscriptionEvent.Updated<PairingTypes.Pending>) => {
          if (pending.topic !== updatedEvent.data.topic) return;
          if (isPairingResponded(updatedEvent.data)) {
            const outcome = updatedEvent.data.outcome;
            clearTimeout(timeout);
            if (isPairingFailed(outcome)) {
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

  public async respond(params: PairingTypes.RespondParams): Promise<PairingTypes.Pending> {
    this.logger.debug(`Respond ${this.context}`);
    this.logger.trace({ type: "method", method: "respond", params });
    const { approved, proposal } = params;
    const self = { publicKey: await this.client.crypto.generateKeyPair() };
    if (approved) {
      try {
        const responder: PairingTypes.Participant = {
          publicKey: self.publicKey,
        };
        const expiry = Date.now() + proposal.ttl * 1000;
        const controller = proposal.proposer.controller
          ? { publicKey: proposal.proposer.publicKey }
          : { publicKey: self.publicKey };
        const sequence = await this.settle({
          relay: proposal.relay,
          self,
          peer: { publicKey: proposal.proposer.publicKey },
          permissions: {
            ...proposal.permissions,
            controller,
          },
          state: {},
          ttl: proposal.ttl,
          expiry,
        });
        const outcome: PairingTypes.Outcome = {
          topic: sequence.topic,
          relay: sequence.relay,
          responder,
          expiry,
          state: {},
        };
        const pending: PairingTypes.Pending = {
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
        const outcome: PairingTypes.Outcome = { reason };
        const pending: PairingTypes.Pending = {
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
      const outcome: PairingTypes.Outcome = { reason: params?.reason || defaultReason };
      const pending: PairingTypes.Pending = {
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

  public async upgrade(params: PairingTypes.UpgradeParams): Promise<PairingTypes.Settled> {
    this.logger.info(`Upgrade ${this.context}`);
    this.logger.trace({ type: "method", method: "upgrade", params });
    const sequence = await this.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: sequence.self.publicKey };
    const upgrade = await this.handleUpgrade(params.topic, params, participant);
    const request = formatJsonRpcRequest(this.config.jsonrpc.upgrade, upgrade);
    await this.send(sequence.topic, request);
    return sequence;
  }

  public async update(params: PairingTypes.UpdateParams): Promise<PairingTypes.Settled> {
    this.logger.debug(`Update ${this.context}`);
    this.logger.trace({ type: "method", method: "update", params });
    const sequence = await this.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: sequence.self.publicKey };
    const update = await this.handleUpdate(params.topic, params, participant);
    const request = formatJsonRpcRequest(this.config.jsonrpc.update, update);
    await this.send(sequence.topic, request);
    return sequence;
  }

  public async request(params: PairingTypes.RequestParams): Promise<any> {
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
      this.events.on(this.config.events.response, (responseEvent: PairingTypes.ResponseEvent) => {
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
        await this.send(params.topic, request);
      } catch (e) {
        clearTimeout(timeout);
        return reject(e);
      }
    });
  }

  public async delete(params: PairingTypes.DeleteParams): Promise<void> {
    this.logger.debug(`Delete ${this.context}`);
    this.logger.trace({ type: "method", method: "delete", params });
    await this.settled.delete(params.topic, params.reason);
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

  protected async propose(params?: PairingTypes.ProposeParams): Promise<PairingTypes.Pending> {
    this.logger.debug(`Propose ${this.context}`);
    this.logger.trace({ type: "method", method: "propose", params });
    const relay = params?.relay || { protocol: RELAYER_DEFAULT_PROTOCOL };
    const topic = generateRandomBytes32();
    const self = { publicKey: await this.client.crypto.generateKeyPair() };
    const proposer: PairingTypes.ProposedPeer = {
      publicKey: self.publicKey,
      controller: this.client.controller,
    };
    const uri = formatUri({
      protocol: this.client.protocol,
      version: this.client.version,
      topic: topic,
      publicKey: proposer.publicKey,
      controller: proposer.controller,
      relay: relay,
    });
    const signal: PairingTypes.Signal = {
      method: PAIRING_SIGNAL_METHOD_URI,
      params: { uri },
    };
    const permissions: PairingTypes.ProposedPermissions = {
      jsonrpc: {
        methods: [SESSION_JSONRPC.propose],
      },
    };
    const proposal: PairingTypes.Proposal = {
      relay,
      topic,
      proposer,
      signal,
      permissions,
      ttl: PAIRING_DEFAULT_TTL,
    };
    const pending: PairingTypes.Pending = {
      status: this.config.status.proposed,
      topic: proposal.topic,
      relay: proposal.relay,
      self,
      proposal,
    };
    await this.pending.set(pending.topic, pending, { relay });
    return pending;
  }

  protected async settle(params: PairingTypes.SettleParams): Promise<PairingTypes.Settled> {
    this.logger.debug(`Settle ${this.context}`);
    this.logger.trace({ type: "method", method: "settle", params });
    const topic = await this.client.crypto.generateSharedKey(params.self, params.peer);
    const sequence: PairingTypes.Settled = {
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
    this.logger.debug(`Receiving ${this.context} response`);
    this.logger.trace({ type: "method", method: "onResponse", topic, payload });
    const request = payload as JsonRpcRequest<PairingTypes.Outcome>;
    const pending = await this.pending.get(topic);
    let error: ErrorResponse | undefined;
    if (!isPairingFailed(request.params)) {
      try {
        const controller = pending.proposal.proposer.controller
          ? { publicKey: pending.proposal.proposer.publicKey }
          : { publicKey: request.params.responder.publicKey };
        const sequence = await this.settle({
          relay: pending.relay,
          self: pending.self,
          peer: { publicKey: request.params.responder.publicKey },
          permissions: {
            ...pending.proposal.permissions,
            controller,
          },
          ttl: pending.proposal.ttl,
          expiry: request.params.expiry,
          state: {},
        });
        await this.pending.update(topic, {
          status: this.config.status.responded,
          outcome: {
            topic: sequence.topic,
            relay: sequence.relay,
            responder: request.params.responder,
            expiry: sequence.expiry,
            state: {},
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
      await this.client.relayer.publish(pending.topic, response, { relay: pending.relay });
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
    this.logger.debug(`Receiving ${this.context} acknowledge`);
    this.logger.trace({ type: "method", method: "onAcknowledge", topic, payload });
    const response = payload as JsonRpcResponse;
    const pending = await this.pending.get(topic);
    if (!isPairingResponded(pending)) return;
    if (isJsonRpcError(response) && !isPairingFailed(pending.outcome)) {
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
      const { id, params } = payload as JsonRpcRequest<PairingTypes.Request>;
      const request = formatJsonRpcRequest(params.request.method, params.request.params, id);
      const sequence = await this.settled.get(topic);
      if (!sequence.permissions.jsonrpc.methods.includes(request.method)) {
        const error = getError(ERROR.UNAUTHORIZED_JSON_RPC_METHOD, {
          method: request.method,
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      const sequencePayloadEvent: PairingTypes.PayloadEvent = {
        topic,
        payload: request,
      };
      this.logger.debug(`Receiving ${this.context} payload`);
      this.logger.trace({ type: "method", method: "onPayload", ...sequencePayloadEvent });
      this.onPayloadEvent(sequencePayloadEvent);
    } else {
      const sequencePayloadEvent: PairingTypes.PayloadEvent = {
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
    params: PairingTypes.Update,
    participant: CryptoTypes.Participant,
  ): Promise<PairingTypes.Update> {
    const sequence = await this.settled.get(topic);
    let update: PairingTypes.Update;
    if (typeof params.state !== "undefined") {
      const state = sequence.state;
      if (participant.publicKey !== sequence.permissions.controller.publicKey) {
        const error = getError(ERROR.UNAUTHORIZED_UPDATE_REQUEST, { context: this.context });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      state.metadata = params.state.metadata || state.metadata;
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
    params: PairingTypes.Upgrade,
    participant: CryptoTypes.Participant,
  ): Promise<PairingTypes.Upgrade> {
    const sequence = await this.settled.get(topic);
    let upgrade: PairingTypes.Upgrade = { permissions: {} };
    if (participant.publicKey !== sequence.permissions.controller.publicKey) {
      const error = getError(ERROR.UNAUTHORIZED_UPGRADE_REQUEST, { context: this.context });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    const permissions: Omit<PairingTypes.Permissions, "controller"> = {
      jsonrpc: {
        methods: [
          ...sequence.permissions.jsonrpc.methods,
          ...(params.permissions.jsonrpc?.methods || []),
        ],
      },
    };
    upgrade = { permissions };
    sequence.permissions = { ...permissions, controller: sequence.permissions.controller };
    await this.settled.update(sequence.topic, sequence);
    return upgrade;
  }
  // ---------- Private ----------------------------------------------- //

  private async shouldIgnorePayloadEvent(payloadEvent: PairingTypes.PayloadEvent) {
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

  private async onPayloadEvent(payloadEvent: PairingTypes.PayloadEvent) {
    const { topic, payload } = payloadEvent;
    if (isJsonRpcRequest(payload)) {
      if (await this.shouldIgnorePayloadEvent(payloadEvent)) return;
      await this.history.set(topic, payload);
    } else {
      await this.history.update(topic, payload);
    }
    if (isJsonRpcRequest(payload)) {
      const requestEvent: PairingTypes.RequestEvent = { topic, request: payload };
      this.logger.info(`Emitting ${this.config.events.request}`);
      this.logger.debug({ type: "event", event: this.config.events.request, data: requestEvent });
      this.events.emit(this.config.events.request, requestEvent);
    } else {
      const responseEvent: PairingTypes.ResponseEvent = { topic, response: payload };
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
      | SubscriptionEvent.Created<PairingTypes.Pending>
      | SubscriptionEvent.Updated<PairingTypes.Pending>,
  ) {
    const pending = event.data;
    if (isPairingResponded(pending)) {
      this.logger.info(`Emitting ${this.config.events.responded}`);
      this.logger.debug({ type: "event", event: this.config.events.responded, data: pending });
      this.events.emit(this.config.events.responded, pending);
      if (!isSubscriptionUpdatedEvent(event)) {
        const method = !isPairingFailed(pending.outcome)
          ? this.config.jsonrpc.approve
          : this.config.jsonrpc.reject;
        const request = formatJsonRpcRequest(method, pending.outcome);
        await this.client.relayer.publish(pending.topic, request, { relay: pending.relay });
      }
    } else {
      this.logger.info(`Emitting ${this.config.events.proposed}`);
      this.logger.debug({ type: "event", event: this.config.events.proposed, data: pending });
      this.events.emit(this.config.events.proposed, pending);
      // send proposal signal through uri offlline
    }
  }

  private registerEventListeners(): void {
    // Pending Subscription Events
    this.pending.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onPendingPayloadEvent(payloadEvent),
    );
    this.pending.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<PairingTypes.Pending>) =>
        this.onPendingStatusEvent(createdEvent),
    );
    this.pending.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<PairingTypes.Pending>) =>
        this.onPendingStatusEvent(updatedEvent),
    );
    // Settled Subscription Events
    this.settled.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onMessage(payloadEvent),
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<PairingTypes.Settled>) => {
        const { data: sequence } = createdEvent;
        this.logger.info(`Emitting ${this.config.events.settled}`);
        this.logger.debug({ type: "event", event: this.config.events.settled, data: sequence });
        this.events.emit(this.config.events.settled, sequence);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<PairingTypes.Settled>) => {
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
      async (deletedEvent: SubscriptionEvent.Deleted<PairingTypes.Settled>) => {
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
        await this.client.relayer.publish(sequence.topic, request, { relay: sequence.relay });
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
