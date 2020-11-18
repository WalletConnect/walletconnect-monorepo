import { EventEmitter } from "events";
import pino, { Logger } from "pino";
import {
  IClient,
  ClientOptions,
  ClientTypes,
  ConnectionTypes,
  SessionTypes,
  SubscriptionEvent,
} from "@walletconnect/types";
import {
  isConnectionFailed,
  isSessionFailed,
  parseUri,
  getLoggerOptions,
  isConnectionResponded,
  isSessionResponded,
  getConnectionMetadata,
  isConnectionRespondParams,
} from "@walletconnect/utils";
import { JsonRpcPayload, isJsonRpcRequest, isJsonRpcError } from "rpc-json-utils";

import { Store, Connection, Session, Relay } from "./controllers";
import {
  CLIENT_CONTEXT,
  CLIENT_EVENTS,
  CONNECTION_DEFAULT_SUBSCRIBE_TTL,
  CONNECTION_EVENTS,
  CONNECTION_SIGNAL_METHOD_URI,
  RELAY_DEFAULT_PROTOCOL,
  SESSION_EVENTS,
  SESSION_JSONRPC,
  SESSION_SIGNAL_METHOD_CONNECTION,
} from "./constants";

export class Client extends IClient {
  public readonly protocol = "wc";
  public readonly version = 2;

  public events = new EventEmitter();
  public logger: Logger;

  public store: Store;
  public relay: Relay;

  public connection: Connection;
  public session: Session;

  public context: string = CLIENT_CONTEXT;

  static async init(opts?: ClientOptions): Promise<Client> {
    const client = new Client(opts);
    await client.initialize();
    return client;
  }

