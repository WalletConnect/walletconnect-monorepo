import merge from "lodash.merge";
import { SequenceTypes, ISequence, SubscriptionEvent, CryptoTypes } from "@walletconnect/types";
import {
  generateRandomBytes32,
  isSequenceFailed,
  isSequenceResponded,
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

import {
  SUBSCRIPTION_EVENTS,
  RELAYER_DEFAULT_PROTOCOL,
  FIVE_MINUTES,
  THIRTY_SECONDS,
} from "../constants";

export class Engine {
  constructor(public parent: ISequence) {
    this.parent = parent;
    this.registerEventListeners();
  }

  public async ping(topic: string, timeout?: number): Promise<void> {
    const request = { method: this.parent.config.jsonrpc.ping, params: {} };
    return this.request({ topic, request, timeout: timeout || THIRTY_SECONDS * 1000 });
  }

  public async send(topic: string, payload: JsonRpcPayload): Promise<void> {
    const settled = await this.parent.settled.get(topic);
    if (isJsonRpcRequest(payload)) {
      if (!Object.values(this.parent.config.jsonrpc).includes(payload.method)) {
        if (!settled.permissions.jsonrpc.methods.includes(payload.method)) {
          const error = getError(ERROR.UNAUTHORIZED_JSON_RPC_METHOD, {
            method: payload.method,
          });
          this.parent.logger.error(error.message);
          throw new Error(error.message);
        }
        await this.parent.history.set(topic, payload);
        payload = formatJsonRpcRequest<SequenceTypes.Request>(
          this.parent.config.jsonrpc.payload,
          {
            request: { method: payload.method, params: payload.params },
          },
          payload.id,
        );
      }
    } else {
      await this.parent.history.update(topic, payload);
    }
    await this.parent.client.relayer.publish(settled.topic, payload, {
      relay: settled.relay,
    });
  }

  get length(): number {
    return this.parent.settled.length;
  }

  get topics(): string[] {
    return this.parent.settled.topics;
  }

  get values(): SequenceTypes.Settled[] {
    return this.parent.settled.values.map(x => x.data);
  }

  public create(params?: SequenceTypes.CreateParams): Promise<SequenceTypes.Settled> {
    return new Promise(async (resolve, reject) => {
      this.parent.logger.debug(`Create ${this.parent.context}`);
      this.parent.logger.trace({ type: "method", method: "create", params });
      const maxTimeout = params?.timeout || FIVE_MINUTES * 1000;
      const timeout = setTimeout(() => {
        const error = getError(ERROR.SETTLE_TIMEOUT, {
          context: this.parent.context,
          timeout: maxTimeout,
        });
        this.parent.logger.error(error.message);
        reject(error.message);
      }, maxTimeout);
      let pending: SequenceTypes.Pending;
      try {
        pending = await this.propose(params);
      } catch (e) {
        clearTimeout(timeout);
        return reject(e);
      }
      this.parent.pending.on(
        SUBSCRIPTION_EVENTS.updated,
        async (updatedEvent: SubscriptionEvent.Updated<SequenceTypes.Pending>) => {
          if (pending.topic !== updatedEvent.data.topic) return;
          if (isSequenceResponded(updatedEvent.data)) {
            const outcome = updatedEvent.data.outcome;
            clearTimeout(timeout);
            if (isSequenceFailed(outcome)) {
              try {
                await this.parent.pending.delete(pending.topic, outcome.reason);
              } catch (e) {
                return reject(e);
              }
              reject(new Error(outcome.reason.message));
            } else {
              try {
                const settled = await this.parent.settled.get(outcome.topic);
                const reason = getError(ERROR.SETTLED, { context: this.parent.context });
                await this.parent.pending.delete(pending.topic, reason);
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

  public async respond(params: SequenceTypes.RespondParams): Promise<SequenceTypes.Pending> {
    this.parent.logger.debug(`Respond ${this.parent.context}`);
    this.parent.logger.trace({ type: "method", method: "respond", params });
    const { approved, proposal } = params;
    const { relay, ttl } = proposal;
    const self = { publicKey: await this.parent.client.crypto.generateKeyPair() };
    if (approved) {
      try {
        const responder: SequenceTypes.Participant = {
          publicKey: self.publicKey,
        };
        const expiry = Date.now() + proposal.ttl * 1000;
        const state: SequenceTypes.State = {};
        const peer: SequenceTypes.Participant = {
          publicKey: proposal.proposer.publicKey,
        };
        const controller = proposal.proposer.controller
          ? { publicKey: peer.publicKey }
          : { publicKey: self.publicKey };
        const permissions: SequenceTypes.Permissions = {
          ...proposal.permissions,
          controller,
        };
        const settled = await this.settle({
          relay,
          self,
          peer,
          permissions,
          state,
          ttl,
          expiry,
        });
        const outcome: SequenceTypes.Outcome = {
          topic: settled.topic,
          relay,
          state,
          responder,
          expiry,
        };
        const pending: SequenceTypes.Pending = {
          status: this.parent.config.status.responded as SequenceTypes.RespondedStatus,
          topic: proposal.topic,
          relay,
          self,
          proposal,
          outcome,
        };
        await this.parent.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      } catch (e) {
        const reason = getError(ERROR.GENERIC, { message: e.message });
        const outcome: SequenceTypes.Outcome = { reason };
        const pending: SequenceTypes.Pending = {
          status: this.parent.config.status.responded as SequenceTypes.RespondedStatus,
          topic: proposal.topic,
          relay,
          self,
          proposal,
          outcome,
        };
        await this.parent.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      }
    } else {
      const defaultReason = getError(ERROR.NOT_APPROVED, { context: this.parent.context });
      const outcome: SequenceTypes.Outcome = { reason: params?.reason || defaultReason };
      const pending: SequenceTypes.Pending = {
        status: this.parent.config.status.responded as SequenceTypes.RespondedStatus,
        topic: proposal.topic,
        relay,
        self,
        proposal,
        outcome,
      };
      await this.parent.pending.set(pending.topic, pending, { relay: pending.relay });
      return pending;
    }
  }

  public async upgrade(params: SequenceTypes.UpgradeParams): Promise<SequenceTypes.Settled> {
    this.parent.logger.info(`Upgrade ${this.parent.context}`);
    this.parent.logger.trace({ type: "method", method: "upgrade", params });
    const settled = await this.parent.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: settled.self.publicKey };
    const upgrade = await this.handleUpgrade(params.topic, params, participant);
    const request = formatJsonRpcRequest(this.parent.config.jsonrpc.upgrade, upgrade);
    await this.send(settled.topic, request);
    return settled;
  }

  public async update(params: SequenceTypes.UpdateParams): Promise<SequenceTypes.Settled> {
    this.parent.logger.debug(`Update ${this.parent.context}`);
    this.parent.logger.trace({ type: "method", method: "update", params });
    const settled = await this.parent.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: settled.self.publicKey };
    const update = await this.handleUpdate(params.topic, params, participant);
    const request = formatJsonRpcRequest(this.parent.config.jsonrpc.update, update);
    await this.send(settled.topic, request);
    return settled;
  }

  public async request(params: SequenceTypes.RequestParams): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const request = formatJsonRpcRequest(params.request.method, params.request.params);
      const maxTimeout = params?.timeout || FIVE_MINUTES * 1000;
      const timeout = setTimeout(() => {
        const error = getError(ERROR.JSONRPC_REQUEST_TIMEOUT, {
          method: request.method,
          timeout: maxTimeout,
        });
        this.parent.logger.error(error.message);
        reject(error.message);
      }, maxTimeout);
      this.parent.events.on(
        this.parent.config.events.response,
        (responseEvent: SequenceTypes.ResponseEvent) => {
          if (params.topic !== responseEvent.topic) return;
          const response = responseEvent.response;
          if (response.id !== request.id) return;
          clearTimeout(timeout);
          if (isJsonRpcError(response)) {
            const errorMessage = response.error.message;
            this.parent.logger.error(errorMessage);
            return reject(new Error(errorMessage));
          }
          return resolve(response.result);
        },
      );
      try {
        await this.send(params.topic, request);
      } catch (e) {
        clearTimeout(timeout);
        return reject(e);
      }
    });
  }

  public async delete(params: SequenceTypes.DeleteParams): Promise<void> {
    this.parent.logger.debug(`Delete ${this.parent.context}`);
    this.parent.logger.trace({ type: "method", method: "delete", params });
    await this.parent.settled.delete(params.topic, params.reason);
  }

  public on(event: string, listener: any): void {
    this.parent.events.on(event, listener);
  }

  public once(event: string, listener: any): void {
    this.parent.events.once(event, listener);
  }

  public off(event: string, listener: any): void {
    this.parent.events.off(event, listener);
  }

  public removeListener(event: string, listener: any): void {
    this.parent.events.removeListener(event, listener);
  }

  // ---------- Protected ----------------------------------------------- //

  public async propose(params?: SequenceTypes.ProposeParams): Promise<SequenceTypes.Pending> {
    this.parent.logger.debug(`Propose ${this.parent.context}`);
    this.parent.logger.trace({ type: "method", method: "propose", params });
    const relay = params?.relay || { protocol: RELAYER_DEFAULT_PROTOCOL };
    const topic = (params as any).topic || generateRandomBytes32();
    const self = (params as any).self || {
      publicKey: await this.parent.client.crypto.generateKeyPair(),
    };
    const proposer: SequenceTypes.ProposedPeer = {
      publicKey: self.publicKey,
      controller: this.parent.client.controller,
    };
    const proposal: SequenceTypes.Proposal = {
      relay,
      topic,
      proposer,
      signal: (params as any).signal,
      permissions: (params as any).permissions,
      ttl: (params as any).ttl,
    };
    const pending: SequenceTypes.Pending = {
      status: this.parent.config.status.proposed as SequenceTypes.ProposedStatus,
      topic: proposal.topic,
      relay: proposal.relay,
      self,
      proposal,
    };
    await this.parent.pending.set(pending.topic, pending, { relay });
    return pending;
  }

  public async settle(params: SequenceTypes.SettleParams): Promise<SequenceTypes.Settled> {
    this.parent.logger.debug(`Settle ${this.parent.context}`);
    this.parent.logger.trace({ type: "method", method: "settle", params });
    const topic = await this.parent.client.crypto.generateSharedKey(params.self, params.peer);
    const settled: SequenceTypes.Settled = {
      topic,
      relay: params.relay,
      self: params.self,
      peer: params.peer,
      permissions: params.permissions,
      expiry: params.expiry,
      state: params.state,
    };
    await this.parent.settled.set(settled.topic, settled, {
      relay: settled.relay,
      expiry: settled.expiry,
    });
    return settled;
  }

  public async onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.parent.logger.debug(`Receiving ${this.parent.context} response`);
    this.parent.logger.trace({ type: "method", method: "onResponse", topic, payload });
    const request = payload as JsonRpcRequest<SequenceTypes.Outcome>;
    const outcome = request.params;
    const pending = await this.parent.pending.get(topic);
    let error: ErrorResponse | undefined;
    if (!isSequenceFailed(outcome)) {
      try {
        const controller = pending.proposal.proposer.controller
          ? { publicKey: pending.proposal.proposer.publicKey }
          : { publicKey: outcome.responder.publicKey };
        const peer: SequenceTypes.Participant = { publicKey: outcome.responder.publicKey };
        const state: SequenceTypes.State = {};
        const permissions: SequenceTypes.Permissions = {
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
        await this.parent.pending.update(topic, {
          status: this.parent.config.status.responded as SequenceTypes.RespondedStatus,
          outcome: {
            topic: settled.topic,
            relay: settled.relay,
            responder: outcome.responder,
            expiry: settled.expiry,
            state: settled.state,
          },
        });
      } catch (e) {
        this.parent.logger.error(e);
        error = getError(ERROR.GENERIC, { message: e.message });
        await this.parent.pending.update(topic, {
          status: this.parent.config.status.responded as SequenceTypes.RespondedStatus,
          outcome: { reason: error },
        });
      }
      const response =
        typeof error === "undefined"
          ? formatJsonRpcResult(request.id, true)
          : formatJsonRpcError(request.id, error);
      await this.parent.client.relayer.publish(pending.topic, response, {
        relay: pending.relay,
      });
    } else {
      this.parent.logger.error(outcome.reason);
      await this.parent.pending.update(topic, {
        status: this.parent.config.status.responded as SequenceTypes.RespondedStatus,
        outcome: { reason: outcome.reason },
      });
    }
  }

  public async onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.parent.logger.debug(`Receiving ${this.parent.context} acknowledge`);
    this.parent.logger.trace({ type: "method", method: "onAcknowledge", topic, payload });
    const response = payload as JsonRpcResponse;
    const pending = await this.parent.pending.get(topic);
    if (!isSequenceResponded(pending)) return;
    if (isJsonRpcError(response) && !isSequenceFailed(pending.outcome)) {
      await this.parent.settled.delete(pending.outcome.topic, response.error);
    }
    const reason = getError(ERROR.RESPONSE_ACKNOWLEDGED, { context: this.parent.context });
    await this.parent.pending.delete(topic, reason);
  }

  public async onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.parent.logger.debug(`Receiving ${this.parent.context} message`);
    this.parent.logger.trace({ type: "method", method: "onMessage", topic, payload });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const settled = await this.parent.settled.get(payloadEvent.topic);
      let error: ErrorResponse | undefined;
      switch (request.method) {
        case this.parent.config.jsonrpc.payload:
          await this.onPayload(payloadEvent);
          break;
        case this.parent.config.jsonrpc.update:
          await this.onUpdate(payloadEvent);
          break;
        case this.parent.config.jsonrpc.upgrade:
          await this.onUpgrade(payloadEvent);
          break;
        case this.parent.config.jsonrpc.delete:
          await this.parent.settled.delete(settled.topic, request.params.reason);
          break;
        case this.parent.config.jsonrpc.ping:
          await this.send(settled.topic, formatJsonRpcResult(request.id, false));
          break;
        default:
          error = getError(ERROR.UNKNOWN_JSONRPC_METHOD, { method: request.method });
          this.parent.logger.error(error.message);
          await this.send(settled.topic, formatJsonRpcError(request.id, error));
          break;
      }
    } else {
      this.onPayloadEvent(payloadEvent);
    }
  }

  public async onPayload(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    if (isJsonRpcRequest(payload)) {
      const { id, params } = payload as JsonRpcRequest<SequenceTypes.Request>;
      const request = formatJsonRpcRequest(params.request.method, params.request.params, id);
      const settled = await this.parent.settled.get(topic);
      if (!settled.permissions.jsonrpc.methods.includes(request.method)) {
        const error = getError(ERROR.UNAUTHORIZED_JSON_RPC_METHOD, {
          method: request.method,
        });
        this.parent.logger.error(error.message);
        throw new Error(error.message);
      }
      const settledPayloadEvent: SequenceTypes.PayloadEvent = {
        topic,
        payload: request,
      };
      this.parent.logger.debug(`Receiving ${this.parent.context} payload`);
      this.parent.logger.trace({ type: "method", method: "onPayload", ...settledPayloadEvent });
      this.onPayloadEvent(settledPayloadEvent);
    } else {
      const settledPayloadEvent: SequenceTypes.PayloadEvent = {
        topic,
        payload,
      };
      this.parent.logger.debug(`Receiving ${this.parent.context} payload`);
      this.parent.logger.trace({ type: "method", method: "onPayload", ...settledPayloadEvent });
      this.onPayloadEvent(settledPayloadEvent);
    }
  }

  public async onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.parent.logger.debug(`Receiving ${this.parent.context} update`);
    this.parent.logger.trace({ type: "method", method: "onUpdate", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const settled = await this.parent.settled.get(payloadEvent.topic);
    try {
      const participant: CryptoTypes.Participant = { publicKey: settled.peer.publicKey };
      await this.handleUpdate(topic, request.params, participant);
      const response = formatJsonRpcResult(request.id, true);
      await this.send(settled.topic, response);
    } catch (e) {
      this.parent.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      await this.send(settled.topic, response);
    }
  }

  public async onUpgrade(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.parent.logger.debug(`Receiving ${this.parent.context} upgrade`);
    this.parent.logger.trace({ type: "method", method: "onUpgrade", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const settled = await this.parent.settled.get(payloadEvent.topic);
    try {
      const participant: CryptoTypes.Participant = { publicKey: settled.peer.publicKey };
      await this.handleUpgrade(topic, request.params, participant);
      const response = formatJsonRpcResult(request.id, true);
      await this.send(settled.topic, response);
    } catch (e) {
      this.parent.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      await this.send(settled.topic, response);
    }
  }

  public async handleUpdate(
    topic: string,
    params: SequenceTypes.Update,
    participant: CryptoTypes.Participant,
  ): Promise<SequenceTypes.Update> {
    const settled = await this.parent.settled.get(topic);
    let update: SequenceTypes.Update;
    if (typeof params.state !== "undefined") {
      let state = settled.state;
      if (participant.publicKey !== settled.permissions.controller.publicKey) {
        const error = getError(ERROR.UNAUTHORIZED_UPDATE_REQUEST, { context: this.parent.context });
        this.parent.logger.error(error.message);
        throw new Error(error.message);
      }
      state = merge(state, params.state);
      update = { state };
    } else {
      const error = getError(ERROR.INVALID_UPDATE_REQUEST, { context: this.parent.context });
      this.parent.logger.error(error.message);
      throw new Error(error.message);
    }
    await this.parent.settled.update(settled.topic, settled);
    return update;
  }

  public async handleUpgrade(
    topic: string,
    params: SequenceTypes.Upgrade,
    participant: CryptoTypes.Participant,
  ): Promise<SequenceTypes.Upgrade> {
    const settled = await this.parent.settled.get(topic);
    let upgrade: SequenceTypes.Upgrade = { permissions: {} };
    if (participant.publicKey !== settled.permissions.controller.publicKey) {
      const error = getError(ERROR.UNAUTHORIZED_UPGRADE_REQUEST, { context: this.parent.context });
      this.parent.logger.error(error.message);
      throw new Error(error.message);
    }
    const permissions: Omit<SequenceTypes.Permissions, "controller"> = {
      jsonrpc: {
        methods: [
          ...settled.permissions.jsonrpc.methods,
          ...(params.permissions.jsonrpc?.methods || []),
        ],
      },
    };
    upgrade = { permissions };
    settled.permissions = { ...permissions, controller: settled.permissions.controller };
    await this.parent.settled.update(settled.topic, settled);
    return upgrade;
  }
  // ---------- Private ----------------------------------------------- //

  private async shouldIgnorePayloadEvent(payloadEvent: SequenceTypes.PayloadEvent) {
    const { topic, payload } = payloadEvent;
    if (!this.parent.settled.subscriptions.has(topic)) return true;
    let exists = false;
    try {
      exists = await this.parent.history.exists(topic, payload.id);
    } catch (e) {
      // skip error
    }
    return exists;
  }

  private async onPayloadEvent(payloadEvent: SequenceTypes.PayloadEvent) {
    const { topic, payload } = payloadEvent;
    if (isJsonRpcRequest(payload)) {
      if (await this.shouldIgnorePayloadEvent(payloadEvent)) return;
      await this.parent.history.set(topic, payload);
    } else {
      await this.parent.history.update(topic, payload);
    }
    if (isJsonRpcRequest(payload)) {
      const requestEvent: SequenceTypes.RequestEvent = { topic, request: payload };
      this.parent.logger.info(`Emitting ${this.parent.config.events.request}`);
      this.parent.logger.debug({
        type: "event",
        event: this.parent.config.events.request,
        data: requestEvent,
      });
      this.parent.events.emit(this.parent.config.events.request, requestEvent);
    } else {
      const responseEvent: SequenceTypes.ResponseEvent = { topic, response: payload };
      this.parent.logger.info(`Emitting ${this.parent.config.events.response}`);
      this.parent.logger.debug({
        type: "event",
        event: this.parent.config.events.response,
        data: responseEvent,
      });
      this.parent.events.emit(this.parent.config.events.response, responseEvent);
    }
  }

  private async onPendingPayloadEvent(event: SubscriptionEvent.Payload) {
    if (isJsonRpcRequest(event.payload)) {
      switch (event.payload.method) {
        case this.parent.config.jsonrpc.approve:
        case this.parent.config.jsonrpc.reject:
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
      | SubscriptionEvent.Created<SequenceTypes.Pending>
      | SubscriptionEvent.Updated<SequenceTypes.Pending>,
  ) {
    const pending = event.data;
    if (isSequenceResponded(pending)) {
      this.parent.logger.info(`Emitting ${this.parent.config.events.responded}`);
      this.parent.logger.debug({
        type: "event",
        event: this.parent.config.events.responded,
        data: pending,
      });
      this.parent.events.emit(this.parent.config.events.responded, pending);
      if (!isSubscriptionUpdatedEvent(event)) {
        const method = !isSequenceFailed(pending.outcome)
          ? this.parent.config.jsonrpc.approve
          : this.parent.config.jsonrpc.reject;
        const request = formatJsonRpcRequest(method, pending.outcome);
        await this.parent.client.relayer.publish(pending.topic, request, {
          relay: pending.relay,
        });
      }
    } else {
      this.parent.logger.info(`Emitting ${this.parent.config.events.proposed}`);
      this.parent.logger.debug({
        type: "event",
        event: this.parent.config.events.proposed,
        data: pending,
      });
      this.parent.events.emit(this.parent.config.events.proposed, pending);
      // send proposal signal through uri offlline
    }
  }

  private registerEventListeners(): void {
    // Pending Subscription Events
    this.parent.pending.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onPendingPayloadEvent(payloadEvent),
    );
    this.parent.pending.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<SequenceTypes.Pending>) =>
        this.onPendingStatusEvent(createdEvent),
    );
    this.parent.pending.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<SequenceTypes.Pending>) =>
        this.onPendingStatusEvent(updatedEvent),
    );
    // Settled Subscription Events
    this.parent.settled.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onMessage(payloadEvent),
    );
    this.parent.settled.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<SequenceTypes.Settled>) => {
        const { data: settled } = createdEvent;
        this.parent.logger.info(`Emitting ${this.parent.config.events.settled}`);
        this.parent.logger.debug({
          type: "event",
          event: this.parent.config.events.settled,
          data: settled,
        });
        this.parent.events.emit(this.parent.config.events.settled, settled);
      },
    );
    this.parent.settled.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<SequenceTypes.Settled>) => {
        const { data: settled, update } = updatedEvent;
        this.parent.logger.info(`Emitting ${this.parent.config.events.updated}`);
        this.parent.logger.debug({
          type: "event",
          event: this.parent.config.events.updated,
          data: settled,
          update,
        });
        this.parent.events.emit(this.parent.config.events.updated, settled, update);
      },
    );
    this.parent.settled.on(
      SUBSCRIPTION_EVENTS.deleted,
      async (deletedEvent: SubscriptionEvent.Deleted<SequenceTypes.Settled>) => {
        const { data: settled, reason } = deletedEvent;
        this.parent.logger.info(`Emitting ${this.parent.config.events.deleted}`);
        this.parent.logger.debug({
          type: "event",
          event: this.parent.config.events.deleted,
          data: settled,
          reason,
        });
        this.parent.events.emit(this.parent.config.events.deleted, settled, reason);
        const request = formatJsonRpcRequest(this.parent.config.jsonrpc.delete, { reason });
        await this.parent.history.delete(settled.topic);
        await this.parent.client.relayer.publish(settled.topic, request, { relay: settled.relay });
      },
    );
    this.parent.settled.on(SUBSCRIPTION_EVENTS.sync, () =>
      this.parent.events.emit(this.parent.config.events.sync),
    );
    this.parent.settled.on(SUBSCRIPTION_EVENTS.enabled, () =>
      this.parent.events.emit(this.parent.config.events.enabled),
    );
    this.parent.settled.on(SUBSCRIPTION_EVENTS.disabled, () =>
      this.parent.events.emit(this.parent.config.events.disabled),
    );
  }
}
