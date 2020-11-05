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
  isConnectionResponded,
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
    this.logger.trace({ type: "init" });
    await this.pending.init();
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
    const { approved, proposal } = params;
    const keyPair = generateKeyPair();
    if (approved) {
      try {
        const connection = await this.settle({
          relay: proposal.relay,
          keyPair,
          peer: {
            publicKey: proposal.peer.publicKey,
          },
        });

        const pending: ConnectionTypes.Pending = {
          status: CONNECTION_STATUS.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          keyPair,
          proposal,
          outcome: connection,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      } catch (e) {
        const reason = e.message;
        const pending: ConnectionTypes.Pending = {
          status: CONNECTION_STATUS.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          keyPair,
          proposal,
          outcome: { reason },
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      }
    } else {
      const pending: ConnectionTypes.Pending = {
        status: CONNECTION_STATUS.responded,
        topic: proposal.topic,
        relay: proposal.relay,
        keyPair,
        proposal,
        outcome: { reason: CONNECTION_REASONS.not_approved },
      };
      await this.pending.set(pending.topic, pending, { relay: pending.relay });
      return pending;
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
  ): Promise<ConnectionTypes.Pending> {
    const relay = params?.relay || { protocol: RELAY_DEFAULT_PROTOCOL };
    const topic = generateRandomBytes32();
    const keyPair = generateKeyPair();
    const proposal: ConnectionTypes.Proposal = {
      relay,
      topic,
      peer: { publicKey: keyPair.publicKey },
    };
    const pending: ConnectionTypes.Pending = {
      status: CONNECTION_STATUS.proposed,
      topic: proposal.topic,
      relay: proposal.relay,
      keyPair,
      proposal,
    };
    await this.pending.set(pending.topic, pending, { relay });

    return pending;
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
    const pending = await this.pending.get(topic);
    if (!isConnectionFailed(outcome)) {
      try {
        const connection = await this.settle({
          relay: pending.relay,
          keyPair: pending.keyPair,
          peer: {
            publicKey: request.params.publicKey,
          },
        });
        const response = formatJsonRpcResult(request.id, true);
        this.client.relay.publish(topic, response, { relay: pending.relay });

        await this.pending.update(topic, { outcome: connection });
      } catch (e) {
        const reason = e.message;
        const response = formatJsonRpcError(request.id, reason);
        this.client.relay.publish(topic, response, { relay: pending.relay });
        await this.pending.update(topic, { outcome: { reason } });
      }
    } else {
      const reason = outcome.reason;
      const response = formatJsonRpcError(request.id, reason);
      this.client.relay.publish(topic, response, { relay: pending.relay });
      await this.pending.update(topic, { outcome: { reason } });
    }
    await this.pending.delete(topic, CONNECTION_REASONS.responded);
  }

  protected async onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    const response = payload as JsonRpcResponse;
    const pending = await this.pending.get(topic);
    if (!isConnectionResponded(pending)) return;
    if (isJsonRpcError(response) && !isConnectionFailed(pending.outcome)) {
      await this.settled.delete(pending.outcome.topic, response.error.message);
    }
    await this.pending.delete(topic, CONNECTION_REASONS.acknowledged);
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
          const errorMessage = `Unauthorized state update for key: ${key}`;
          this.logger.error(`Unauthorized state update for key: ${key}`);
          throw new Error(errorMessage);
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
      const errorMessage = `Invalid ${this.context} update request params`;
      this.logger.error(`Invalid ${this.context} update request params`);
      throw new Error(errorMessage);
    }
    await this.settled.update(connection.topic, connection);
    return update;
  }

  // ---------- Private ----------------------------------------------- //

  private registerEventListeners(): void {
    // Pending Subscription Events
    this.pending.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) => {
      if (
        isJsonRpcRequest(payloadEvent.payload) &&
        payloadEvent.payload.method === CONNECTION_JSONRPC.respond
      ) {
        this.onResponse(payloadEvent);
      } else {
        this.onAcknowledge(payloadEvent);
      }
    });
    this.pending.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<ConnectionTypes.Pending>) => {
        const pending = createdEvent.data;
        this.events.emit(CONNECTION_EVENTS.proposed, pending);
      },
    );

    this.pending.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<ConnectionTypes.Pending>) => {
        if (isConnectionResponded(updatedEvent.data)) {
          const pending = updatedEvent.data;
          this.events.emit(CONNECTION_EVENTS.responded, pending);
          const request = formatJsonRpcRequest(CONNECTION_JSONRPC.respond, pending.outcome);
          this.client.relay.publish(pending.topic, request, { relay: pending.relay });
        }
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
