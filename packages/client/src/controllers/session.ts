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
  deriveSharedKey,
  generateKeyPair,
  generateRandomBytes32,
  isSessionFailed,
  sha256,
  isSessionResponded,
  isSubscriptionUpdatedEvent,
  validateSessionProposeParams,
  validateSessionRespondParams,
  isValidationInvalid,
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
} from "@json-rpc-tools/utils";

import { Subscription } from "./subscription";
import { JsonRpcHistory } from "./history";
import {
  SESSION_CONTEXT,
  SESSION_EVENTS,
  SESSION_JSONRPC,
  SESSION_REASONS,
  SESSION_STATUS,
  SUBSCRIPTION_EVENTS,
  SESSION_SIGNAL_METHOD_PAIRING,
  SESSION_DEFAULT_TTL,
} from "../constants";

export class Session extends ISession {
  public pending: Subscription<SessionTypes.Pending>;
  public settled: Subscription<SessionTypes.Settled>;
  public history: JsonRpcHistory;

  public events = new EventEmitter();

  protected context: string = SESSION_CONTEXT;

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = generateChildLogger(logger, this.context);
    this.pending = new Subscription<SessionTypes.Pending>(
      client,
      this.logger,
      SESSION_STATUS.pending,
      true,
    );
    this.settled = new Subscription<SessionTypes.Settled>(
      client,
      this.logger,
      SESSION_STATUS.settled,
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

  public async get(topic: string): Promise<SessionTypes.Settled> {
    return this.settled.get(topic);
  }

  public async ping(topic: string): Promise<void> {
    const request = { method: SESSION_JSONRPC.ping, params: {} };
    return this.request({ topic, request });
  }

  public async send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void> {
    const session = await this.settled.get(topic);
    const encryptKeys: CryptoTypes.EncryptKeys = {
      sharedKey: session.sharedKey,
      publicKey: session.self.publicKey,
    };
    if (isJsonRpcRequest(payload)) {
      if (!Object.values(SESSION_JSONRPC).includes(payload.method)) {
        if (!session.permissions.jsonrpc.methods.includes(payload.method)) {
          const errorMessage = `Unauthorized JSON-RPC Method Requested: ${payload.method}`;
          this.logger.error(errorMessage);
          throw new Error(errorMessage);
        }
        await this.history.set(topic, payload, chainId);
        payload = formatJsonRpcRequest<SessionTypes.Payload>(
          SESSION_JSONRPC.payload,
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
    await this.client.relayer.publish(session.topic, payload, {
      relay: session.relay,
      encryptKeys,
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
      this.logger.info(`Create Session`);
      this.logger.trace({ type: "method", method: "create", params });
      const timeout = setTimeout(() => {
        const errorMessage = `Session failed to settle after 30 seconds`;
        this.logger.error(errorMessage);
        reject(errorMessage);
      }, 30_000);
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
              reject(new Error(outcome.reason));
            } else {
              try {
                const pairing = await this.settled.get(outcome.topic);
                await this.pending.delete(pending.topic, SESSION_REASONS.settled);
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

  public async respond(params: SessionTypes.RespondParams): Promise<SessionTypes.Pending> {
    this.logger.info(`Respond Session`);
    this.logger.trace({ type: "method", method: "respond", params });
    const paramsValidation = validateSessionRespondParams(params);
    if (isValidationInvalid(paramsValidation)) {
      throw new Error(paramsValidation.error);
    }
    const { approved, proposal, response } = params;
    const { relay } = proposal;
    const self = generateKeyPair();
    const pairing = await this.client.pairing.get(proposal.signal.params.topic);
    const decryptKeys: CryptoTypes.DecryptKeys = {
      sharedKey: pairing.sharedKey,
    };
    if (approved) {
      try {
        const responder: SessionTypes.Peer = {
          publicKey: self.publicKey,
          metadata: response.metadata,
        };
        const expiry = Date.now() + proposal.ttl;
        const state: SessionTypes.State = {
          accounts: params.response.state.accounts,
        };
        const session = await this.settle({
          relay,
          self,
          peer: proposal.proposer,
          permissions: formatSettledPermissions(proposal.permissions, self.publicKey),
          ttl: proposal.ttl,
          expiry,
          state,
        });
        const outcome: SessionTypes.Outcome = {
          topic: session.topic,
          relay: session.relay,
          state: session.state,
          responder,
          expiry,
        };
        const pending: SessionTypes.Pending = {
          status: SESSION_STATUS.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          self,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay, decryptKeys });
        return pending;
      } catch (e) {
        const reason = e.message;
        const outcome: SessionTypes.Outcome = { reason };
        const pending: SessionTypes.Pending = {
          status: SESSION_STATUS.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          self,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay, decryptKeys });
        return pending;
      }
    } else {
      const outcome = { reason: SESSION_REASONS.not_approved };
      const pending: SessionTypes.Pending = {
        status: SESSION_STATUS.responded,
        topic: proposal.topic,
        relay: proposal.relay,
        self,
        proposal,
        outcome,
      };
      await this.pending.set(pending.topic, pending, { relay: pending.relay, decryptKeys });
      return pending;
    }
  }

  public async update(params: SessionTypes.UpdateParams): Promise<SessionTypes.Settled> {
    this.logger.info(`Update Session`);
    this.logger.trace({ type: "method", method: "update", params });
    const session = await this.settled.get(params.topic);
    const update = await this.handleUpdate(session, params, {
      publicKey: session.self.publicKey,
    });
    const request = formatJsonRpcRequest(SESSION_JSONRPC.update, update);
    await this.send(session.topic, request);
    return session;
  }

  public async request(params: SessionTypes.RequestParams): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const request = formatJsonRpcRequest(params.request.method, params.request.params);
      const timeout = setTimeout(() => {
        const errorMessage = `JSON-RPC Request timeout after 30s: ${request.method}`;
        this.logger.error(errorMessage);
        reject(errorMessage);
      }, 30_000);
      this.events.on(SESSION_EVENTS.payload, (payloadEvent: SessionTypes.PayloadEvent) => {
        if (params.topic !== payloadEvent.topic) return;
        if (isJsonRpcRequest(payloadEvent.payload)) return;
        const response = payloadEvent.payload;
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
    this.logger.info(`Delete Session`);
    this.logger.trace({ type: "method", method: "delete", params });
    this.settled.delete(params.topic, params.reason);
  }

  public async notify(params: SessionTypes.NotifyParams): Promise<void> {
    const session = await this.settled.get(params.topic);
    if (
      session.self.publicKey !== session.permissions.notifications.controller.publicKey &&
      !session.permissions.notifications.types.includes(params.type)
    ) {
      const errorMessage = `Unauthorized Notification Type Requested: ${params.type}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    const notification: SessionTypes.Notification = { type: params.type, data: params.data };
    const request = formatJsonRpcRequest(SESSION_JSONRPC.notification, notification);
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
    this.logger.info(`Propose Session`);
    this.logger.trace({ type: "method", method: "propose", params });
    const paramsValidation = validateSessionProposeParams(params);
    if (isValidationInvalid(paramsValidation)) {
      throw new Error(paramsValidation.error);
    }
    if (params.signal.method !== SESSION_SIGNAL_METHOD_PAIRING) {
      throw new Error(`Session proposal signal unsupported`);
    }
    const pairing = await this.client.pairing.settled.get(params.signal.params.topic);
    const signal: SessionTypes.Signal = {
      method: SESSION_SIGNAL_METHOD_PAIRING,
      params: { topic: pairing.topic },
    };
    const decryptKeys: CryptoTypes.DecryptKeys = {
      sharedKey: pairing.sharedKey,
    };
    const topic = generateRandomBytes32();
    const self = generateKeyPair();
    const proposer: SessionTypes.Peer = {
      publicKey: self.publicKey,
      metadata: params.metadata,
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
      status: SESSION_STATUS.proposed,
      topic: proposal.topic,
      relay: proposal.relay,
      self,
      proposal,
    };
    await this.pending.set(pending.topic, pending, { relay: pending.relay, decryptKeys });
    return pending;
  }

  protected async settle(params: SessionTypes.SettleParams): Promise<SessionTypes.Settled> {
    this.logger.info(`Settle Session`);
    this.logger.trace({ type: "method", method: "settle", params });
    const sharedKey = deriveSharedKey(params.self.privateKey, params.peer.publicKey);
    const topic = await sha256(sharedKey);
    const session: SessionTypes.Settled = {
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
    await this.settled.set(session.topic, session, { relay: session.relay, decryptKeys });
    return session;
  }

  protected async onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.info(`Receiving Session response`);
    this.logger.trace({ type: "method", method: "onResponse", topic, payload });
    const request = payload as JsonRpcRequest<SessionTypes.Outcome>;
    const pending = await this.pending.get(topic);
    const pairing = await this.client.pairing.get(pending.proposal.signal.params.topic);
    const encryptKeys: CryptoTypes.EncryptKeys = {
      sharedKey: pairing.sharedKey,
      publicKey: pairing.self.publicKey,
    };
    let errorMessage: string | undefined;
    if (!isSessionFailed(request.params)) {
      try {
        const session = await this.settle({
          relay: pending.relay,
          self: pending.self,
          peer: request.params.responder,
          permissions: formatSettledPermissions(
            pending.proposal.permissions,
            request.params.responder.publicKey,
          ),
          ttl: pending.proposal.ttl,
          expiry: request.params.expiry,
          state: request.params.state,
        });
        await this.pending.update(topic, {
          status: SESSION_STATUS.responded,
          outcome: {
            topic: session.topic,
            relay: session.relay,
            responder: session.peer,
            expiry: pairing.expiry,
            state: session.state,
          },
        });
      } catch (e) {
        this.logger.error(e);
        errorMessage = e.message;
        await this.pending.update(topic, {
          status: SESSION_STATUS.responded,
          outcome: { reason: e.message },
        });
      }
      const response =
        typeof errorMessage === "undefined"
          ? formatJsonRpcResult(request.id, true)
          : formatJsonRpcError(request.id, errorMessage);
      await this.client.relayer.publish(pending.topic, response, {
        relay: pending.relay,
        encryptKeys,
      });
    } else {
      this.logger.error(request.params.reason);
      await this.pending.update(topic, {
        status: SESSION_STATUS.responded,
        outcome: { reason: request.params.reason },
      });
    }
  }

  protected async onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.info(`Receiving Session acknowledge`);
    this.logger.trace({ type: "method", method: "onAcknowledge", topic, payload });
    const response = payload as JsonRpcResponse;
    const pending = await this.pending.get(topic);
    if (!isSessionResponded(pending)) return;
    if (isJsonRpcError(response) && !isSessionFailed(pending.outcome)) {
      await this.settled.delete(pending.outcome.topic, response.error.message);
    }
    await this.pending.delete(payloadEvent.topic, SESSION_REASONS.acknowledged);
  }

  protected async onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Session message`);
    this.logger.trace({ type: "method", method: "onMessage", topic, payload });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const session = await this.settled.get(payloadEvent.topic);
      let errorMessage = "";
      switch (request.method) {
        case SESSION_JSONRPC.payload:
          await this.onPayload(payloadEvent);
          break;
        case SESSION_JSONRPC.update:
          await this.onUpdate(payloadEvent);
          break;
        case SESSION_JSONRPC.notification:
          await this.onNotification(payloadEvent);
          break;
        case SESSION_JSONRPC.delete:
          await this.settled.delete(session.topic, request.params.reason);
          break;
        case SESSION_JSONRPC.ping:
          await this.send(session.topic, formatJsonRpcResult(request.id, false));
          break;
        default:
          errorMessage = `Unknown JSON-RPC Method Requested: ${request.method}`;
          this.logger.error(errorMessage);
          await this.send(session.topic, formatJsonRpcError(request.id, errorMessage));
          break;
      }
    } else {
      this.onPayloadEvent(payloadEvent);
    }
  }

  protected async onPayload(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    if (isJsonRpcRequest(payload)) {
      const { id, params } = payload as JsonRpcRequest<SessionTypes.Payload>;
      const request = formatJsonRpcRequest(params.request.method, params.request.params, id);
      const session = await this.settled.get(topic);
      if (!session.permissions.jsonrpc.methods.includes(request.method)) {
        const errorMessage = `Unauthorized JSON-RPC Method Requested: ${request.method}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      const sessionPayloadEvent: SessionTypes.PayloadEvent = {
        topic,
        payload: request,
        chainId: params.chainId,
      };
      this.logger.debug(`Receiving Session payload`);
      this.logger.trace({ type: "method", method: "onPayload", ...sessionPayloadEvent });
      this.onPayloadEvent(sessionPayloadEvent);
    } else {
      const sessionPayloadEvent: SessionTypes.PayloadEvent = {
        topic,
        payload,
      };
      this.logger.debug(`Receiving Session payload`);
      this.logger.trace({ type: "method", method: "onPayload", ...sessionPayloadEvent });
      this.onPayloadEvent(sessionPayloadEvent);
    }
  }

  protected async onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Session update`);
    this.logger.trace({ type: "method", method: "onUpdate", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const session = await this.settled.get(payloadEvent.topic);
    try {
      await this.handleUpdate(
        session,
        { topic, update: request.params },
        { publicKey: session.peer.publicKey },
      );
      const response = formatJsonRpcResult(request.id, true);
      await this.send(session.topic, response);
    } catch (e) {
      this.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      await this.send(session.topic, response);
    }
  }

  protected async handleUpdate(
    session: SessionTypes.Settled,
    params: SessionTypes.UpdateParams,
    participant: { publicKey: string },
  ): Promise<SessionTypes.Update> {
    let update: SessionTypes.Update;
    if (typeof params.update.state !== "undefined") {
      const state = session.state;
      if (participant.publicKey !== session.permissions.state.controller.publicKey) {
        const errorMessage = `Unauthorized session update request`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      state.accounts = params.update.state.accounts || state.accounts;
      update = { state };
    } else {
      const errorMessage = `Invalid session update request params`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    await this.settled.update(session.topic, session);
    return update;
  }

  protected async onNotification(event: SubscriptionEvent.Payload) {
    const notification = (event.payload as JsonRpcRequest<SessionTypes.Notification>).params;
    const notificationEvent: SessionTypes.NotificationEvent = {
      topic: event.topic,
      type: notification.type,
      data: notification.data,
    };
    this.logger.info(`Emitting ${SESSION_EVENTS.notification}`);
    this.logger.debug({ type: "event", event: SESSION_EVENTS.notification, notificationEvent });
    this.events.emit(SESSION_EVENTS.notification, notificationEvent);
  }

  // ---------- Private ----------------------------------------------- //

  private async onPayloadEvent(payloadEvent: SessionTypes.PayloadEvent) {
    const { topic, payload, chainId } = payloadEvent;
    if (isJsonRpcRequest(payload)) {
      if (await this.history.exists(topic, payload.id)) return;
      await this.history.set(topic, payload, chainId);
    } else {
      await this.history.update(topic, payload);
    }
    this.logger.info(`Emitting ${SESSION_EVENTS.payload}`);
    this.logger.debug({ type: "event", event: SESSION_EVENTS.payload, data: payloadEvent });
    this.events.emit(SESSION_EVENTS.payload, payloadEvent);
  }

  private async onPendingPayloadEvent(event: SubscriptionEvent.Payload) {
    if (isJsonRpcRequest(event.payload)) {
      switch (event.payload.method) {
        case SESSION_JSONRPC.approve:
        case SESSION_JSONRPC.reject:
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
      this.logger.info(`Emitting ${SESSION_EVENTS.responded}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.responded, data: pending });
      this.events.emit(SESSION_EVENTS.responded, pending);
      if (!isSubscriptionUpdatedEvent(event)) {
        const pairing = await this.client.pairing.get(pending.proposal.signal.params.topic);
        const encryptKeys: CryptoTypes.EncryptKeys = {
          sharedKey: pairing.sharedKey,
          publicKey: pairing.self.publicKey,
        };
        const method = !isSessionFailed(pending.outcome)
          ? SESSION_JSONRPC.approve
          : SESSION_JSONRPC.reject;
        const request = formatJsonRpcRequest(method, pending.outcome);
        await this.client.relayer.publish(pending.topic, request, {
          relay: pending.relay,
          encryptKeys,
        });
      }
    } else {
      this.logger.info(`Emitting ${SESSION_EVENTS.proposed}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.proposed, data: pending });
      this.events.emit(SESSION_EVENTS.proposed, pending);
      // send proposal signal through existing pairing
      const request = formatJsonRpcRequest(SESSION_JSONRPC.propose, pending.proposal);
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
        const session = createdEvent.data;
        this.logger.info(`Emitting ${SESSION_EVENTS.settled}`);
        this.logger.debug({ type: "event", event: SESSION_EVENTS.settled, data: session });
        this.events.emit(SESSION_EVENTS.settled, session);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<SessionTypes.Settled>) => {
        const session = updatedEvent.data;
        this.logger.info(`Emitting ${SESSION_EVENTS.updated}`);
        this.logger.debug({ type: "event", event: SESSION_EVENTS.updated, data: session });
        this.events.emit(SESSION_EVENTS.updated, session);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.deleted,
      async (deletedEvent: SubscriptionEvent.Deleted<SessionTypes.Settled>) => {
        const session = deletedEvent.data;
        this.logger.info(`Emitting ${SESSION_EVENTS.deleted}`);
        this.logger.debug({ type: "event", event: SESSION_EVENTS.deleted, data: session });
        this.events.emit(SESSION_EVENTS.deleted, session);
        const request = formatJsonRpcRequest(SESSION_JSONRPC.delete, {
          reason: deletedEvent.reason,
        });
        await this.history.delete(session.topic);
        await this.send(session.topic, request);
      },
    );
  }
}

function formatSettledPermissions(
  permissions: SessionTypes.ProposedPermissions,
  controllerPublicKey: string,
): SessionTypes.SettledPermissions {
  const controller: CryptoTypes.Participant = { publicKey: controllerPublicKey };
  return {
    ...permissions,
    notifications: {
      types: permissions.notifications.types,
      controller,
    },
    state: {
      controller,
    },
  };
}
