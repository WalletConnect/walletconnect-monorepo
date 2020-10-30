import { EventEmitter } from "events";
import { Logger } from "pino";
import { ConnectionTypes, IClient, IConnection, SubscriptionEvent } from "@walletconnect/types";
import {
  deriveSharedKey,
  generateKeyPair,
  generateRandomBytes32,
  getConnectionMetadata,
  isConnectionFailed,
  mapEntries,
  sha256,
  formatLoggerContext,
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
} from "rpc-json-utils";

import { Subscription } from "./subscription";
import {
  CONNECTION_CONTEXT,
  CONNECTION_EVENTS,
  CONNECTION_JSONRPC_AFTER_SETTLEMENT,
  CONNECTION_JSONRPC,
  CONNECTION_REASONS,
  CONNECTION_STATUS,
  SESSION_JSONRPC_BEFORE_SETTLEMENT,
  SUBSCRIPTION_EVENTS,
  RELAY_DEFAULT_PROTOCOL,
} from "../constants";

export class Connection extends IConnection {
  public proposed: Subscription<ConnectionTypes.Proposed>;
  public responded: Subscription<ConnectionTypes.Responded>;
  public settled: Subscription<ConnectionTypes.Settled>;

  public events = new EventEmitter();

  protected context: string = CONNECTION_CONTEXT;

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = logger.child({
      context: formatLoggerContext(logger, this.context),
    });

