import {
  SequenceTypes,
  ISequence,
  SubscriptionEvent,
  IEngine,
  SessionTypes,
} from "@walletconnect/types";
import {
  generateRandomBytes32,
  hasOverlap,
  isSignalTypePairing,
  isSequenceFailed,
  isSequenceResponded,
  isSubscriptionUpdatedEvent,
  ERROR,
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
} from "@walletconnect/jsonrpc-utils";

import {
  SUBSCRIPTION_EVENTS,
  RELAYER_DEFAULT_PROTOCOL,
  FIVE_MINUTES,
  THIRTY_SECONDS,
} from "../constants";

export class Engine extends IEngine {
  public sequence: ISequence;

  constructor(sequence: any) {
    super(sequence);
    this.sequence = sequence;
    this.registerEventListeners();
  }

  public async find(
    permissions: Partial<SequenceTypes.Permissions>,
  ): Promise<SequenceTypes.Settled[]> {
    return this.sequence.values.filter((settled: SequenceTypes.Settled) => {
      let isCompatible = false;
      if (
        settled.permissions?.jsonrpc &&
        permissions.jsonrpc?.methods &&
        hasOverlap(permissions.jsonrpc.methods, settled.permissions.jsonrpc.methods)
      ) {
        isCompatible = true;
      }
      if (
        settled.permissions?.blockchain &&
        permissions.blockchain?.chains &&
        hasOverlap(permissions.blockchain.chains, settled.permissions.blockchain.chains)
      ) {
        isCompatible = true;
      }
      if (
        settled.permissions?.notifications &&
        permissions.notifications?.types &&
        hasOverlap(permissions.notifications.types, settled.permissions.notifications.types)
      ) {
        isCompatible = true;
      }
      return isCompatible;
    });
  }

  public async ping(topic: string, timeout?: number): Promise<void> {
    const request = { method: this.sequence.config.jsonrpc.ping, params: {} };
    return this.request({ topic, request, timeout: timeout || THIRTY_SECONDS * 1000 });
  }

  public async send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void> {
    const settled = await this.sequence.settled.get(topic);
    if (isJsonRpcRequest(payload)) {
      if (!Object.values(this.sequence.config.jsonrpc).includes(payload.method)) {
        await this.isJsonRpcAuthorized(topic, settled.self, payload);
        await this.sequence.validateRequest({ topic, request: payload, chainId });
        await this.sequence.history.set(topic, payload, chainId);
        const params = {
          chainId,
          request: { method: payload.method, params: payload.params },
        };
        if (!params.chainId) delete params.chainId;
        payload = formatJsonRpcRequest<SequenceTypes.Request>(
          this.sequence.config.jsonrpc.payload,
          params,
          payload.id,
        );
      }
    } else {
      await this.sequence.history.update(topic, payload);
    }
    await this.sequence.client.relayer.publish(settled.topic, payload, {
      relay: settled.relay,
    });
  }

  get length(): number {
    return this.sequence.settled.length;
  }

  get topics(): string[] {
    return this.sequence.settled.topics;
  }

  get values(): SequenceTypes.Settled[] {
    return this.sequence.settled.values.map(x => x.data);
  }

