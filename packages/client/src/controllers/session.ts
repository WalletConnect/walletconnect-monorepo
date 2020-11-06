import { EventEmitter } from "events";
import { Logger } from "pino";
import { IClient, ISession, SessionTypes, SubscriptionEvent } from "@walletconnect/types";
import {
  deriveSharedKey,
  generateKeyPair,
  generateRandomBytes32,
  isSessionFailed,
  mapEntries,
  sha256,
  formatLoggerContext,
  isSessionResponded,
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
  SESSION_JSONRPC_AFTER_SETTLEMENT,
  SESSION_JSONRPC,
  SESSION_REASONS,
  SESSION_STATUS,
  SUBSCRIPTION_EVENTS,
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
      false,
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
    this.logger.trace({ type: "init" });
    await this.pending.init();
    await this.settled.init();
  }

  public async get(topic: string): Promise<SessionTypes.Settled> {
    return this.settled.get(topic);
  }

  get length(): number {
    return this.settled.length;
  }

  get entries(): Record<string, SessionTypes.Settled> {
    return mapEntries(this.settled.entries, x => x.data);
  }

  public async create(params: SessionTypes.CreateParams): Promise<SessionTypes.Settled> {
    this.logger.info("Create Session");
    this.logger.debug({ type: "method", method: "create", params });
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
    this.logger.info("Respond Session");
    this.logger.debug({ type: "method", method: "respond", params });
    const { approved, metadata, proposal } = params;
    const { relay, peer, ruleParams } = proposal;
    const keyPair = generateKeyPair();
    const connection = await this.client.connection.get(proposal.topic);
    if (approved) {
      try {
        const proposer = peer.publicKey;
        const responder = keyPair.publicKey;
        const session = await this.settle({
          relay,
          keyPair,
          peer: peer,
          state: params.state,
          rules: {
            state: {
              accounts: {
                [proposer]: ruleParams.state.accounts.proposer,
                [responder]: ruleParams.state.accounts.responder,
              },
            },
            jsonrpc: ruleParams.jsonrpc,
          },
        });
        const outcome: SessionTypes.Outcome = {
          topic: session.topic,
          relay: session.relay,
          state: session.state,
          peer: {
            publicKey: session.keyPair.publicKey,
            metadata,
          },
        };
        const pending: SessionTypes.Pending = {
          status: SESSION_STATUS.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          keyPair,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, {
          relay: pending.relay,
          decrypt: {
            sharedKey: connection.sharedKey,
            publicKey: connection.peer.publicKey,
          },
        });
        return pending;
      } catch (e) {
        const reason = e.payload;
        const outcome = { reason };
        const pending: SessionTypes.Pending = {
          status: SESSION_STATUS.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          keyPair,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, {
          relay: pending.relay,
          decrypt: {
            sharedKey: connection.sharedKey,
            publicKey: connection.peer.publicKey,
          },
        });
        return pending;
      }
    } else {
      const outcome = { reason: SESSION_REASONS.not_approved };
      const pending: SessionTypes.Pending = {
        status: SESSION_STATUS.responded,
        topic: proposal.topic,
        relay: proposal.relay,
        keyPair,
        proposal,
        outcome,
      };
      await this.pending.set(pending.topic, pending, {
        relay: pending.relay,
        decrypt: {
          sharedKey: connection.sharedKey,
          publicKey: connection.peer.publicKey,
        },
      });
      return pending;
    }
  }

  public async update(params: SessionTypes.UpdateParams): Promise<SessionTypes.Settled> {
    this.logger.info("Update Session");
    this.logger.debug({ type: "method", method: "update", params });
    const session = await this.settled.get(params.topic);
    const update = await this.handleUpdate(session, params);
    const request = formatJsonRpcRequest(SESSION_JSONRPC.update, update);
    this.client.relay.publish(session.topic, request, {
      relay: session.relay,
      encrypt: {
        sharedKey: session.sharedKey,
        publicKey: session.keyPair.publicKey,
      },
    });
    return session;
  }

  public async delete(params: SessionTypes.DeleteParams): Promise<void> {
    this.logger.info("Delete Session");
    this.logger.debug({ type: "method", method: "delete", params });
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
    this.logger.info("Propose Session");
    this.logger.debug({ type: "method", method: "propose", params });
    const connection = await this.client.connection.settled.get(params.connection.topic);
    const keyPair = generateKeyPair();
    const proposal: SessionTypes.Proposal = {
      topic: generateRandomBytes32(),
      relay: params.relay,
      peer: {
        publicKey: keyPair.publicKey,
        metadata: params.metadata,
      },
      stateParams: params.stateParams,
      ruleParams: params.ruleParams,
    };
    const pending: SessionTypes.Pending = {
      status: SESSION_STATUS.proposed,
      topic: proposal.topic,
      relay: proposal.relay,
      keyPair,
      proposal,
    };
    const request = formatJsonRpcRequest(SESSION_JSONRPC.propose, proposal);

    this.client.relay.publish(connection.topic, request, {
      relay: connection.relay,
      encrypt: {
        sharedKey: connection.sharedKey,
        publicKey: connection.keyPair.publicKey,
      },
    });
    this.pending.set(pending.topic, pending, {
      relay: pending.relay,
      decrypt: {
        sharedKey: connection.sharedKey,
        publicKey: connection.peer.publicKey,
      },
    });
    return pending;
  }

  protected async settle(params: SessionTypes.SettleParams): Promise<SessionTypes.Settled> {
    this.logger.info("Settle Session");
    this.logger.debug({ type: "method", method: "settle", params });
    const sharedKey = deriveSharedKey(params.keyPair.privateKey, params.peer.publicKey);
    const session: SessionTypes.Settled = {
      relay: params.relay,
      topic: await sha256(sharedKey),
      sharedKey,
      keyPair: params.keyPair,
      peer: params.peer,
      state: params.state,
      rules: {
        ...params.rules,
        jsonrpc: [...SESSION_JSONRPC_AFTER_SETTLEMENT, ...params.rules.jsonrpc],
      },
    };
    await this.settled.set(session.topic, session, {
      relay: session.relay,
      decrypt: {
        sharedKey: session.sharedKey,
        publicKey: session.peer.publicKey,
      },
    });
    return session;
  }

  protected async onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.info("Receiving Session response");
    this.logger.debug({ type: "method", method: "onResponse", topic, payload });
    const request = payload as JsonRpcRequest<SessionTypes.Outcome>;
    const pending = await this.pending.get(topic);
    const connection = await this.client.connection.settled.get(pending.topic);
    if (!isSessionFailed(request.params)) {
      try {
        const outcome = request.params;
        const proposer = pending.keyPair.publicKey;
        const responder = outcome.peer.publicKey;
        const session = await this.settle({
          relay: pending.relay,
          keyPair: pending.keyPair,
          peer: outcome.peer,
          state: outcome.state,
          rules: {
            state: {
              accounts: {
                [proposer]: pending.proposal.ruleParams.state.accounts.proposer,
                [responder]: pending.proposal.ruleParams.state.accounts.responder,
              },
            },
            jsonrpc: pending.proposal.ruleParams.jsonrpc,
          },
        });
        const response = formatJsonRpcResult(request.id, true);
        this.client.relay.publish(topic, response, {
          relay: pending.relay,
          encrypt: {
            sharedKey: connection.sharedKey,
            publicKey: connection.keyPair.publicKey,
          },
        });

        await this.pending.update(topic, {
          outcome: {
            topic: session.topic,
            relay: session.relay,
            state: session.state,
            peer: session.peer,
          },
        });
      } catch (e) {
        const reason = e.payload;
        const response = formatJsonRpcError(request.id, reason);
        this.client.relay.publish(topic, response, {
          relay: pending.relay,
          encrypt: {
            sharedKey: connection.sharedKey,
            publicKey: connection.keyPair.publicKey,
          },
        });
        await this.pending.update(topic, { outcome: { reason } });
      }
    } else {
      const reason = request.params.reason;
      const response = formatJsonRpcError(request.id, reason);
      this.client.relay.publish(topic, response, {
        relay: pending.relay,
        encrypt: {
          sharedKey: connection.sharedKey,
          publicKey: connection.keyPair.publicKey,
        },
      });
      await this.pending.update(topic, { outcome: { reason } });
    }
    await this.pending.delete(topic, SESSION_REASONS.responded);
  }

  protected async onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.info("Receiving Session acknowledge");
    this.logger.debug({ type: "method", method: "onAcknowledge", topic, payload });
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
    this.logger.info("Receiving Session message");
    this.logger.debug({ type: "method", method: "onMessage", topic, payload });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const session = await this.settled.get(payloadEvent.topic);
      if (!session.rules.jsonrpc.includes(request.method)) {
        const response = formatJsonRpcError(
          request.id,
          `Unauthorized JSON-RPC Method Requested: ${request.method}`,
        );
        this.client.relay.publish(session.topic, response, {
          relay: session.relay,
          encrypt: {
            sharedKey: session.sharedKey,
            publicKey: session.keyPair.publicKey,
          },
        });
      }
      switch (request.method) {
        case SESSION_JSONRPC.update:
          await this.onUpdate(payloadEvent);
          break;
        case SESSION_JSONRPC.delete:
          await this.settled.delete(session.topic, request.params.reason);
          break;
        default:
          this.events.emit(SESSION_EVENTS.payload, payloadEvent.payload);
          break;
      }
    } else {
      this.events.emit(SESSION_EVENTS.payload, payloadEvent.payload);
    }
  }

  protected async onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.info("Receiving Session update");
    this.logger.debug({ type: "method", method: "onUpdate", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const session = await this.settled.get(payloadEvent.topic);
    try {
      await this.handleUpdate(session, request.params, true);
      const response = formatJsonRpcResult(request.id, true);
      this.client.relay.publish(session.topic, response, {
        relay: session.relay,
        encrypt: { sharedKey: session.sharedKey, publicKey: session.keyPair.publicKey },
      });
    } catch (e) {
      const response = formatJsonRpcError(request.id, e.message);
      this.client.relay.publish(session.topic, response, {
        relay: session.relay,
        encrypt: { sharedKey: session.sharedKey, publicKey: session.keyPair.publicKey },
      });
    }
  }

  protected async handleUpdate(
    session: SessionTypes.Settled,
    params: SessionTypes.UpdateParams,
    fromPeer?: boolean,
  ): Promise<SessionTypes.Update> {
    let update: SessionTypes.Update;
    if (typeof params.state !== "undefined") {
      const state = params.state as SessionTypes.State;
      const publicKey = fromPeer ? session.peer.publicKey : session.keyPair.publicKey;
      for (const key of Object.keys(state)) {
        if (!session.rules.state[key][publicKey]) {
          const errorMessage = `Unauthorized state update for key: ${key}`;
          this.logger.error(errorMessage);
          throw new Error(errorMessage);
        }
        session.state[key] = state[key];
      }
      update = { state };
    } else if (typeof params.metadata !== "undefined") {
      const metadata = params.metadata as SessionTypes.Metadata;
      if (fromPeer) {
        session.peer.metadata = metadata;
      }
      update = { metadata };
    } else {
      const errorMessage = `Invalid ${this.context} update request params`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    await this.settled.update(session.topic, session);
    return update;
  }

  // ---------- Private ----------------------------------------------- //

  private onPendingPayloadEvent(event: SubscriptionEvent.Payload) {
    if (isJsonRpcRequest(event.payload) && event.payload.method === SESSION_JSONRPC.respond) {
      this.onResponse(event);
    } else {
      this.onAcknowledge(event);
    }
  }
  private onPendingStatusEvent(
    event:
      | SubscriptionEvent.Created<SessionTypes.Pending>
      | SubscriptionEvent.Updated<SessionTypes.Pending>,
  ) {
    if (isSessionResponded(event.data)) {
      const pending = event.data;
      this.events.emit(SESSION_EVENTS.responded, pending);
      const request = formatJsonRpcRequest(SESSION_JSONRPC.respond, pending.outcome);
      this.client.relay.publish(pending.topic, request, { relay: pending.relay });
    } else {
      const pending = event.data;
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
        this.events.emit(SESSION_EVENTS.settled, session);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<SessionTypes.Settled>) => {
        const connection = updatedEvent.data;
        this.events.emit(SESSION_EVENTS.updated, connection);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.deleted,
      (deletedEvent: SubscriptionEvent.Deleted<SessionTypes.Settled>) => {
        const session = deletedEvent.data;
        this.events.emit(SESSION_EVENTS.deleted, session);
        const request = formatJsonRpcRequest(SESSION_JSONRPC.delete, {
          reason: deletedEvent.reason,
        });
        this.client.relay.publish(session.topic, request, { relay: session.relay });
      },
    );
  }
}