  constructor(opts?: ClientOptions) {
    super(opts);
    const logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? opts.logger
        : pino(getLoggerOptions(opts?.logger));
    this.context = opts?.overrideContext || this.context;
    this.logger = logger.child({
      context: this.context,
    });

    this.relay = new Relay(this.logger, opts?.relayProvider);
    this.store = opts?.store || new Store();

    this.connection = new Connection(this, this.logger);
    this.session = new Session(this, this.logger);
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

  public async connect(params: ClientTypes.ConnectParams): Promise<SessionTypes.Settled> {
    this.logger.debug(`Connecting Application`);
    this.logger.trace({ type: "method", method: "connect", params });
    try {
      const connection =
        typeof params.connection === "undefined"
          ? await this.connection.create()
          : await this.connection.get(params.connection.topic);
      this.logger.trace({ type: "method", method: "connect", connection });
      const session = await this.session.create({
        signal: { method: SESSION_SIGNAL_METHOD_CONNECTION, params: { topic: connection.topic } },
        relay: params.relay || { protocol: RELAY_DEFAULT_PROTOCOL },
        metadata: params.metadata,
        permissions: params.permissions,
      });
      this.logger.debug(`Application Connection Successful`);
      this.logger.trace({ type: "method", method: "connect", session });
      return session;
    } catch (e) {
      this.logger.debug(`Application Connection Failure`);
      this.logger.error(e);
      throw e;
    }
  }

  public async respond(params: ClientTypes.RespondParams): Promise<string | undefined> {
    if (isConnectionRespondParams(params)) {
      return this.respondConnection(params);
    }
    return this.respondSession(params);
  }

  public async update(params: ClientTypes.UpdateParams): Promise<SessionTypes.Settled> {
    return this.session.update(params);
  }

  public async request(params: ClientTypes.RequestParams): Promise<any> {
    return new Promise((resolve, reject) => {
      this.on(CLIENT_EVENTS.session.payload, (payloadEvent: SessionTypes.PayloadEvent) => {
        if (params.topic !== payloadEvent.topic) return;
        if (isJsonRpcRequest(payloadEvent.payload)) return;
        const response = payloadEvent.payload;
        if (response.id !== params.request.id) return;
        if (isJsonRpcError(response)) {
          return reject(new Error(response.error.message));
        }
        return resolve(response.result);
      });
      this.session.send(params.topic, params.request, params.chainId);
    });
  }

  public async resolve(params: ClientTypes.ResolveParams): Promise<void> {
    this.session.send(params.topic, params.response);
  }

  public async disconnect(params: ClientTypes.DisconnectParams): Promise<void> {
    this.logger.debug(`Disconnecting Application`);
    this.logger.trace({ type: "method", method: "disconnect", params });
    await this.session.delete(params);
  }

  // ---------- Protected ----------------------------------------------- //

  protected async respondConnection(
    params: ClientTypes.ConnectionRespondParams,
  ): Promise<string | undefined> {
    this.logger.debug(`Responding Connection Proposal`);
    this.logger.trace({ type: "method", method: "respond", params });
    const uriParams = parseUri(params.uri);
    const proposal: ConnectionTypes.Proposal = {
      topic: uriParams.topic,
      relay: uriParams.relay,
      proposer: { publicKey: uriParams.publicKey },
      signal: { method: CONNECTION_SIGNAL_METHOD_URI, params: { uri: params.uri } },
      permissions: { jsonrpc: { methods: [SESSION_JSONRPC.propose] } },
      ttl: CONNECTION_DEFAULT_SUBSCRIBE_TTL,
    };
    const pending = await this.connection.respond({
      approved: params.approved,
      proposal,
    });
    if (!isConnectionResponded(pending)) return;
    if (isConnectionFailed(pending.outcome)) {
      this.logger.debug(`Connection Proposal Response Failure`);
      this.logger.trace({ type: "method", method: "respond", outcome: pending.outcome });
      return;
    }
    this.logger.debug(`Connection Proposal Response Success`);
    this.logger.trace({ type: "method", method: "respond", pending });
    return pending.outcome.topic;
  }

  protected async respondSession(
    params: ClientTypes.SessionRespondParams,
  ): Promise<string | undefined> {
    this.logger.debug(`Responding Session Proposal`);
    this.logger.trace({ type: "method", method: "respond", params });
    if (typeof params.response === "undefined") {
      const errorMessage = "Response is required for session proposals";
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    const pending = await this.session.respond({
      approved: params.approved,
      proposal: params.proposal,
      response: params.response,
    });
    if (!isSessionResponded(pending)) return;
    if (isSessionFailed(pending.outcome)) {
      this.logger.debug(`Session Proposal Response Failure`);
      this.logger.trace({ type: "method", method: "respond", outcome: pending.outcome });
      return;
    }
    this.logger.debug(`Session Proposal Response Success`);
    this.logger.trace({ type: "method", method: "respond", pending });
    return pending.outcome.topic;
  }

  protected async onConnectionPayload(payload: JsonRpcPayload): Promise<void> {
    if (isJsonRpcRequest(payload)) {
      if (payload.method === SESSION_JSONRPC.propose) {
        this.logger.info(`Emitting ${CLIENT_EVENTS.session.proposal}`);
        this.logger.debug({
          type: "event",
          event: CLIENT_EVENTS.session.proposal,
          data: payload.params,
        });
        this.events.emit(CLIENT_EVENTS.session.proposal, payload.params);
      }
    }
  }

  protected async onConnectionSettled(connection: ConnectionTypes.Settled) {
    if (typeof connection.peer.metadata === "undefined") {
      const metadata = getConnectionMetadata();
      if (!metadata) return;
      const update: ConnectionTypes.Update = { peer: { metadata } };
      this.connection.update({ topic: connection.topic, update });
    }
  }
  // ---------- Private ----------------------------------------------- //

  private async initialize(): Promise<any> {
    this.logger.trace(`Initialized`);
    try {
      await this.relay.init();
      await this.store.init();
      await this.connection.init();
      await this.session.init();
      this.registerEventListeners();
      this.logger.info(`Client Initilization Success`);
    } catch (e) {
      this.logger.info(`Client Initilization Failure`);
      this.logger.error(e);
      throw e;
    }
  }

  private registerEventListeners(): void {
    // Connection Subscription Events
    this.connection.on(CONNECTION_EVENTS.proposed, (pending: ConnectionTypes.Pending) => {
      this.logger.info(`Emitting ${CLIENT_EVENTS.connection.proposal}`);
      this.logger.debug({
        type: "event",
        event: CLIENT_EVENTS.connection.proposal,
        data: pending.proposal,
      });
      this.events.emit(CLIENT_EVENTS.connection.proposal, pending.proposal);
    });

    this.connection.on(CONNECTION_EVENTS.settled, (connection: ConnectionTypes.Settled) => {
      this.logger.info(`Emitting ${CLIENT_EVENTS.connection.created}`);
      this.logger.debug({
        type: "event",
        event: CLIENT_EVENTS.connection.created,
        data: connection,
      });
      this.events.emit(CLIENT_EVENTS.connection.created, connection);
      this.onConnectionSettled(connection);
    });
    this.connection.on(CONNECTION_EVENTS.updated, (connection: ConnectionTypes.Settled) => {
      this.logger.info(`Emitting ${CLIENT_EVENTS.connection.updated}`);
      this.logger.debug({
        type: "event",
        event: CLIENT_EVENTS.connection.updated,
        data: connection,
      });
      this.events.emit(CLIENT_EVENTS.connection.updated, connection);
    });
    this.connection.on(CONNECTION_EVENTS.deleted, (connection: ConnectionTypes.Settled) => {
      this.logger.info(`Emitting ${CLIENT_EVENTS.connection.deleted}`);
      this.logger.debug({
        type: "event",
        event: CLIENT_EVENTS.connection.deleted,
        data: connection,
      });
      this.events.emit(CLIENT_EVENTS.connection.deleted, connection);
    });
    this.connection.on(CONNECTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) => {
      this.onConnectionPayload(payloadEvent.payload);
    });
    // Session Subscription Events
    this.session.on(SESSION_EVENTS.proposed, (pending: SessionTypes.Pending) => {
      this.logger.info(`Emitting ${CLIENT_EVENTS.session.proposal}`);
      this.logger.debug({
        type: "event",
        event: CLIENT_EVENTS.session.proposal,
        data: pending.proposal,
      });
      this.events.emit(CLIENT_EVENTS.session.proposal, pending.proposal);
    });
    this.session.on(SESSION_EVENTS.settled, (session: SessionTypes.Settled) => {
      this.logger.info(`Emitting ${CLIENT_EVENTS.session.created}`);
      this.logger.debug({ type: "event", event: CLIENT_EVENTS.session.created, data: session });
      this.events.emit(CLIENT_EVENTS.session.created, session);
    });
    this.session.on(SESSION_EVENTS.updated, (session: SessionTypes.Settled) => {
      this.logger.info(`Emitting ${CLIENT_EVENTS.session.updated}`);
      this.logger.debug({ type: "event", event: CLIENT_EVENTS.session.updated, data: session });
      this.events.emit(CLIENT_EVENTS.session.updated, session);
    });
    this.session.on(SESSION_EVENTS.deleted, (session: SessionTypes.Settled) => {
      this.logger.info(`Emitting ${CLIENT_EVENTS.session.deleted}`);
      this.logger.debug({ type: "event", event: CLIENT_EVENTS.session.deleted, data: session });
      this.events.emit(CLIENT_EVENTS.session.deleted, session);
    });
    this.session.on(SESSION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) => {
      this.logger.info(`Emitting ${CLIENT_EVENTS.session.payload}`);
      this.logger.debug({
        type: "event",
        event: CLIENT_EVENTS.session.payload,
        data: payloadEvent,
      });
      this.events.emit(CLIENT_EVENTS.session.payload, payloadEvent);
    });
  }
}
