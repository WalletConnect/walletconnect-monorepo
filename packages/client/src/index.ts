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
import { JsonRpcPayload, isJsonRpcRequest } from "rpc-json-utils";

import { Store, Connection, Session, Relay } from "./controllers";
import {
  CLIENT_CONTEXT,
  CLIENT_EVENTS,
  CONNECTION_EVENTS,
  CONNECTION_SIGNAL_METHOD_URI,
  RELAY_DEFAULT_PROTOCOL,
  SESSION_EVENTS,
  SESSION_JSONRPC,
  SESSION_SIGNAL_METHOD_CONNECTION,
  SETTLED_CONNECTION_JSONRPC,
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
      return this.onConnectionResponse(params);
    }
    return this.onSessionResponse(params);
  }

  public async disconnect(params: ClientTypes.DisconnectParams): Promise<void> {
    this.logger.debug(`Disconnecting Application`);
    this.logger.trace({ type: "method", method: "disconnect", params });
    await this.session.delete(params);
  }

  // ---------- Protected ----------------------------------------------- //

  protected async onConnectionResponse(
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
      permissions: { jsonrpc: { methods: SETTLED_CONNECTION_JSONRPC } },
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

  protected async onSessionResponse(
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
        this.logger.info(`Emitting ${SESSION_EVENTS.proposed}`);
        this.logger.debug({
          type: "event",
          event: SESSION_EVENTS.proposed,
          data: payload.params,
        });
        this.events.emit(SESSION_EVENTS.proposed, payload.params);
      }
    }
  }

  protected async onConnectionProposed(pending: ConnectionTypes.Pending) {
    if (pending.proposal.signal.method === CONNECTION_SIGNAL_METHOD_URI) {
      const uri = pending.proposal.signal.params.uri;
      this.logger.debug({ type: "event", event: CLIENT_EVENTS.share_uri, uri });
      this.events.emit(CLIENT_EVENTS.share_uri, { uri });
    }
  }

  protected async onConnectionSettled(connection: ConnectionTypes.Settled) {
    if (typeof connection.peer.metadata === "undefined") {
      const metadata = getConnectionMetadata();
      if (!metadata) return;
      const update = { peer: { metadata } };
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
      this.logger.info(`Emitting ${CONNECTION_EVENTS.proposed}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.proposed, data: pending });
      this.events.emit(CONNECTION_EVENTS.proposed, pending);
      this.onConnectionProposed(pending);
    });
    this.connection.on(CONNECTION_EVENTS.responded, (pending: ConnectionTypes.Pending) => {
      this.logger.info(`Emitting ${CONNECTION_EVENTS.responded}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.responded, data: pending });
      this.events.emit(CONNECTION_EVENTS.responded, pending);
    });
    this.connection.on(CONNECTION_EVENTS.settled, (connection: ConnectionTypes.Settled) => {
      this.logger.info(`Emitting ${CONNECTION_EVENTS.settled}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.settled, data: connection });
      this.events.emit(CONNECTION_EVENTS.settled, connection);
      this.onConnectionSettled(connection);
    });
    this.connection.on(CONNECTION_EVENTS.updated, (connection: ConnectionTypes.Settled) => {
      this.logger.info(`Emitting ${CONNECTION_EVENTS.updated}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.updated, data: connection });
      this.events.emit(CONNECTION_EVENTS.updated, connection);
    });
    this.connection.on(CONNECTION_EVENTS.deleted, (connection: ConnectionTypes.Settled) => {
      this.logger.info(`Emitting ${CONNECTION_EVENTS.deleted}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.deleted, data: connection });
      this.events.emit(CONNECTION_EVENTS.deleted, connection);
    });
    this.connection.on(CONNECTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) => {
      this.logger.info(`Emitting ${CONNECTION_EVENTS.payload}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.payload, data: payloadEvent });
      this.onConnectionPayload(payloadEvent.payload);
    });
    // Session Subscription Events
    this.session.on(SESSION_EVENTS.proposed, (pending: SessionTypes.Pending) => {
      this.logger.info(`Emitting ${SESSION_EVENTS.proposed}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.proposed, data: pending });
      this.events.emit(SESSION_EVENTS.proposed, pending);
    });
    this.session.on(SESSION_EVENTS.responded, (pending: SessionTypes.Pending) => {
      this.logger.info(`Emitting ${SESSION_EVENTS.responded}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.responded, data: pending });
      this.events.emit(SESSION_EVENTS.responded, pending);
    });
    this.session.on(SESSION_EVENTS.settled, (session: SessionTypes.Settled) => {
      this.logger.info(`Emitting ${SESSION_EVENTS.settled}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.settled, data: session });
      this.events.emit(SESSION_EVENTS.settled, session);
    });
    this.session.on(SESSION_EVENTS.updated, (session: SessionTypes.Settled) => {
      this.logger.info(`Emitting ${SESSION_EVENTS.updated}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.updated, data: session });
      this.events.emit(SESSION_EVENTS.updated, session);
    });
    this.session.on(SESSION_EVENTS.deleted, (session: SessionTypes.Settled) => {
      this.logger.info(`Emitting ${SESSION_EVENTS.deleted}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.deleted, data: session });
      this.events.emit(SESSION_EVENTS.deleted, session);
    });
    this.session.on(SESSION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) => {
      this.logger.info(`Emitting ${SESSION_EVENTS.payload}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.payload, data: payloadEvent });
      this.events.emit(SESSION_EVENTS.payload, payloadEvent);
    });
  }
}

export default Client;
