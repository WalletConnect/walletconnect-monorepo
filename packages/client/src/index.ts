import { EventEmitter } from "events";
import pino, { Logger } from "pino";
import {
  IClient,
  ClientOptions,
  ClientTypes,
  ConnectionTypes,
  SessionTypes,
} from "@walletconnect/types";
import {
  getAppMetadata,
  isConnectionFailed,
  isSessionFailed,
  parseUri,
  getLoggerOptions,
  isConnectionResponded,
  isSessionResponded,
  generateStatelessProposalSetting,
} from "@walletconnect/utils";
import { JsonRpcPayload, JsonRpcRequest, isJsonRpcRequest } from "rpc-json-utils";

import { Store, Connection, Session, Relay } from "./controllers";
import {
  CLIENT_CONTEXT,
  CLIENT_EVENTS,
  CONNECTION_CONTEXT,
  CONNECTION_EVENTS,
  CONNECTION_SIGNAL_TYPE_URI,
  RELAY_DEFAULT_PROTOCOL,
  SESSION_CONTEXT,
  SESSION_EVENTS,
  SESSION_JSONRPC,
  SESSION_SIGNAL_TYPE_CONNECTION,
  SETTLED_CONNECTION_JSONRPC,
} from "./constants";

export function generateConnectionProposalFromUri(uri: string): ConnectionTypes.Proposal {
  const uriParams = parseUri(uri);
  const proposal: ConnectionTypes.Proposal = {
    topic: uriParams.topic,
    relay: uriParams.relay,
    proposer: { publicKey: uriParams.publicKey },
    signal: { type: CONNECTION_SIGNAL_TYPE_URI, params: { uri } },
    setting: generateStatelessProposalSetting({ methods: SETTLED_CONNECTION_JSONRPC }),
  };
  return proposal;
}

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
          : await this.connection.get(params.connection);
      this.logger.trace({ type: "method", method: "connect", connection });
      const session = await this.session.create({
        signal: { type: SESSION_SIGNAL_TYPE_CONNECTION, params: { topic: connection.topic } },
        relay: params.relay || { protocol: RELAY_DEFAULT_PROTOCOL },
        metadata: getAppMetadata(params.app),
        chains: params.chains,
        methods: params.methods,
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
    if (typeof params.proposal === "string") {
      this.logger.debug(`Responding Connection Proposal`);
      this.logger.trace({ type: "method", method: "respond", params });
      const pending = await this.connection.respond({
        approved: params.approved,
        proposal: generateConnectionProposalFromUri(params.proposal),
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
      metadata: getAppMetadata(params.response.app),
      state: {
        accounts: {
          data: params.response.accounts,
        },
      },
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

  public async disconnect(params: ClientTypes.DisconnectParams): Promise<void> {
    this.logger.debug(`Disconnecting Application`);
    this.logger.trace({ type: "method", method: "disconnect", params });
    await this.session.delete(params);
  }

  // ---------- Protected ----------------------------------------------- //

  protected async onPayload(payload: JsonRpcPayload, context: string): Promise<void> {
    const eventName =
      context === CONNECTION_CONTEXT ? CONNECTION_EVENTS.payload : SESSION_EVENTS.payload;
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      switch (request.method) {
        case SESSION_JSONRPC.propose:
          this.logger.info(`Emitting ${SESSION_EVENTS.proposed}`);
          this.logger.debug({
            type: "event",
            event: SESSION_EVENTS.proposed,
            data: request.params,
          });
          this.events.emit(SESSION_EVENTS.proposed, request.params);
          break;
        default:
          this.logger.info(`Emitting ${eventName}`);
          this.logger.debug({ type: "event", event: eventName, data: payload });
          this.events.emit(eventName, payload);
          break;
      }
    } else {
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: payload });
      this.events.emit(eventName, payload);
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
      this.logger.info(`Client initilization success`);
    } catch (e) {
      this.logger.info(`Client initilization failure`);
      this.logger.error(e);
      throw e;
    }
  }

  private registerEventListeners(): void {
    // Connection Subscription Events
    this.connection.on(CONNECTION_EVENTS.proposed, (proposed: ConnectionTypes.Pending) => {
      this.logger.info(`Emitting ${CONNECTION_EVENTS.proposed}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.proposed, data: proposed });
      this.events.emit(CONNECTION_EVENTS.proposed, proposed);
      if (proposed.proposal.signal.type === CONNECTION_SIGNAL_TYPE_URI) {
        const uri = proposed.proposal.signal.params.uri;
        this.logger.debug({ type: "event", event: CLIENT_EVENTS.share_uri, uri });
        this.events.emit(CLIENT_EVENTS.share_uri, { uri });
      }
    });
    this.connection.on(CONNECTION_EVENTS.responded, (responded: ConnectionTypes.Pending) => {
      this.logger.info(`Emitting ${CONNECTION_EVENTS.responded}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.responded, data: responded });
      this.events.emit(CONNECTION_EVENTS.responded, responded);
    });
    this.connection.on(CONNECTION_EVENTS.settled, (connection: ConnectionTypes.Settled) => {
      this.logger.info(`Emitting ${CONNECTION_EVENTS.settled}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.settled, data: connection });
      this.events.emit(CONNECTION_EVENTS.settled, connection);
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
    this.connection.on(CONNECTION_EVENTS.payload, (payload: JsonRpcPayload) => {
      this.logger.info(`Emitting ${CONNECTION_EVENTS.payload}`);
      this.logger.debug({ type: "event", event: CONNECTION_EVENTS.payload, data: payload });
      this.onPayload(payload, CONNECTION_CONTEXT);
    });
    // Session Subscription Events
    this.session.on(SESSION_EVENTS.proposed, (proposed: SessionTypes.Pending) => {
      this.logger.info(`Emitting ${SESSION_EVENTS.proposed}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.proposed, data: proposed });
      this.events.emit(SESSION_EVENTS.proposed, proposed);
    });
    this.session.on(SESSION_EVENTS.responded, (responded: SessionTypes.Pending) => {
      this.logger.info(`Emitting ${SESSION_EVENTS.responded}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.responded, data: responded });
      this.events.emit(SESSION_EVENTS.responded, responded);
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
    this.session.on(SESSION_EVENTS.payload, (payload: JsonRpcPayload) => {
      this.logger.info(`Emitting ${SESSION_EVENTS.payload}`);
      this.logger.debug({ type: "event", event: SESSION_EVENTS.payload, data: payload });
      this.onPayload(payload, SESSION_CONTEXT);
    });
  }
}

export default Client;
