import { EventEmitter } from "events";
import pino, { Logger } from "pino";
import Store from "@pedrouid/iso-store";
import {
  IClient,
  IStore,
  ClientOptions,
  ClientTypes,
  ConnectionTypes,
  SessionTypes,
} from "@walletconnect/types";
import {
  isConnectionFailed,
  isSessionFailed,
  parseUri,
  getLoggerOptions,
  isConnectionResponded,
  isSessionResponded,
  getConnectionMetadata,
} from "@walletconnect/utils";
import { JsonRpcPayload, isJsonRpcRequest, isJsonRpcError } from "@json-rpc-tools/utils";

import { Connection, Session, Relay } from "./controllers";
import {
  CLIENT_CONTEXT,
  CLIENT_EVENTS,
  CONNECTION_DEFAULT_SUBSCRIBE_TTL,
  CONNECTION_EVENTS,
  CONNECTION_SIGNAL_METHOD_URI,
  RELAY_DEFAULT_PROTOCOL,
  SESSION_EMPTY_PERMISSIONS,
  SESSION_EMPTY_RESPONSE,
  SESSION_EVENTS,
  SESSION_JSONRPC,
  SESSION_SIGNAL_METHOD_CONNECTION,
} from "./constants";

export class Client extends IClient {
  public readonly protocol = "wc";
  public readonly version = 2;

  public events = new EventEmitter();
  public logger: Logger;

  public store: IStore;
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
        permissions: {
          ...params.permissions,
          notifications: SESSION_EMPTY_PERMISSIONS.notifications,
        },
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
  public async tether(params: ClientTypes.TetherParams): Promise<void> {
    this.logger.debug(`Tethering Connection`);
    this.logger.trace({ type: "method", method: "tether", params });
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
      approved: true,
      proposal,
    });
    if (!isConnectionResponded(pending)) return;
    if (isConnectionFailed(pending.outcome)) {
      this.logger.debug(`Connection Tethering Failure`);
      this.logger.trace({ type: "method", method: "tether", outcome: pending.outcome });
      return;
    }
    this.logger.debug(`Connection Tethering Success`);
    this.logger.trace({ type: "method", method: "tether", pending });
  }

  public async approve(params: ClientTypes.ApproveParams): Promise<SessionTypes.Settled> {
    this.logger.debug(`Approving Session Proposal`);
    this.logger.trace({ type: "method", method: "approve", params });
    if (typeof params.response === "undefined") {
      const errorMessage = "Response is required for approved session proposals";
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    const pending = await this.session.respond({
      approved: true,
      proposal: params.proposal,
      response: params.response || SESSION_EMPTY_RESPONSE,
    });
    if (!isSessionResponded(pending)) {
      const errorMessage = "No Session Response found in pending proposal";
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    if (isSessionFailed(pending.outcome)) {
      this.logger.debug(`Session Proposal Approval Failure`);
      this.logger.trace({ type: "method", method: "approve", outcome: pending.outcome });
      throw new Error(pending.outcome.reason);
    }
    this.logger.debug(`Session Proposal Approval Success`);
    this.logger.trace({ type: "method", method: "approve", pending });
    return this.session.get(pending.outcome.topic);
  }

  public async reject(params: ClientTypes.RejectParams): Promise<void> {
    this.logger.debug(`Rejecting Session Proposal`);
    this.logger.trace({ type: "method", method: "reject", params });
    const pending = await this.session.respond({
      approved: false,
      proposal: params.proposal,
      response: SESSION_EMPTY_RESPONSE,
    });
    this.logger.debug(`Session Proposal Response Success`);
    this.logger.trace({ type: "method", method: "reject", pending });
  }

  public async update(params: ClientTypes.UpdateParams): Promise<void> {
    this.session.update(params);
  }

  public async notify(params: ClientTypes.NotifyParams): Promise<void> {
    this.session.notify(params);
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

  public async respond(params: ClientTypes.RespondParams): Promise<void> {
    this.session.send(params.topic, params.response);
  }

  public async disconnect(params: ClientTypes.DisconnectParams): Promise<void> {
    this.logger.debug(`Disconnecting Application`);
    this.logger.trace({ type: "method", method: "disconnect", params });
    await this.session.delete(params);
  }

  // ---------- Protected ----------------------------------------------- //

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
    this.connection.on(CONNECTION_EVENTS.payload, (payloadEvent: ConnectionTypes.PayloadEvent) => {
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
    this.session.on(SESSION_EVENTS.payload, (payloadEvent: SessionTypes.PayloadEvent) => {
      this.logger.info(`Emitting ${CLIENT_EVENTS.session.payload}`);
      this.logger.debug({
        type: "event",
        event: CLIENT_EVENTS.session.payload,
        data: payloadEvent,
      });
      this.events.emit(CLIENT_EVENTS.session.payload, payloadEvent);
    });
    this.session.on(
      SESSION_EVENTS.notification,
      (notificationEvent: SessionTypes.NotificationEvent) => {
        this.logger.info(`Emitting ${CLIENT_EVENTS.session.notification}`);
        this.logger.debug({
          type: "event",
          event: CLIENT_EVENTS.session.notification,
          data: notificationEvent,
        });
        this.events.emit(CLIENT_EVENTS.session.notification, notificationEvent);
      },
    );
  }
}
