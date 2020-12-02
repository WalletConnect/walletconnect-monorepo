import { EventEmitter } from "events";
import { Logger } from "pino";
import {
  ConnectionTypes,
  IClient,
  IConnection,
  SubscriptionEvent,
  CryptoTypes,
} from "@walletconnect/types";
import {
  deriveSharedKey,
  generateKeyPair,
  generateRandomBytes32,
  isConnectionFailed,
  mapEntries,
  sha256,
  formatLoggerContext,
  isConnectionResponded,
  formatUri,
  isSubscriptionUpdatedEvent,
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
import {
  CONNECTION_CONTEXT,
  CONNECTION_EVENTS,
  CONNECTION_JSONRPC,
  CONNECTION_REASONS,
  CONNECTION_STATUS,
  SUBSCRIPTION_EVENTS,
  RELAY_DEFAULT_PROTOCOL,
  CONNECTION_SIGNAL_METHOD_URI,
  SESSION_JSONRPC,
  CONNECTION_DEFAULT_SUBSCRIBE_TTL,
} from "../constants";

export class Connection extends IConnection {
  public pending: Subscription<ConnectionTypes.Pending>;
  public settled: Subscription<ConnectionTypes.Settled>;

  public events = new EventEmitter();

  protected context: string = CONNECTION_CONTEXT;

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = logger.child({
      context: formatLoggerContext(logger, this.context),
    });
    this.pending = new Subscription<ConnectionTypes.Pending>(
      client,
      this.logger,
      CONNECTION_STATUS.pending,
      false,
    );
    this.settled = new Subscription<ConnectionTypes.Settled>(
      client,
      this.logger,
      CONNECTION_STATUS.settled,
      true,
    );
    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.pending.init();
    await this.settled.init();
  }

  public async get(topic: string): Promise<ConnectionTypes.Settled> {
    return this.settled.get(topic);
  }

  public async send(topic: string, payload: JsonRpcPayload): Promise<void> {
    const connection = await this.settled.get(topic);
    const encryptKeys: CryptoTypes.EncryptKeys = {
      sharedKey: connection.sharedKey,
      publicKey: connection.self.publicKey,
    };
    if (isJsonRpcRequest(payload) && !Object.values(CONNECTION_JSONRPC).includes(payload.method)) {
      if (!connection.permissions.jsonrpc.methods.includes(payload.method)) {
        const errorMessage = `Unauthorized JSON-RPC Method Requested: ${payload.method}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      payload = formatJsonRpcRequest<ConnectionTypes.Payload>(CONNECTION_JSONRPC.payload, {
        payload,
      });
    }
    this.client.relay.publish(connection.topic, payload, { relay: connection.relay, encryptKeys });
  }

  get length(): number {
    return this.settled.length;
  }

  get entries(): Record<string, ConnectionTypes.Settled> {
    return mapEntries(this.settled.entries, x => x.data);
  }

  public async create(params?: ConnectionTypes.CreateParams): Promise<ConnectionTypes.Settled> {
    this.logger.debug(`Create Connection`);
    this.logger.trace({ type: "method", method: "create", params });
    return new Promise(async (resolve, reject) => {
      const pending = await this.propose(params);
      this.pending.on(
        SUBSCRIPTION_EVENTS.updated,
        async (updatedEvent: SubscriptionEvent.Updated<ConnectionTypes.Pending>) => {
          if (pending.topic !== updatedEvent.data.topic) return;
          if (isConnectionResponded(updatedEvent.data)) {
            const outcome = updatedEvent.data.outcome;
            if (isConnectionFailed(outcome)) {
              await this.pending.delete(pending.topic, outcome.reason);
              reject(new Error(outcome.reason));
            } else {
              const connection = await this.settled.get(outcome.topic);
              await this.pending.delete(pending.topic, CONNECTION_REASONS.settled);
              resolve(connection);
            }
          }
        },
      );
    });
  }

  public async respond(params: ConnectionTypes.RespondParams): Promise<ConnectionTypes.Pending> {
    this.logger.debug(`Respond Connection`);
    this.logger.trace({ type: "method", method: "respond", params });
    const { approved, proposal } = params;
    const self = generateKeyPair();
    if (approved) {
      try {
        const responder: ConnectionTypes.Peer = {
          publicKey: self.publicKey,
        };
        const expiry = Date.now() + proposal.ttl;
        const connection = await this.settle({
          relay: proposal.relay,
          self,
          peer: proposal.proposer,
          permissions: proposal.permissions,
          ttl: proposal.ttl,
          expiry,
        });
        const outcome: ConnectionTypes.Outcome = {
          topic: connection.topic,
          relay: connection.relay,
          responder,
          expiry,
        };
        const pending: ConnectionTypes.Pending = {
          status: CONNECTION_STATUS.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          self,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay, ttl: proposal.ttl });
        return pending;
      } catch (e) {
        const reason = e.message;
        const outcome: ConnectionTypes.Outcome = { reason };
        const pending: ConnectionTypes.Pending = {
          status: CONNECTION_STATUS.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          self,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay, ttl: proposal.ttl });
        return pending;
      }
    } else {
      const outcome: ConnectionTypes.Outcome = { reason: CONNECTION_REASONS.not_approved };
      const pending: ConnectionTypes.Pending = {
        status: CONNECTION_STATUS.responded,
        topic: proposal.topic,
        relay: proposal.relay,
        self,
        proposal,
        outcome,
      };
      await this.pending.set(pending.topic, pending, { relay: pending.relay, ttl: proposal.ttl });
      return pending;
    }
  }

  public async update(params: ConnectionTypes.UpdateParams): Promise<ConnectionTypes.Settled> {
    this.logger.debug(`Update Connection`);
    this.logger.trace({ type: "method", method: "update", params });
    const connection = await this.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: connection.self.publicKey };
    const update = await this.handleUpdate(connection, params, participant);
    const request = formatJsonRpcRequest(CONNECTION_JSONRPC.update, update);
    this.send(connection.topic, request);
    return connection;
  }

  public async delete(params: ConnectionTypes.DeleteParams): Promise<void> {
    this.logger.debug(`Delete Connection`);
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

  // ---------- Protected ----------------------------------------------- //

  protected async propose(
    params?: ConnectionTypes.ProposeParams,
  ): Promise<ConnectionTypes.Pending> {
    this.logger.debug(`Propose Connection`);
    this.logger.trace({ type: "method", method: "propose", params });
    const relay = params?.relay || { protocol: RELAY_DEFAULT_PROTOCOL };
    const topic = generateRandomBytes32();
    const self = generateKeyPair();
    const proposer: ConnectionTypes.Peer = {
      publicKey: self.publicKey,
    };
    const uri = formatUri({
      protocol: this.client.protocol,
      version: this.client.version,
      topic: topic,
      publicKey: proposer.publicKey,
      relay: relay,
    });
    const permissions: ConnectionTypes.Permissions = {
      jsonrpc: {
        methods: [SESSION_JSONRPC.propose],
      },
    };
    const proposal: ConnectionTypes.Proposal = {
      relay,
      topic,
      proposer,
      signal: {
        method: CONNECTION_SIGNAL_METHOD_URI,
        params: { uri },
      },
      permissions,
      ttl: CONNECTION_DEFAULT_SUBSCRIBE_TTL,
    };
    const pending: ConnectionTypes.Pending = {
      status: CONNECTION_STATUS.proposed,
      topic: proposal.topic,
      relay: proposal.relay,
      self,
      proposal,
    };
    await this.pending.set(pending.topic, pending, { relay, ttl: proposal.ttl });
    return pending;
  }

  protected async settle(params: ConnectionTypes.SettleParams): Promise<ConnectionTypes.Settled> {
    this.logger.debug(`Settle Connection`);
    this.logger.trace({ type: "method", method: "settle", params });
    const sharedKey = deriveSharedKey(params.self.privateKey, params.peer.publicKey);
    const topic = await sha256(sharedKey);
    const connection: ConnectionTypes.Settled = {
      topic,
      relay: params.relay,
      sharedKey,
      self: params.self,
      peer: params.peer,
      permissions: params.permissions,
      expiry: params.expiry,
    };
    const decryptKeys: CryptoTypes.DecryptKeys = {
      sharedKey,
    };
    await this.settled.set(connection.topic, connection, {
      relay: connection.relay,
      decryptKeys,
      ttl: params.ttl,
    });
    return connection;
  }

  protected async onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Connection response`);
    this.logger.trace({ type: "method", method: "onResponse", topic, payload });
    const request = payload as JsonRpcRequest<ConnectionTypes.Outcome>;
    const pending = await this.pending.get(topic);
    let errorMessage: string | undefined;
    if (!isConnectionFailed(request.params)) {
      try {
        const connection = await this.settle({
          relay: pending.relay,
          self: pending.self,
          peer: request.params.responder,
          permissions: pending.proposal.permissions,
          ttl: pending.proposal.ttl,
          expiry: request.params.expiry,
        });
        await this.pending.update(topic, {
          status: CONNECTION_STATUS.responded,
          outcome: {
            topic: connection.topic,
            relay: connection.relay,
            responder: request.params.responder,
            expiry: connection.expiry,
          },
        });
      } catch (e) {
        this.logger.error(e);
        errorMessage = e.message;
        await this.pending.update(topic, {
          status: CONNECTION_STATUS.responded,
          outcome: { reason: e.message },
        });
      }
      const response =
        typeof errorMessage === "undefined"
          ? formatJsonRpcResult(request.id, true)
          : formatJsonRpcError(request.id, errorMessage);
      this.client.relay.publish(pending.topic, response, { relay: pending.relay });
    } else {
      this.logger.error(request.params.reason);
      await this.pending.update(topic, {
        status: CONNECTION_STATUS.responded,
        outcome: { reason: request.params.reason },
      });
    }
  }

  protected async onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Connection acknowledge`);
    this.logger.trace({ type: "method", method: "onAcknowledge", topic, payload });
    const response = payload as JsonRpcResponse;
    const pending = await this.pending.get(topic);
    if (!isConnectionResponded(pending)) return;
    if (isJsonRpcError(response) && !isConnectionFailed(pending.outcome)) {
      await this.settled.delete(pending.outcome.topic, response.error.message);
    }
    await this.pending.delete(topic, CONNECTION_REASONS.acknowledged);
  }

  protected async onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Connection message`);
    this.logger.trace({ type: "method", method: "onMessage", topic, payload });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const connection = await this.settled.get(payloadEvent.topic);
      let errorMessage = "";
      switch (request.method) {
        case CONNECTION_JSONRPC.payload:
          await this.onPayload(payloadEvent);
          break;
        case CONNECTION_JSONRPC.update:
          await this.onUpdate(payloadEvent);
          break;
        case CONNECTION_JSONRPC.delete:
          await this.settled.delete(connection.topic, request.params.reason);
          break;
        default:
          errorMessage = `Unknown JSON-RPC Method Requested: ${request.method}`;
          this.logger.error(errorMessage);
          this.send(connection.topic, formatJsonRpcError(request.id, errorMessage));
          break;
      }
    } else {
      this.onPayloadEvent(payloadEvent);
    }
  }

  protected async onPayload(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic } = payloadEvent;
    const request = payloadEvent.payload as JsonRpcRequest<ConnectionTypes.Payload>;
    const { payload } = request.params;
    const connectionPayloadEvent: ConnectionTypes.PayloadEvent = { topic, payload };
    this.logger.debug(`Receiving Connection payload`);
    this.logger.trace({ type: "method", method: "onPayload", ...connectionPayloadEvent });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const connection = await this.settled.get(topic);
      if (!connection.permissions.jsonrpc.methods.includes(request.method)) {
        const errorMessage = `Unauthorized JSON-RPC Method Requested: ${request.method}`;
        this.logger.error(errorMessage);
        this.send(connection.topic, formatJsonRpcError(request.id, errorMessage));
        return;
      }
      this.onPayloadEvent(connectionPayloadEvent);
    } else {
      this.onPayloadEvent(connectionPayloadEvent);
    }
  }

  protected async onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Connection update`);
    this.logger.trace({ type: "method", method: "onUpdate", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const connection = await this.settled.get(payloadEvent.topic);
    try {
      const participant: CryptoTypes.Participant = { publicKey: connection.peer.publicKey };
      await this.handleUpdate(connection, { topic, update: request.params }, participant);
      const response = formatJsonRpcResult(request.id, true);
      this.send(connection.topic, response);
    } catch (e) {
      this.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      this.send(connection.topic, response);
    }
  }

  protected async handleUpdate(
    connection: ConnectionTypes.Settled,
    params: ConnectionTypes.UpdateParams,
    participant: { publicKey: string },
  ): Promise<ConnectionTypes.Update> {
    let update: ConnectionTypes.Update;
    if (typeof params.update.peer !== "undefined") {
      const metadata = params.update.peer.metadata as ConnectionTypes.Metadata;
      if (connection.peer.publicKey === participant.publicKey) {
        connection.peer.metadata = metadata;
      }
      update = { peer: { metadata } };
    } else {
      const errorMessage = `Invalid ${this.context} update request params`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    await this.settled.update(connection.topic, connection);
    return update;
  }

  // ---------- Private ----------------------------------------------- //

  private async onPayloadEvent(payloadEvent: ConnectionTypes.PayloadEvent) {
    this.logger.info(`Emitting ${CONNECTION_EVENTS.payload}`);
    this.logger.debug({ type: "event", event: CONNECTION_EVENTS.payload, data: payloadEvent });
    this.events.emit(CONNECTION_EVENTS.payload, payloadEvent);
  }

  private async onPendingPayloadEvent(event: SubscriptionEvent.Payload) {
    if (isJsonRpcRequest(event.payload)) {
      if (event.payload.method === CONNECTION_JSONRPC.respond) {
        this.onResponse(event);
      }
    } else {
      this.onAcknowledge(event);
    }
  }

  private async onPendingStatusEvent(
    event:
      | SubscriptionEvent.Created<ConnectionTypes.Pending>
      | SubscriptionEvent.Updated<ConnectionTypes.Pending>,
  ) {
    const pending = event.data;
    if (isConnectionResponded(pending)) {
      this.logger.info(`Emitting ${CONNECTION_EVENTS.responded}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.responded, data: pending });
      this.events.emit(CONNECTION_EVENTS.responded, pending);
      if (!isSubscriptionUpdatedEvent(event)) {
        const request = formatJsonRpcRequest(CONNECTION_JSONRPC.respond, pending.outcome);
        this.client.relay.publish(pending.topic, request, { relay: pending.relay });
      }
    } else {
      this.logger.info(`Emitting ${CONNECTION_EVENTS.proposed}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.proposed, data: pending });
      this.events.emit(CONNECTION_EVENTS.proposed, pending);
    }
  }

  private registerEventListeners(): void {
    // Pending Subscription Events
    this.pending.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onPendingPayloadEvent(payloadEvent),
    );
    this.pending.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<ConnectionTypes.Pending>) =>
        this.onPendingStatusEvent(createdEvent),
    );
    this.pending.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<ConnectionTypes.Pending>) =>
        this.onPendingStatusEvent(updatedEvent),
    );
    // Settled Subscription Events
    this.settled.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onMessage(payloadEvent),
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<ConnectionTypes.Settled>) => {
        const connection = createdEvent.data;
        this.logger.info(`Emitting ${CONNECTION_EVENTS.settled}`);
        this.logger.debug({ type: "event", event: CONNECTION_EVENTS.settled, data: connection });
        this.events.emit(CONNECTION_EVENTS.settled, connection);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<ConnectionTypes.Settled>) => {
        const connection = updatedEvent.data;
        this.logger.info(`Emitting ${CONNECTION_EVENTS.updated}`);
        this.logger.debug({ type: "event", event: CONNECTION_EVENTS.updated, data: connection });
        this.events.emit(CONNECTION_EVENTS.updated, connection);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.deleted,
      (deletedEvent: SubscriptionEvent.Deleted<ConnectionTypes.Settled>) => {
        const connection = deletedEvent.data;
        this.logger.info(`Emitting ${CONNECTION_EVENTS.deleted}`);
        this.logger.debug({ type: "event", event: CONNECTION_EVENTS.deleted, data: connection });
        this.events.emit(CONNECTION_EVENTS.deleted, connection);
        const request = formatJsonRpcRequest(CONNECTION_JSONRPC.delete, {
          reason: deletedEvent.reason,
        });
        this.client.relay.publish(connection.topic, request, { relay: connection.relay });
      },
    );
  }
}