  public create(params?: SequenceTypes.CreateParams): Promise<SequenceTypes.Settled> {
    return new Promise(async (resolve, reject) => {
      this.sequence.logger.debug(`Create ${this.sequence.context}`);
      this.sequence.logger.trace({ type: "method", method: "create", params });
      const maxTimeout = params?.timeout || FIVE_MINUTES * 1000;
      const timeout = setTimeout(() => {
        const error = ERROR.SETTLE_TIMEOUT.format({
          context: this.sequence.context,
          timeout: maxTimeout,
        });
        this.sequence.logger.error(error.message);
        reject(error.message);
      }, maxTimeout);
      let pending: SequenceTypes.Pending;
      try {
        pending = await this.propose(params);
      } catch (e) {
        clearTimeout(timeout);
        return reject(e);
      }
      this.sequence.pending.on(
        SUBSCRIPTION_EVENTS.updated,
        async (updatedEvent: SubscriptionEvent.Updated<SequenceTypes.Pending>) => {
          if (pending.topic !== updatedEvent.data.topic) return;
          if (isSequenceResponded(updatedEvent.data)) {
            const outcome = updatedEvent.data.outcome;
            clearTimeout(timeout);
            if (isSequenceFailed(outcome)) {
              try {
                await this.sequence.pending.delete(pending.topic, outcome.reason);
              } catch (e) {
                return reject(e);
              }
              reject(new Error(outcome.reason.message));
            } else {
              try {
                const settled = await this.sequence.settled.get(outcome.topic);
                const reason = ERROR.SETTLED.format({ context: this.sequence.context });
                await this.sequence.pending.delete(pending.topic, reason);
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
    this.sequence.logger.debug(`Respond ${this.sequence.context}`);
    this.sequence.logger.trace({ type: "method", method: "respond", params });
    await this.sequence.validateRespond(params);
    const { approved, proposal, response } = params;
    const { relay, ttl } = proposal;
    const self = {
      publicKey: await this.sequence.client.crypto.generateKeyPair(),
      metadata: response?.metadata,
    };
    if (!self.metadata) delete self.metadata;
    if (approved) {
      try {
        const responder: SequenceTypes.Participant = {
          publicKey: self.publicKey,
          metadata: response?.metadata,
        };
        if (!responder.metadata) delete responder.metadata;
        const expiry = Date.now() + proposal.ttl * 1000;
        const state: SequenceTypes.State = response?.state || {};
        const peer: SequenceTypes.Participant = {
          publicKey: proposal.proposer.publicKey,
          metadata: proposal.proposer.metadata,
        };
        if (!peer.metadata) delete peer.metadata;
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
          status: this.sequence.config.status.responded as SequenceTypes.RespondedStatus,
          topic: proposal.topic,
          relay,
          self,
          proposal,
          outcome,
        };
        await this.sequence.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      } catch (e) {
        const reason = ERROR.GENERIC.format({ message: e.message });
        const outcome: SequenceTypes.Outcome = { reason };
        const pending: SequenceTypes.Pending = {
          status: this.sequence.config.status.responded as SequenceTypes.RespondedStatus,
          topic: proposal.topic,
          relay,
          self,
          proposal,
          outcome,
        };
        await this.sequence.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      }
    } else {
      const defaultReason = ERROR.NOT_APPROVED.format({ context: this.sequence.context });
      const outcome: SequenceTypes.Outcome = { reason: params?.reason || defaultReason };
      const pending: SequenceTypes.Pending = {
        status: this.sequence.config.status.responded as SequenceTypes.RespondedStatus,
        topic: proposal.topic,
        relay,
        self,
        proposal,
        outcome,
      };
      await this.sequence.pending.set(pending.topic, pending, { relay: pending.relay });
      return pending;
    }
  }

  public async update(params: SequenceTypes.UpdateParams): Promise<SequenceTypes.Settled> {
    this.sequence.logger.debug(`Update ${this.sequence.context}`);
    this.sequence.logger.trace({ type: "method", method: "update", params });
    const settled = await this.sequence.settled.get(params.topic);
    const participant: SequenceTypes.Participant = { publicKey: settled.self.publicKey };
    const update = await this.handleUpdate(params.topic, params, participant);
    const request = formatJsonRpcRequest(this.sequence.config.jsonrpc.update, update);
    await this.send(settled.topic, request);
    return settled;
  }

  public async upgrade(params: SequenceTypes.UpgradeParams): Promise<SequenceTypes.Settled> {
    this.sequence.logger.debug(`Upgrade ${this.sequence.context}`);
    this.sequence.logger.trace({ type: "method", method: "upgrade", params });
    const settled = await this.sequence.settled.get(params.topic);
    const participant: SequenceTypes.Participant = { publicKey: settled.self.publicKey };
    const upgrade = await this.handleUpgrade(params.topic, params, participant);
    const request = formatJsonRpcRequest(this.sequence.config.jsonrpc.upgrade, upgrade);
    await this.send(settled.topic, request);
    return settled;
  }

  public async request(params: SequenceTypes.RequestParams): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.sequence.validateRequest(params);
      } catch (e) {
        return reject(e);
      }
      const request = formatJsonRpcRequest(params.request.method, params.request.params);
      const maxTimeout = params?.timeout || FIVE_MINUTES * 1000;
      const timeout = setTimeout(() => {
        const error = ERROR.JSONRPC_REQUEST_TIMEOUT.format({
          method: request.method,
          timeout: maxTimeout,
        });
        this.sequence.logger.error(error.message);
        reject(error.message);
      }, maxTimeout);
      this.sequence.events.on(
        this.sequence.config.events.response,
        (responseEvent: SequenceTypes.ResponseEvent) => {
          if (params.topic !== responseEvent.topic) return;
          const response = responseEvent.response;
          if (response.id !== request.id) return;
          clearTimeout(timeout);
          if (isJsonRpcError(response)) {
            const errorMessage = response.error.message;
            this.sequence.logger.error(errorMessage);
            return reject(new Error(errorMessage));
          }
          return resolve(response.result);
        },
      );
      try {
        await this.send(params.topic, request, params?.chainId);
      } catch (e) {
        clearTimeout(timeout);
        return reject(e);
      }
    });
  }

  public async delete(params: SequenceTypes.DeleteParams): Promise<void> {
    this.sequence.logger.debug(`Delete ${this.sequence.context}`);
    this.sequence.logger.trace({ type: "method", method: "delete", params });
    await this.sequence.settled.delete(params.topic, params.reason);
  }

  public async notify(params: SequenceTypes.NotifyParams): Promise<void> {
    const settled = await this.sequence.settled.get(params.topic);
    await this.isNotificationAuthorized(params.topic, settled.self, params.type);
    const notification: SequenceTypes.Notification = { type: params.type, data: params.data };
    const request = formatJsonRpcRequest(this.sequence.config.jsonrpc.notification, notification);
    await this.send(params.topic, request);
  }

  // ---------- Protected ----------------------------------------------- //

  public async propose(params?: SequenceTypes.ProposeParams): Promise<SequenceTypes.Pending> {
    this.sequence.logger.debug(`Propose ${this.sequence.context}`);
    this.sequence.logger.trace({ type: "method", method: "propose", params });
    await this.sequence.validatePropose(params);
    const relay = params?.relay || { protocol: RELAYER_DEFAULT_PROTOCOL };
    const topic = generateRandomBytes32();
    const self: SequenceTypes.Participant = {
      publicKey: await this.sequence.client.crypto.generateKeyPair(),
      metadata: params?.metadata,
    };
    if (!self.metadata) delete self.metadata;
    const proposer: SequenceTypes.ProposedPeer = {
      publicKey: self.publicKey,
      controller: this.sequence.client.controller,
      metadata: self.metadata,
    };
    if (!proposer.metadata) delete proposer.metadata;
    const signal =
      params?.signal || (await this.sequence.getDefaultSignal({ topic, relay, proposer }));
    const permissions = params?.permissions || (await this.sequence.getDefaultPermissions());
    const ttl = params?.ttl || (await this.sequence.getDefaultTTL());
    const proposal: SequenceTypes.Proposal = {
      relay,
      topic,
      proposer,
      signal,
      permissions,
      ttl,
    };
    const pending: SequenceTypes.Pending = {
      status: this.sequence.config.status.proposed as SequenceTypes.ProposedStatus,
      topic: proposal.topic,
      relay: proposal.relay,
      self,
      proposal,
    };
    await this.sequence.pending.set(pending.topic, pending, { relay });
    return pending;
  }

  public async settle(params: SequenceTypes.SettleParams): Promise<SequenceTypes.Settled> {
    this.sequence.logger.debug(`Settle ${this.sequence.context}`);
    this.sequence.logger.trace({ type: "method", method: "settle", params });
    const topic = await this.sequence.client.crypto.generateSharedKey(params.self, params.peer);
    const settled: SequenceTypes.Settled = {
      topic,
      relay: params.relay,
      self: params.self,
      peer: params.peer,
      permissions: params.permissions,
      expiry: params.expiry,
      state: params.state,
    };
    await this.sequence.settled.set(settled.topic, settled, {
      relay: settled.relay,
      expiry: settled.expiry,
    });
    return settled;
  }

  public async onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.sequence.logger.debug(`Receiving ${this.sequence.context} response`);
    this.sequence.logger.trace({ type: "method", method: "onResponse", topic, payload });
    const request = payload as JsonRpcRequest<SequenceTypes.Outcome>;
    const outcome = request.params;
    const pending = await this.sequence.pending.get(topic);
    let error: ErrorResponse | undefined;
    if (!isSequenceFailed(outcome)) {
      try {
        const controller = pending.proposal.proposer.controller
          ? { publicKey: pending.proposal.proposer.publicKey }
          : { publicKey: outcome.responder.publicKey };
        const peer: SequenceTypes.Participant = {
          publicKey: outcome.responder.publicKey,
          metadata: outcome.responder.metadata,
        };
        if (!peer.metadata) delete peer.metadata;
        const state: SequenceTypes.State = outcome.state || {};
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
        await this.sequence.pending.update(topic, {
          status: this.sequence.config.status.responded as SequenceTypes.RespondedStatus,
          outcome: {
            topic: settled.topic,
            relay: settled.relay,
            responder: outcome.responder,
            expiry: settled.expiry,
            state: settled.state,
          },
        });
      } catch (e) {
        this.sequence.logger.error(e);
        error = ERROR.GENERIC.format({ message: e.message });
        await this.sequence.pending.update(topic, {
          status: this.sequence.config.status.responded as SequenceTypes.RespondedStatus,
          outcome: { reason: error },
        });
      }
      const response =
        typeof error === "undefined"
          ? formatJsonRpcResult(request.id, true)
          : formatJsonRpcError(request.id, error);
      await this.sequence.client.relayer.publish(pending.topic, response, {
        relay: pending.relay,
      });
    } else {
      this.sequence.logger.error(outcome.reason);
      await this.sequence.pending.update(topic, {
        status: this.sequence.config.status.responded as SequenceTypes.RespondedStatus,
        outcome: { reason: outcome.reason },
      });
    }
  }

  public async onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.sequence.logger.debug(`Receiving ${this.sequence.context} acknowledge`);
    this.sequence.logger.trace({ type: "method", method: "onAcknowledge", topic, payload });
    const response = payload as JsonRpcResponse;
    const pending = await this.sequence.pending.get(topic);
    if (!isSequenceResponded(pending)) return;
    if (isJsonRpcError(response) && !isSequenceFailed(pending.outcome)) {
      await this.sequence.settled.delete(pending.outcome.topic, response.error);
    }
    const reason = ERROR.RESPONSE_ACKNOWLEDGED.format({ context: this.sequence.context });
    await this.sequence.pending.delete(topic, reason);
  }

