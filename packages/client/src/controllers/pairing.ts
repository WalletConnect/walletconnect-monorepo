import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import {
  PairingTypes,
  IClient,
  IPairing,
  SubscriptionEvent,
  CryptoTypes,
  Reason,
} from "@walletconnect/types";
import {
  deriveSharedKey,
  generateKeyPair,
  generateRandomBytes32,
  isPairingFailed,
  sha256,
  isPairingResponded,
  formatUri,
  isSubscriptionUpdatedEvent,
  ERROR,
  getClientError,
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

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = generateChildLogger(logger, this.context);
    this.pending = new Subscription<PairingTypes.Pending>(
      client,
      this.logger,
      PAIRING_STATUS.pending,
      false,
    );
    this.settled = new Subscription<PairingTypes.Settled>(
      client,
      this.logger,
      PAIRING_STATUS.settled,
      true,
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
    const request = { method: PAIRING_JSONRPC.ping, params: {} };
    return this.request({ topic, request, timeout: timeout || THIRTY_SECONDS * 1000 });
  }

  public async send(topic: string, payload: JsonRpcPayload): Promise<void> {
    const pairing = await this.settled.get(topic);
    const encryptKeys: CryptoTypes.EncryptKeys = {
      sharedKey: pairing.sharedKey,
      publicKey: pairing.self.publicKey,
    };
    if (isJsonRpcRequest(payload)) {
      if (!Object.values(PAIRING_JSONRPC).includes(payload.method)) {
        if (!pairing.permissions.jsonrpc.methods.includes(payload.method)) {
          const error = getClientError(ERROR.UNAUTHORIZED_JSON_RPC_METHOD, {
            method: payload.method,
          });
          this.logger.error(error.message);
          throw new Error(error.message);
        }
        await this.history.set(topic, payload);
        payload = formatJsonRpcRequest<PairingTypes.Payload>(
          PAIRING_JSONRPC.payload,
          {
            request: { method: payload.method, params: payload.params },
          },
          payload.id,
        );
      }
    } else {
      await this.history.update(topic, payload);
    }
    await this.client.relayer.publish(pairing.topic, payload, {
      relay: pairing.relay,
      encryptKeys,
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
      this.logger.debug(`Create Pairing`);
      this.logger.trace({ type: "method", method: "create", params });
      const maxTimeout = params?.timeout || FIVE_MINUTES * 1000;
      const timeout = setTimeout(() => {
        const error = getClientError(ERROR.SETTLE_TIMEOUT, {
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
                const pairing = await this.settled.get(outcome.topic);
                const reason = getClientError(ERROR.SETTLED, { context: this.context });
                await this.pending.delete(pending.topic, reason);
                resolve(pairing);
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
    this.logger.debug(`Respond Pairing`);
    this.logger.trace({ type: "method", method: "respond", params });
    const { approved, proposal } = params;
    const self = generateKeyPair();
    if (approved) {
      try {
        const responder: PairingTypes.Peer = {
          publicKey: self.publicKey,
        };
        const expiry = Date.now() + proposal.ttl;
        const controller = proposal.proposer.controller
          ? { publicKey: proposal.proposer.publicKey }
          : { publicKey: self.publicKey };
        const pairing = await this.settle({
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
          topic: pairing.topic,
          relay: pairing.relay,
          responder,
          expiry,
          state: {},
        };
        const pending: PairingTypes.Pending = {
          status: PAIRING_STATUS.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          self,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      } catch (e) {
        const reason = getClientError(ERROR.GENERIC, { message: e.message });
        const outcome: PairingTypes.Outcome = { reason };
        const pending: PairingTypes.Pending = {
          status: PAIRING_STATUS.responded,
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
      const defaultReason = getClientError(ERROR.NOT_APPROVED, { context: this.context });
      const outcome: PairingTypes.Outcome = { reason: params?.reason || defaultReason };
      const pending: PairingTypes.Pending = {
        status: PAIRING_STATUS.responded,
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
    this.logger.info(`Upgrade Pairing`);
    this.logger.trace({ type: "method", method: "upgrade", params });
    const pairing = await this.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: pairing.self.publicKey };
    const upgrade = await this.handleUpgrade(params.topic, params, participant);
    const request = formatJsonRpcRequest(PAIRING_JSONRPC.upgrade, upgrade);
    await this.send(pairing.topic, request);
    return pairing;
  }

  public async update(params: PairingTypes.UpdateParams): Promise<PairingTypes.Settled> {
    this.logger.debug(`Update Pairing`);
    this.logger.trace({ type: "method", method: "update", params });
    const pairing = await this.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: pairing.self.publicKey };
    const update = await this.handleUpdate(params.topic, params, participant);
    const request = formatJsonRpcRequest(PAIRING_JSONRPC.update, update);
    await this.send(pairing.topic, request);
    return pairing;
  }

  public async request(params: PairingTypes.RequestParams): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const request = formatJsonRpcRequest(params.request.method, params.request.params);
      const maxTimeout = params?.timeout || FIVE_MINUTES * 1000;
      const timeout = setTimeout(() => {
        const error = getClientError(ERROR.JSON_RPC_REQUEST_TIMEOUT, {
          method: request.method,
          timeout: maxTimeout,
        });
        this.logger.error(error.message);
        reject(error.message);
      }, maxTimeout);
      this.events.on(PAIRING_EVENTS.response, (responseEvent: PairingTypes.ResponseEvent) => {
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
    this.logger.debug(`Delete Pairing`);
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
    this.logger.debug(`Propose Pairing`);
    this.logger.trace({ type: "method", method: "propose", params });
    const relay = params?.relay || { protocol: RELAYER_DEFAULT_PROTOCOL };
    const topic = generateRandomBytes32();
    const self = generateKeyPair();
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
      status: PAIRING_STATUS.proposed,
      topic: proposal.topic,
      relay: proposal.relay,
      self,
      proposal,
    };
    await this.pending.set(pending.topic, pending, { relay });
    return pending;
  }

  protected async settle(params: PairingTypes.SettleParams): Promise<PairingTypes.Settled> {
    this.logger.debug(`Settle Pairing`);
    this.logger.trace({ type: "method", method: "settle", params });
    const sharedKey = deriveSharedKey(params.self.privateKey, params.peer.publicKey);
    const topic = await sha256(sharedKey);
    const pairing: PairingTypes.Settled = {
      topic,
      relay: params.relay,
      sharedKey,
      self: params.self,
      peer: params.peer,
      permissions: params.permissions,
      expiry: params.expiry,
      state: params.state,
    };
    const decryptKeys: CryptoTypes.DecryptKeys = {
      sharedKey,
    };
    await this.settled.set(pairing.topic, pairing, {
      relay: pairing.relay,
      expiry: pairing.expiry,
      decryptKeys,
    });
    return pairing;
  }

  protected async onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Pairing response`);
    this.logger.trace({ type: "method", method: "onResponse", topic, payload });
    const request = payload as JsonRpcRequest<PairingTypes.Outcome>;
    const pending = await this.pending.get(topic);
    let error: Reason | undefined;
    if (!isPairingFailed(request.params)) {
      try {
        const controller = pending.proposal.proposer.controller
          ? { publicKey: pending.proposal.proposer.publicKey }
          : { publicKey: request.params.responder.publicKey };
        const pairing = await this.settle({
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
          status: PAIRING_STATUS.responded,
          outcome: {
            topic: pairing.topic,
            relay: pairing.relay,
            responder: request.params.responder,
            expiry: pairing.expiry,
            state: {},
          },
        });
      } catch (e) {
        this.logger.error(e);
        error = getClientError(ERROR.GENERIC, { message: e.message });
        await this.pending.update(topic, {
          status: PAIRING_STATUS.responded,
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
        status: PAIRING_STATUS.responded,
        outcome: { reason: request.params.reason },
      });
    }
  }

  protected async onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Pairing acknowledge`);
    this.logger.trace({ type: "method", method: "onAcknowledge", topic, payload });
    const response = payload as JsonRpcResponse;
    const pending = await this.pending.get(topic);
    if (!isPairingResponded(pending)) return;
    if (isJsonRpcError(response) && !isPairingFailed(pending.outcome)) {
      await this.settled.delete(pending.outcome.topic, response.error);
    }
    const reason = getClientError(ERROR.RESPONSE_ACKNOWLEDGED, { context: this.context });
    await this.pending.delete(topic, reason);
  }

  protected async onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Pairing message`);
    this.logger.trace({ type: "method", method: "onMessage", topic, payload });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const pairing = await this.settled.get(payloadEvent.topic);
      let error: Reason | undefined;
      switch (request.method) {
        case PAIRING_JSONRPC.payload:
          await this.onPayload(payloadEvent);
          break;
        case PAIRING_JSONRPC.update:
          await this.onUpdate(payloadEvent);
          break;
        case PAIRING_JSONRPC.upgrade:
          await this.onUpgrade(payloadEvent);
          break;
        case PAIRING_JSONRPC.delete:
          await this.settled.delete(pairing.topic, request.params.reason);
          break;
        case PAIRING_JSONRPC.ping:
          await this.send(pairing.topic, formatJsonRpcResult(request.id, false));
          break;
        default:
          error = getClientError(ERROR.UNKNOWN_JSON_RPC_METHOD, { method: request.method });
          this.logger.error(error.message);
          await this.send(pairing.topic, formatJsonRpcError(request.id, error));
          break;
      }
    } else {
      this.onPayloadEvent(payloadEvent);
    }
  }

  protected async onPayload(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    if (isJsonRpcRequest(payload)) {
      const { id, params } = payload as JsonRpcRequest<PairingTypes.Payload>;
      const request = formatJsonRpcRequest(params.request.method, params.request.params, id);
      const pairing = await this.settled.get(topic);
      if (!pairing.permissions.jsonrpc.methods.includes(request.method)) {
        const error = getClientError(ERROR.UNAUTHORIZED_JSON_RPC_METHOD, {
          method: request.method,
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      const pairingPayloadEvent: PairingTypes.PayloadEvent = {
        topic,
        payload: request,
      };
      this.logger.debug(`Receiving Pairing payload`);
      this.logger.trace({ type: "method", method: "onPayload", ...pairingPayloadEvent });
      this.onPayloadEvent(pairingPayloadEvent);
    } else {
      const pairingPayloadEvent: PairingTypes.PayloadEvent = {
        topic,
        payload,
      };
      this.logger.debug(`Receiving Pairing payload`);
      this.logger.trace({ type: "method", method: "onPayload", ...pairingPayloadEvent });
      this.onPayloadEvent(pairingPayloadEvent);
    }
  }

  protected async onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Pairing update`);
    this.logger.trace({ type: "method", method: "onUpdate", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const pairing = await this.settled.get(payloadEvent.topic);
    try {
      const participant: CryptoTypes.Participant = { publicKey: pairing.peer.publicKey };
      await this.handleUpdate(topic, request.params, participant);
      const response = formatJsonRpcResult(request.id, true);
      await this.send(pairing.topic, response);
    } catch (e) {
      this.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      await this.send(pairing.topic, response);
    }
  }

  protected async onUpgrade(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Pairing upgrade`);
    this.logger.trace({ type: "method", method: "onUpgrade", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const pairing = await this.settled.get(payloadEvent.topic);
    try {
      const participant: CryptoTypes.Participant = { publicKey: pairing.peer.publicKey };
      await this.handleUpgrade(topic, request.params, participant);
      const response = formatJsonRpcResult(request.id, true);
      await this.send(pairing.topic, response);
    } catch (e) {
      this.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      await this.send(pairing.topic, response);
    }
  }

  protected async handleUpdate(
    topic: string,
    params: PairingTypes.Update,
    participant: CryptoTypes.Participant,
  ): Promise<PairingTypes.Update> {
    const pairing = await this.settled.get(topic);
    let update: PairingTypes.Update;
    if (typeof params.state !== "undefined") {
      const state = pairing.state;
      if (participant.publicKey !== pairing.permissions.controller.publicKey) {
        const error = getClientError(ERROR.UNAUTHORIZED_UPDATE_REQUEST, { context: this.context });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      state.metadata = params.state.metadata || state.metadata;
      update = { state };
    } else {
      const error = getClientError(ERROR.INVALID_UPDATE_REQUEST, { context: this.context });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    await this.settled.update(pairing.topic, pairing);
    return update;
  }

  protected async handleUpgrade(
    topic: string,
    params: PairingTypes.Upgrade,
    participant: CryptoTypes.Participant,
  ): Promise<PairingTypes.Upgrade> {
    const pairing = await this.settled.get(topic);
    let upgrade: PairingTypes.Upgrade = { permissions: {} };
    if (participant.publicKey !== pairing.permissions.controller.publicKey) {
      const error = getClientError(ERROR.UNAUTHORIZED_UPGRADE_REQUEST, { context: this.context });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    const permissions: Omit<PairingTypes.Permissions, "controller"> = {
      jsonrpc: {
        methods: [
          ...pairing.permissions.jsonrpc.methods,
          ...(params.permissions.jsonrpc?.methods || []),
        ],
      },
    };
    upgrade = { permissions };
    pairing.permissions = { ...permissions, controller: pairing.permissions.controller };
    await this.settled.update(pairing.topic, pairing);
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
      this.logger.info(`Emitting ${PAIRING_EVENTS.request}`);
      this.logger.debug({ type: "event", event: PAIRING_EVENTS.request, data: requestEvent });
      this.events.emit(PAIRING_EVENTS.request, requestEvent);
    } else {
      const responseEvent: PairingTypes.ResponseEvent = { topic, response: payload };
      this.logger.info(`Emitting ${PAIRING_EVENTS.response}`);
      this.logger.debug({ type: "event", event: PAIRING_EVENTS.response, data: responseEvent });
      this.events.emit(PAIRING_EVENTS.response, responseEvent);
    }
  }

  private async onPendingPayloadEvent(event: SubscriptionEvent.Payload) {
    if (isJsonRpcRequest(event.payload)) {
      switch (event.payload.method) {
        case PAIRING_JSONRPC.approve:
        case PAIRING_JSONRPC.reject:
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
      this.logger.info(`Emitting ${PAIRING_EVENTS.responded}`);
      this.logger.debug({ type: "event", event: PAIRING_EVENTS.responded, data: pending });
      this.events.emit(PAIRING_EVENTS.responded, pending);
      if (!isSubscriptionUpdatedEvent(event)) {
        const method = !isPairingFailed(pending.outcome)
          ? PAIRING_JSONRPC.approve
          : PAIRING_JSONRPC.reject;
        const request = formatJsonRpcRequest(method, pending.outcome);
        await this.client.relayer.publish(pending.topic, request, { relay: pending.relay });
      }
    } else {
      this.logger.info(`Emitting ${PAIRING_EVENTS.proposed}`);
      this.logger.debug({ type: "event", event: PAIRING_EVENTS.proposed, data: pending });
      this.events.emit(PAIRING_EVENTS.proposed, pending);
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
        const pairing = createdEvent.data;
        this.logger.info(`Emitting ${PAIRING_EVENTS.settled}`);
        this.logger.debug({ type: "event", event: PAIRING_EVENTS.settled, data: pairing });
        this.events.emit(PAIRING_EVENTS.settled, pairing);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<PairingTypes.Settled>) => {
        const pairing = updatedEvent.data;
        this.logger.info(`Emitting ${PAIRING_EVENTS.updated}`);
        this.logger.debug({ type: "event", event: PAIRING_EVENTS.updated, data: pairing });
        this.events.emit(PAIRING_EVENTS.updated, pairing);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.deleted,
      async (deletedEvent: SubscriptionEvent.Deleted<PairingTypes.Settled>) => {
        const pairing = deletedEvent.data;
        this.logger.info(`Emitting ${PAIRING_EVENTS.deleted}`);
        this.logger.debug({ type: "event", event: PAIRING_EVENTS.deleted, data: pairing });
        this.events.emit(PAIRING_EVENTS.deleted, pairing);
        const request = formatJsonRpcRequest(PAIRING_JSONRPC.delete, {
          reason: deletedEvent.reason,
        });
        await this.history.delete(pairing.topic);
        await this.client.relayer.publish(pairing.topic, request, { relay: pairing.relay });
      },
    );
  }
}
