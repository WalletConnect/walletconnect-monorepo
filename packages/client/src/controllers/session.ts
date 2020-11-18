import { EventEmitter } from "events";
import { Logger } from "pino";
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
  mapEntries,
  sha256,
  formatLoggerContext,
  isSessionResponded,
  isSubscriptionUpdatedEvent,
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
} from "rpc-json-utils";

import { Subscription } from "./subscription";
import {
  SESSION_CONTEXT,
  SESSION_EVENTS,
  SESSION_JSONRPC,
  SESSION_REASONS,
  SESSION_STATUS,
  SUBSCRIPTION_EVENTS,
  SESSION_SIGNAL_METHOD_CONNECTION,
  SESSION_DEFAULT_SUBSCRIBE_TTL,
} from "../constants";

export class Session extends ISession {
  public pending: Subscription<SessionTypes.Pending>;
  public settled: Subscription<SessionTypes.Settled>;

  public events = new EventEmitter();

  protected context: string = SESSION_CONTEXT;

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = logger.child({
      context: formatLoggerContext(logger, this.context),
    });
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
    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.pending.init();
    await this.settled.init();
  }

  public async get(topic: string): Promise<SessionTypes.Settled> {
    return this.settled.get(topic);
  }

  public async send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void> {
    const session = await this.settled.get(topic);
    const encryptKeys: CryptoTypes.EncryptKeys = {
      sharedKey: session.sharedKey,
      publicKey: session.self.publicKey,
    };
    if (isJsonRpcRequest(payload) && !Object.values(SESSION_JSONRPC).includes(payload.method)) {
      if (!session.permissions.jsonrpc.methods.includes(payload.method)) {
        const errorMessage = `Unauthorized JSON-RPC Method Requested: ${payload.method}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      payload = formatJsonRpcRequest<SessionTypes.Payload>(SESSION_JSONRPC.payload, {
        chainId,
        payload,
      });
    }
    this.client.relay.publish(session.topic, payload, { relay: session.relay, encryptKeys });
  }

  get length(): number {
    return this.settled.length;
  }

  get entries(): Record<string, SessionTypes.Settled> {
    return mapEntries(this.settled.entries, x => x.data);
  }

  public async create(params: SessionTypes.CreateParams): Promise<SessionTypes.Settled> {
    this.logger.info(`Create Session`);
    this.logger.trace({ type: "method", method: "create", params });
    return new Promise(async (resolve, reject) => {
      const pending = await this.propose(params);
      this.pending.on(
        SUBSCRIPTION_EVENTS.updated,
        async (updatedEvent: SubscriptionEvent.Updated<SessionTypes.Pending>) => {
          if (pending.topic !== updatedEvent.data.topic) return;
          if (isSessionResponded(updatedEvent.data)) {
            const outcome = updatedEvent.data.outcome;
            if (isSessionFailed(outcome)) {
              await this.pending.delete(pending.topic, outcome.reason);
              reject(new Error(outcome.reason));
            } else {
              const connection = await this.settled.get(outcome.topic);
              await this.pending.delete(pending.topic, SESSION_REASONS.settled);
              resolve(connection);
            }
          }
        },
      );
    });
  }

  public async respond(params: SessionTypes.RespondParams): Promise<SessionTypes.Pending> {
    this.logger.info(`Respond Session`);
    this.logger.trace({ type: "method", method: "respond", params });
    const { approved, proposal, response } = params;
    const { relay } = proposal;
    const self = generateKeyPair();
    const connection = await this.client.connection.get(proposal.signal.params.topic);
    const decryptKeys: CryptoTypes.DecryptKeys = {
      sharedKey: connection.sharedKey,
    };
    if (approved) {
      try {
        const responder: SessionTypes.Peer = {
          publicKey: self.publicKey,
          metadata: response.metadata,
        };
        const expiry = Date.now() + proposal.ttl;

        const state: SessionTypes.State = {
          accountIds: params.response.state.accountIds,
          controller: { publicKey: self.publicKey },
        };
        const session = await this.settle({
          relay,
          self,
          peer: proposal.proposer,
          permissions: proposal.permissions,
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
        await this.pending.set(pending.topic, pending, {
          relay: pending.relay,
          decryptKeys,
          ttl: proposal.ttl,
        });
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
        await this.pending.set(pending.topic, pending, {
          relay: pending.relay,
          decryptKeys,
          ttl: proposal.ttl,
        });
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
      await this.pending.set(pending.topic, pending, {
        relay: pending.relay,
        decryptKeys,
        ttl: proposal.ttl,
      });
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
    this.send(session.topic, request);
    return session;
  }

  public async delete(params: SessionTypes.DeleteParams): Promise<void> {
    this.logger.info(`Delete Session`);
    this.logger.trace({ type: "method", method: "delete", params });
    this.settled.delete(params.topic, params.reason);
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

  // ---------- Protected ----------------------------------------------- //

  protected async propose(params: SessionTypes.ProposeParams): Promise<SessionTypes.Pending> {
    this.logger.info(`Propose Session`);
    this.logger.trace({ type: "method", method: "propose", params });
    if (params.signal.method !== SESSION_SIGNAL_METHOD_CONNECTION)
      throw new Error(`Session proposal signal unsupported`);
    const connection = await this.client.connection.settled.get(params.signal.params.topic);
    const signal: SessionTypes.Signal = {
      method: SESSION_SIGNAL_METHOD_CONNECTION,
      params: { topic: connection.topic },
    };
    const decryptKeys: CryptoTypes.DecryptKeys = {
      sharedKey: connection.sharedKey,
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
      ttl: params.ttl || SESSION_DEFAULT_SUBSCRIBE_TTL,
    };
    const pending: SessionTypes.Pending = {
      status: SESSION_STATUS.proposed,
      topic: proposal.topic,
      relay: proposal.relay,
      self,
      proposal,
    };
    await this.pending.set(pending.topic, pending, {
      relay: pending.relay,
      decryptKeys,
      ttl: proposal.ttl,
    });
    const request = formatJsonRpcRequest(SESSION_JSONRPC.propose, proposal);
    await this.client.connection.send(signal.params.topic, request);
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
    await this.settled.set(session.topic, session, {
      relay: session.relay,
      decryptKeys,
      ttl: params.ttl,
    });
    return session;
  }

  protected async onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.info(`Receiving Session response`);
    this.logger.trace({ type: "method", method: "onResponse", topic, payload });
    const request = payload as JsonRpcRequest<SessionTypes.Outcome>;
    const pending = await this.pending.get(topic);
    const connection = await this.client.connection.get(pending.proposal.signal.params.topic);
    const encryptKeys: CryptoTypes.EncryptKeys = {
      sharedKey: connection.sharedKey,
      publicKey: connection.self.publicKey,
    };
    let errorMessage: string | undefined;
    if (!isSessionFailed(request.params)) {
      try {
        const session = await this.settle({
          relay: pending.relay,
          self: pending.self,
          peer: request.params.responder,
          permissions: pending.proposal.permissions,
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
            expiry: connection.expiry,
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
      this.client.relay.publish(pending.topic, response, { relay: pending.relay, encryptKeys });
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
    this.logger.debug(`Receiving Connection message`);
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
        case SESSION_JSONRPC.delete:
          await this.settled.delete(session.topic, request.params.reason);
          break;
        default:
          errorMessage = `Unknown JSON-RPC Method Requested: ${request.method}`;
          this.logger.error(errorMessage);
          this.send(session.topic, formatJsonRpcError(request.id, errorMessage));
          break;
      }
    } else {
      this.logger.info(`Emitting ${SESSION_EVENTS.payload}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.payload, data: payloadEvent });
      this.events.emit(SESSION_EVENTS.payload, payloadEvent);
    }
  }

  protected async onPayload(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic } = payloadEvent;
    const request = payloadEvent.payload as JsonRpcRequest<SessionTypes.Payload>;
    const { payload, chainId } = request.params;
    const sessionPayloadEvent: SessionTypes.PayloadEvent = { topic, payload, chainId };
    this.logger.debug(`Receiving Connection payload`);
    this.logger.trace({ type: "method", method: "onPayload", ...sessionPayloadEvent });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const session = await this.settled.get(topic);
      if (!session.permissions.jsonrpc.methods.includes(request.method)) {
        const errorMessage = `Unauthorized JSON-RPC Method Requested: ${request.method}`;
        this.logger.error(errorMessage);
        this.send(session.topic, formatJsonRpcError(request.id, errorMessage));
        return;
      }
      this.logger.info(`Emitting ${SESSION_EVENTS.payload}`);
      this.logger.debug({
        type: "event",
        event: SESSION_EVENTS.payload,
        data: sessionPayloadEvent,
      });
      this.events.emit(SESSION_EVENTS.payload, sessionPayloadEvent);
    } else {
      this.logger.info(`Emitting ${SESSION_EVENTS.payload}`);
      this.logger.debug({
        type: "event",
        event: SESSION_EVENTS.payload,
        data: sessionPayloadEvent,
      });
      this.events.emit(SESSION_EVENTS.payload, sessionPayloadEvent);
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
      this.send(session.topic, response);
    } catch (e) {
      this.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      this.send(session.topic, response);
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
      if (participant.publicKey === state.controller.publicKey) {
        state.accountIds = params.update.state.accountIds || state.accountIds;
      }
      update = { state };
    } else {
      const errorMessage = `Invalid ${this.context} update request params`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    await this.settled.update(session.topic, session);
    return update;
  }

  // ---------- Private ----------------------------------------------- //

  private async onPendingPayloadEvent(event: SubscriptionEvent.Payload) {
    if (isJsonRpcRequest(event.payload)) {
      if (event.payload.method === SESSION_JSONRPC.respond) {
        this.onResponse(event);
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
        const connection = await this.client.connection.get(pending.proposal.signal.params.topic);
        const encryptKeys: CryptoTypes.EncryptKeys = {
          sharedKey: connection.sharedKey,
          publicKey: connection.self.publicKey,
        };
        const request = formatJsonRpcRequest(SESSION_JSONRPC.respond, pending.outcome);
        this.client.relay.publish(pending.topic, request, { relay: pending.relay, encryptKeys });
      }
    } else {
      this.logger.info(`Emitting ${SESSION_EVENTS.proposed}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.proposed, data: pending });
      this.events.emit(SESSION_EVENTS.proposed, pending);
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
      (deletedEvent: SubscriptionEvent.Deleted<SessionTypes.Settled>) => {
        const session = deletedEvent.data;
        this.logger.info(`Emitting ${SESSION_EVENTS.deleted}`);
        this.logger.debug({ type: "event", event: SESSION_EVENTS.deleted, data: session });
        this.events.emit(SESSION_EVENTS.deleted, session);
        const request = formatJsonRpcRequest(SESSION_JSONRPC.delete, {
          reason: deletedEvent.reason,
        });
        this.send(session.topic, request);
      },
    );
  }
}