  public async onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.sequence.logger.debug(`Receiving ${this.sequence.context} message`);
    this.sequence.logger.trace({ type: "method", method: "onMessage", topic, payload });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const settled = await this.sequence.settled.get(payloadEvent.topic);
      let error: ErrorResponse | undefined;
      switch (request.method) {
        case this.sequence.config.jsonrpc.payload:
          await this.onPayload(payloadEvent);
          break;
        case this.sequence.config.jsonrpc.update:
          await this.onUpdate(payloadEvent);
          break;
        case this.sequence.config.jsonrpc.upgrade:
          await this.onUpgrade(payloadEvent);
          break;
        case this.sequence.config.jsonrpc.notification:
          await this.onNotification(payloadEvent);
          break;
        case this.sequence.config.jsonrpc.delete:
          await this.sequence.settled.delete(settled.topic, request.params.reason);
          break;
        case this.sequence.config.jsonrpc.ping:
          await this.send(settled.topic, formatJsonRpcResult(request.id, true));
          break;
        default:
          error = ERROR.UNKNOWN_JSONRPC_METHOD.format({ method: request.method });
          this.sequence.logger.error(error.message);
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
      const { chainId } = params;
      const request = formatJsonRpcRequest(params.request.method, params.request.params, id);
      const settled = await this.sequence.settled.get(topic);
      await this.isJsonRpcAuthorized(topic, settled.peer, request);
      await this.sequence.validateRequest({ topic, request, chainId });
      const settledPayloadEvent: SequenceTypes.PayloadEvent = {
        topic,
        payload: request,
        chainId,
      };
      this.sequence.logger.debug(`Receiving ${this.sequence.context} payload`);
      this.sequence.logger.trace({ type: "method", method: "onPayload", ...settledPayloadEvent });
      this.onPayloadEvent(settledPayloadEvent);
    } else {
      const settledPayloadEvent: SequenceTypes.PayloadEvent = {
        topic,
        payload,
      };
      this.sequence.logger.debug(`Receiving ${this.sequence.context} payload`);
      this.sequence.logger.trace({ type: "method", method: "onPayload", ...settledPayloadEvent });
      this.onPayloadEvent(settledPayloadEvent);
    }
  }

  public async onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.sequence.logger.debug(`Receiving ${this.sequence.context} update`);
    this.sequence.logger.trace({ type: "method", method: "onUpdate", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const settled = await this.sequence.settled.get(payloadEvent.topic);
    try {
      const participant: SequenceTypes.Participant = { publicKey: settled.peer.publicKey };
      await this.handleUpdate(topic, request.params, participant);
      const response = formatJsonRpcResult(request.id, true);
      await this.send(settled.topic, response);
    } catch (e) {
      this.sequence.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      await this.send(settled.topic, response);
    }
  }

  public async onUpgrade(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.sequence.logger.debug(`Receiving ${this.sequence.context} upgrade`);
    this.sequence.logger.trace({ type: "method", method: "onUpgrade", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const settled = await this.sequence.settled.get(payloadEvent.topic);
    try {
      const participant: SequenceTypes.Participant = { publicKey: settled.peer.publicKey };
      await this.handleUpgrade(topic, request.params, participant);
      const response = formatJsonRpcResult(request.id, true);
      await this.send(settled.topic, response);
    } catch (e) {
      this.sequence.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      await this.send(settled.topic, response);
    }
  }

  protected async onNotification(event: SubscriptionEvent.Payload) {
    const notification = (event.payload as JsonRpcRequest<SessionTypes.Notification>).params;
    const settled = await this.sequence.settled.get(event.topic);
    await this.isNotificationAuthorized(event.topic, settled.peer, notification.type);
    const notificationEvent: SessionTypes.NotificationEvent = {
      topic: event.topic,
      type: notification.type,
      data: notification.data,
    };
    const eventName = this.sequence.config.events.notification;
    this.sequence.logger.info(`Emitting ${eventName}`);
    this.sequence.logger.debug({ type: "event", event: eventName, notificationEvent });
    this.sequence.events.emit(eventName, notificationEvent);
  }

  public async handleUpdate(
    topic: string,
    update: SequenceTypes.Update,
    participant: SequenceTypes.Participant,
  ): Promise<SequenceTypes.Update> {
    if (typeof update.state === "undefined") {
      const error = ERROR.INVALID_UPDATE_REQUEST.format({ context: this.sequence.context });
      this.sequence.logger.error(error.message);
      throw new Error(error.message);
    }
    const settled = await this.sequence.settled.get(topic);
    if (participant.publicKey !== settled.permissions.controller.publicKey) {
      const error = ERROR.UNAUTHORIZED_UPDATE_REQUEST.format({
        context: this.sequence.context,
      });
      this.sequence.logger.error(error.message);
      throw new Error(error.message);
    }
    settled.state = await this.sequence.mergeUpdate(topic, update);
    await this.sequence.settled.update(settled.topic, settled);
    return update;
  }

  public async handleUpgrade(
    topic: string,
    upgrade: SequenceTypes.Upgrade,
    participant: SequenceTypes.Participant,
  ): Promise<SequenceTypes.Upgrade> {
    if (typeof upgrade.permissions === "undefined") {
      const error = ERROR.INVALID_UPGRADE_REQUEST.format({ context: this.sequence.context });
      this.sequence.logger.error(error.message);
      throw new Error(error.message);
    }
    const settled = await this.sequence.settled.get(topic);
    if (participant.publicKey !== settled.permissions.controller.publicKey) {
      const error = ERROR.UNAUTHORIZED_UPGRADE_REQUEST.format({
        context: this.sequence.context,
      });
      this.sequence.logger.error(error.message);
      throw new Error(error.message);
    }
    settled.permissions = await this.sequence.mergeUpgrade(topic, upgrade);
    await this.sequence.settled.update(settled.topic, settled);
    return upgrade;
  }
  // ---------- Private ----------------------------------------------- //

  private async isJsonRpcAuthorized(
    topic: string,
    participant: SequenceTypes.Participant,
    request: JsonRpcRequest,
  ) {
    const settled = await this.sequence.settled.get(topic);
    if (participant.publicKey === settled.permissions.controller.publicKey) return;
    if (!settled.permissions.jsonrpc.methods.includes(request.method)) {
      const error = ERROR.UNAUTHORIZED_JSON_RPC_METHOD.format({
        method: request.method,
      });
      this.sequence.logger.error(error.message);
      throw new Error(error.message);
    }
  }

  private async isNotificationAuthorized(
    topic: string,
    participant: SequenceTypes.Participant,
    type: string,
  ) {
    const settled = await this.sequence.settled.get(topic);
    if (participant.publicKey === settled.permissions.controller.publicKey) return;
    if (
      settled.self.publicKey !== settled.permissions.controller.publicKey &&
      !settled.permissions.notifications.types.includes(type)
    ) {
      const error = ERROR.UNAUTHORIZED_NOTIFICATION_TYPE.format({ type });
      this.sequence.logger.error(error.message);
      throw new Error(error.message);
    }
  }

  private async shouldIgnorePayloadEvent(payloadEvent: SequenceTypes.PayloadEvent) {
    const { topic, payload } = payloadEvent;
    if (!this.sequence.settled.subscriptions.has(topic)) return true;
    let exists = false;
    try {
      exists = await this.sequence.history.exists(topic, payload.id);
    } catch (e) {
      // skip error
    }
    return exists;
  }

  private async onPayloadEvent(payloadEvent: SequenceTypes.PayloadEvent) {
    const { topic, payload, chainId } = payloadEvent;
    if (isJsonRpcRequest(payload)) {
      if (await this.shouldIgnorePayloadEvent(payloadEvent)) return;
      await this.sequence.history.set(topic, payload, chainId);
    } else {
      await this.sequence.history.update(topic, payload);
    }
    if (isJsonRpcRequest(payload)) {
      const requestEvent: SequenceTypes.RequestEvent = { topic, request: payload, chainId };
      const eventName = this.sequence.config.events.request;
      this.sequence.logger.info(`Emitting ${eventName}`);
      this.sequence.logger.debug({ type: "event", event: eventName, data: requestEvent });
      this.sequence.events.emit(eventName, requestEvent);
    } else {
      const responseEvent: SequenceTypes.ResponseEvent = { topic, response: payload, chainId };
      const eventName = this.sequence.config.events.response;
      this.sequence.logger.info(`Emitting ${eventName}`);
      this.sequence.logger.debug({ type: "event", event: eventName, data: responseEvent });
      this.sequence.events.emit(eventName, responseEvent);
    }
  }

  private async onPendingPayloadEvent(event: SubscriptionEvent.Payload) {
    if (isJsonRpcRequest(event.payload)) {
      switch (event.payload.method) {
        case this.sequence.config.jsonrpc.approve:
        case this.sequence.config.jsonrpc.reject:
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
    if (isSignalTypePairing(pending.proposal.signal)) {
      if (!(await this.sequence.client.crypto.hasKeys(pending.proposal.topic))) {
        const pairing = await this.sequence.client.pairing.settled.get(
          pending.proposal.signal.params.topic,
        );
        await this.sequence.client.crypto.generateSharedKey(
          pairing.self,
          pairing.peer,
          pending.proposal.topic,
        );
      }
    }
    if (isSequenceResponded(pending)) {
      const eventName = this.sequence.config.events.responded;
      this.sequence.logger.info(`Emitting ${eventName}`);
      this.sequence.logger.debug({ type: "event", event: eventName, data: pending });
      this.sequence.events.emit(eventName, pending);
      if (!isSubscriptionUpdatedEvent(event)) {
        const method = !isSequenceFailed(pending.outcome)
          ? this.sequence.config.jsonrpc.approve
          : this.sequence.config.jsonrpc.reject;
        const request = formatJsonRpcRequest(method, pending.outcome);
        await this.sequence.client.relayer.publish(pending.topic, request, {
          relay: pending.relay,
        });
      }
    } else {
      const eventName = this.sequence.config.events.proposed;
      this.sequence.logger.info(`Emitting ${eventName}`);
      this.sequence.logger.debug({ type: "event", event: eventName, data: pending });
      this.sequence.events.emit(eventName, pending);
      if (isSignalTypePairing(pending.proposal.signal)) {
        // send proposal signal through existing pairing
        const request = formatJsonRpcRequest(
          this.sequence.config.jsonrpc.propose,
          pending.proposal,
        );
        await this.sequence.client.pairing.send(pending.proposal.signal.params.topic, request);
      }
    }
  }

  private registerEventListeners(): void {
    // Pending Subscription Events
    this.sequence.pending.on(
      SUBSCRIPTION_EVENTS.payload,
      (payloadEvent: SubscriptionEvent.Payload) => this.onPendingPayloadEvent(payloadEvent),
    );
    this.sequence.pending.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<SequenceTypes.Pending>) =>
        this.onPendingStatusEvent(createdEvent),
    );
    this.sequence.pending.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<SequenceTypes.Pending>) =>
        this.onPendingStatusEvent(updatedEvent),
    );
    // Settled Subscription Events
    this.sequence.settled.on(
      SUBSCRIPTION_EVENTS.payload,
      (payloadEvent: SubscriptionEvent.Payload) => this.onMessage(payloadEvent),
    );
    this.sequence.settled.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<SequenceTypes.Settled>) => {
        const { data: settled } = createdEvent;
        const eventName = this.sequence.config.events.settled;
        this.sequence.logger.info(`Emitting ${eventName}`);
        this.sequence.logger.debug({ type: "event", event: eventName, data: settled });
        this.sequence.events.emit(eventName, settled);
      },
    );
    this.sequence.settled.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<SequenceTypes.Settled>) => {
        const { data: settled, update } = updatedEvent;
        const eventName = this.sequence.config.events.updated;
        this.sequence.logger.info(`Emitting ${eventName}`);
        this.sequence.logger.debug({ type: "event", event: eventName, data: settled, update });
        this.sequence.events.emit(eventName, settled, update);
      },
    );
    this.sequence.settled.on(
      SUBSCRIPTION_EVENTS.deleted,
      async (deletedEvent: SubscriptionEvent.Deleted<SequenceTypes.Settled>) => {
        const { data: settled, reason } = deletedEvent;
        const eventName = this.sequence.config.events.deleted;
        this.sequence.logger.info(`Emitting ${eventName}`);
        this.sequence.logger.debug({ type: "event", event: eventName, data: settled, reason });
        this.sequence.events.emit(eventName, settled, reason);
        const request = formatJsonRpcRequest(this.sequence.config.jsonrpc.delete, { reason });
        await this.sequence.history.delete(settled.topic);
        await this.sequence.client.relayer.publish(settled.topic, request, {
          relay: settled.relay,
        });
      },
    );
    this.sequence.settled.on(SUBSCRIPTION_EVENTS.sync, () =>
      this.sequence.events.emit(this.sequence.config.events.sync),
    );
    this.sequence.settled.on(SUBSCRIPTION_EVENTS.enabled, () =>
      this.sequence.events.emit(this.sequence.config.events.enabled),
    );
    this.sequence.settled.on(SUBSCRIPTION_EVENTS.disabled, () =>
      this.sequence.events.emit(this.sequence.config.events.disabled),
    );
  }
}