    this.proposed = new Subscription<ConnectionTypes.Proposed>(
      client,
      {
        name: this.context,
        status: CONNECTION_STATUS.proposed,
        encrypted: false,
      },
      this.logger,
    );
    this.responded = new Subscription<ConnectionTypes.Responded>(
      client,
      {
        name: this.context,
        status: CONNECTION_STATUS.responded,
        encrypted: false,
      },
      this.logger,
    );
    this.settled = new Subscription<ConnectionTypes.Settled>(
      client,
      {
        name: this.context,
        status: CONNECTION_STATUS.settled,
        encrypted: true,
      },
      this.logger,
    );
    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.trace({ type: "init" });
    await this.proposed.init();
    await this.responded.init();
    await this.settled.init();
  }

  public async get(topic: string): Promise<ConnectionTypes.Settled> {
    return this.settled.get(topic);
  }

  get length(): number {
    return this.settled.length;
  }

  get entries(): Record<string, ConnectionTypes.Settled> {
    return mapEntries(this.settled.entries, x => x.data);
  }

  public async create(params?: ConnectionTypes.CreateParams): Promise<ConnectionTypes.Settled> {
    return new Promise(async (resolve, reject) => {
      const proposal = await this.propose(params);
      this.proposed.on(SUBSCRIPTION_EVENTS.deleted, async (proposed: ConnectionTypes.Proposed) => {
        if (proposed.topic !== proposal.topic) return;
        const responded: ConnectionTypes.Responded = await this.responded.get(proposal.topic);
        if (isConnectionFailed(responded.outcome)) {
          await this.responded.delete(responded.topic, responded.outcome.reason);
          reject(new Error(responded.outcome.reason));
        } else {
          const connection = await this.settled.get(responded.outcome.topic);
          await this.responded.delete(responded.topic, CONNECTION_REASONS.settled);
          resolve(connection);
        }
      });
    });
  }

  public async respond(params: ConnectionTypes.RespondParams): Promise<ConnectionTypes.Responded> {
    const { approved, proposal } = params;
    if (approved) {
      try {
        const keyPair = generateKeyPair();
        const relay = proposal.relay;
        const connection = await this.settle({
          relay,
          keyPair,
          peer: {
            publicKey: proposal.peer.publicKey,
          },
        });

        const responded: ConnectionTypes.Responded = {
          ...proposal,
          outcome: connection,
        };
        await this.responded.set(responded.topic, responded, { relay: responded.relay });
        return responded;
      } catch (e) {
        const reason = e.message;
        const responded: ConnectionTypes.Responded = {
          ...proposal,
          outcome: { reason },
        };
        await this.responded.set(responded.topic, responded, { relay: responded.relay });
        return responded;
      }
    } else {
      const responded: ConnectionTypes.Responded = {
        ...proposal,
        outcome: { reason: CONNECTION_REASONS.not_approved },
      };
      await this.responded.set(responded.topic, responded, { relay: responded.relay });
      return responded;
    }
  }

  public async update(params: ConnectionTypes.UpdateParams): Promise<ConnectionTypes.Settled> {
    const connection = await this.settled.get(params.topic);
    const update = await this.handleUpdate(connection, params);
    const request = formatJsonRpcRequest(CONNECTION_JSONRPC.update, update);
    this.client.relay.publish(connection.topic, request, {
      relay: connection.relay,
      encrypt: {
        sharedKey: connection.sharedKey,
        publicKey: connection.keyPair.publicKey,
      },
    });
    return connection;
  }

  public async delete(params: ConnectionTypes.DeleteParams): Promise<void> {
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
  ): Promise<ConnectionTypes.Proposal> {
    const relay = params?.relay || { protocol: RELAY_DEFAULT_PROTOCOL };
    const topic = generateRandomBytes32();
    const keyPair = generateKeyPair();
    const proposal: ConnectionTypes.Proposal = {
      relay,
      topic,
      peer: { publicKey: keyPair.publicKey },
    };
    const proposed: ConnectionTypes.Proposed = {
      ...proposal,
      keyPair,
    };
    await this.proposed.set(proposed.topic, proposed, { relay });

    return proposal;
  }

  protected async settle(params: ConnectionTypes.SettleParams): Promise<ConnectionTypes.Settled> {
    const sharedKey = deriveSharedKey(params.keyPair.privateKey, params.peer.publicKey);
    const connection: ConnectionTypes.Settled = {
      relay: params.relay,
      topic: await sha256(sharedKey),
      sharedKey,
      keyPair: params.keyPair,
      peer: params.peer,
      state: {},
      rules: {
        state: {},
        jsonrpc: [...CONNECTION_JSONRPC_AFTER_SETTLEMENT, ...SESSION_JSONRPC_BEFORE_SETTLEMENT],
      },
    };
    await this.settled.set(connection.topic, connection, {
      relay: connection.relay,
      decrypt: {
        sharedKey: connection.sharedKey,
        publicKey: connection.peer.publicKey,
      },
    });
    return connection;
  }

  protected async onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    const request = payload as JsonRpcRequest;
    const outcome = request.params as ConnectionTypes.Outcome;
    const proposed = await this.proposed.get(topic);
    const { relay } = proposed;
    if (!isConnectionFailed(outcome)) {
      try {
        const connection = await this.settle({
          relay: relay,
          keyPair: proposed.keyPair,
          peer: {
            publicKey: request.params.publicKey,
          },
        });
        const response = formatJsonRpcResult(request.id, true);
        this.client.relay.publish(topic, response, { relay });
        const responded: ConnectionTypes.Responded = {
          relay: relay,
          topic: proposed.topic,
          peer: { publicKey: proposed.keyPair.publicKey },
          outcome: connection,
        };
        await this.responded.set(topic, responded, { relay });
      } catch (e) {
        const reason = e.message;
        const response = formatJsonRpcError(request.id, reason);
        this.client.relay.publish(topic, response, { relay });
        const responded: ConnectionTypes.Responded = {
          relay: relay,
          topic: proposed.topic,
          peer: { publicKey: proposed.keyPair.publicKey },
          outcome: { reason },
        };
        await this.responded.set(topic, responded, { relay });
      }
    } else {
      const reason = outcome.reason;
      const response = formatJsonRpcError(request.id, reason);
      this.client.relay.publish(topic, response, { relay });
      const responded: ConnectionTypes.Responded = {
        relay: relay,
        topic: proposed.topic,
        peer: { publicKey: proposed.keyPair.publicKey },
        outcome: { reason },
      };
      await this.responded.set(topic, responded, { relay });
    }
    await this.proposed.delete(topic, CONNECTION_REASONS.responded);
  }

  protected async onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    const response = payload as JsonRpcResponse;
    const responded = await this.responded.get(topic);
    if (isJsonRpcError(response) && !isConnectionFailed(responded.outcome)) {
      await this.settled.delete(responded.outcome.topic, response.error.message);
    }
    await this.responded.delete(topic, CONNECTION_REASONS.acknowledged);
  }

  protected async onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const payload = payloadEvent.payload as JsonRpcPayload;
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const connection = await this.settled.get(payloadEvent.topic);
      if (!connection.rules.jsonrpc.includes(request.method)) {
        const response = formatJsonRpcError(
          request.id,
          `Unauthorized JSON-RPC Method Requested: ${request.method}`,
        );
        this.client.relay.publish(connection.topic, response);
      }
      switch (request.method) {
        case CONNECTION_JSONRPC.update:
          await this.onUpdate(payloadEvent);
          break;
        case CONNECTION_JSONRPC.delete:
          await this.settled.delete(connection.topic, request.params.reason);
          break;
        default:
          this.events.emit(CONNECTION_EVENTS.payload, payloadEvent.payload);
          break;
      }
    } else {
      this.events.emit(CONNECTION_EVENTS.payload, payloadEvent.payload);
    }
  }

  protected async onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const request = payloadEvent.payload as JsonRpcRequest;
    const connection = await this.settled.get(payloadEvent.topic);
    try {
      await this.handleUpdate(connection, request.params, true);
      const response = formatJsonRpcResult(request.id, true);
      this.client.relay.publish(connection.topic, response, {
        relay: connection.relay,
        encrypt: { sharedKey: connection.sharedKey, publicKey: connection.keyPair.publicKey },
      });
    } catch (e) {
      const response = formatJsonRpcError(request.id, e.message);
      this.client.relay.publish(connection.topic, response, {
        relay: connection.relay,
        encrypt: { sharedKey: connection.sharedKey, publicKey: connection.keyPair.publicKey },
      });
    }
  }

  protected async handleUpdate(
    connection: ConnectionTypes.Settled,
    params: ConnectionTypes.UpdateParams,
    fromPeer?: boolean,
  ): Promise<ConnectionTypes.Update> {
    let update: ConnectionTypes.Update;
    if (typeof params.state !== "undefined") {
      const state = params.state as ConnectionTypes.State;
      const publicKey = fromPeer ? connection.peer.publicKey : connection.keyPair.publicKey;
      for (const key of Object.keys(state)) {
        if (!connection.rules.state[key][publicKey]) {
          throw new Error(`Unauthorized state update for key: ${key}`);
        }
        connection.state[key] = state[key];
      }
      update = { state };
    } else if (typeof params.metadata !== "undefined") {
      const metadata = params.metadata as ConnectionTypes.Metadata;
      if (fromPeer) {
        connection.peer.metadata = metadata;
      }
      update = { metadata };
    } else {
      throw new Error(`Invalid ${this.context} update request params`);
    }
    await this.settled.update(connection.topic, connection);
    return update;
  }

  // ---------- Private ----------------------------------------------- //

  private registerEventListeners(): void {
    // Proposed Subscription Events
    this.proposed.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onResponse(payloadEvent),
    );
    this.proposed.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<ConnectionTypes.Proposed>) => {
        const proposed = createdEvent.data;
        this.events.emit(CONNECTION_EVENTS.proposed, proposed);
      },
    );
    // Responded Subscription Events
    this.responded.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onAcknowledge(payloadEvent),
    );
    this.responded.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<ConnectionTypes.Responded>) => {
        const responded = createdEvent.data;
        this.events.emit(CONNECTION_EVENTS.responded, responded);
        const params = isConnectionFailed(responded.outcome)
          ? { reason: responded.outcome.reason }
          : { publicKey: responded.peer.publicKey };
        const request = formatJsonRpcRequest(CONNECTION_JSONRPC.respond, params);
        this.client.relay.publish(responded.topic, request, { relay: responded.relay });
      },
    );
    // Settled Subscription Events
    this.settled.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onMessage(payloadEvent),
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<ConnectionTypes.Settled>) => {
        const connection = createdEvent.data;
        this.events.emit(CONNECTION_EVENTS.settled, connection);
        if (typeof connection.peer.metadata === "undefined") {
          const metadata = getConnectionMetadata();
          if (!metadata) return;
          this.update({ topic: connection.topic, metadata });
        }
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<ConnectionTypes.Settled>) => {
        const connection = updatedEvent.data;
        this.events.emit(CONNECTION_EVENTS.updated, connection);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.deleted,
      (deletedEvent: SubscriptionEvent.Deleted<ConnectionTypes.Settled>) => {
        const connection = deletedEvent.data;
        this.events.emit(CONNECTION_EVENTS.deleted, connection);
        const request = formatJsonRpcRequest(CONNECTION_JSONRPC.delete, {
          reason: deletedEvent.reason,
        });
        this.client.relay.publish(connection.topic, request, { relay: connection.relay });
      },
    );
  }
}
