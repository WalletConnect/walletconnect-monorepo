import { EventEmitter } from "events";
import {
  IClient,
  ClientOptions,
  ClientTypes,
  ConnectionTypes,
  SessionTypes,
} from "@walletconnect/types";
import {
  formatUri,
  getAppMetadata,
  isConnectionFailed,
  isSessionFailed,
  parseUri,
} from "@walletconnect/utils";
import { JsonRpcPayload, JsonRpcRequest, isJsonRpcRequest } from "rpc-json-utils";

import { Store, Connection, Session, Relay } from "./controllers";

import {
  CLIENT_EVENTS,
  CONNECTION_CONTEXT,
  CONNECTION_EVENTS,
  RELAY_DEFAULT_PROTOCOL,
  SESSION_CONTEXT,
  SESSION_EVENTS,
  SESSION_JSONRPC,
} from "./constants";

export class Client extends IClient {
  public readonly protocol = "wc";
  public readonly version = 2;

  public events = new EventEmitter();

  public store: Store;
  public relay: Relay;

  public connection: Connection;
  public session: Session;

  static async init(opts?: ClientOptions): Promise<Client> {
    const client = new Client(opts);
    await client.initialize();
    return client;
  }

  constructor(opts?: ClientOptions) {
    super(opts);

    this.relay = new Relay(opts?.relayProvider);
    this.store = opts?.store || new Store();

    this.connection = new Connection(this);
    this.session = new Session(this);
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

  public async connect(params: ClientTypes.ConnectParams): Promise<SessionTypes.State> {
    let connection: ConnectionTypes.Settled;
    if (!this.connection.length) {
      this.connection.on(CONNECTION_EVENTS.proposed, (proposed: ConnectionTypes.Proposed) => {
        const uri = formatUri(this.protocol, this.version, proposed.topic, {
          relay: proposed.topic,
          publicKey: proposed.keyPair.publicKey,
        });
        this.events.emit(CLIENT_EVENTS.share_uri, { uri });
      });
      connection = await this.connection.create();
    } else {
      // TODO: display connections to be selected
      // this.events.emit(CLIENT_EVENTS.show_connections, { connections: this.connections.entries })
      //
      // (temporarily let's just select the first one)
      //
      connection = Object.values(this.connection.entries)[0];
    }
    const session = await this.session.create({
      connection: { topic: connection.topic },
      relay: params.relay || { protocol: RELAY_DEFAULT_PROTOCOL },
      metadata: getAppMetadata(params.app),
      stateParams: {
        chains: params.chains,
      },
      ruleParams: {
        state: {
          accounts: {
            proposer: false,
            responder: true,
          },
        },
        jsonrpc: params.jsonrpc,
      },
    });
    return session.state;
  }

  public async respond(params: ClientTypes.RespondParams): Promise<string | undefined> {
    // if proposal is typeof string assume connection proposal uri
    if (typeof params.proposal === "string") {
      const responded = await this.connection.respond({
        approved: params.approved,
        proposal: parseUri(params.proposal),
      });
      if (isConnectionFailed(responded.outcome)) {
        return;
      }
      return responded.outcome.topic;
    }
    // else assume session proposal is provided

    if (typeof params.response === "undefined") {
      throw new Error("Response is required for session proposals");
    }
    const responded = await this.session.respond({
      approved: params.approved,
      proposal: params.proposal,
      metadata: getAppMetadata(params.response.app),
      state: params.response.state,
    });
    if (isSessionFailed(responded.outcome)) {
      return;
    }
    return responded.outcome.topic;
  }

  public async disconnect(params: ClientTypes.DisconnectParams): Promise<void> {
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
          this.events.emit(SESSION_EVENTS.proposed, request.params);
          break;
        default:
          this.events.emit(eventName, payload);
          break;
      }
    } else {
      this.events.emit(eventName, payload);
    }
  }

  // ---------- Private ----------------------------------------------- //

  private async initialize(): Promise<any> {
    await this.relay.init();
    await this.store.init();
    await this.connection.init();
    await this.session.init();
    this.registerEventListeners();
  }

  private registerEventListeners(): void {
    // Connection Subscription Events
    this.connection.on(CONNECTION_EVENTS.proposed, (proposed: ConnectionTypes.Proposed) =>
      this.events.emit(CONNECTION_EVENTS.proposed, proposed),
    );
    this.connection.on(CONNECTION_EVENTS.responded, (responded: ConnectionTypes.Responded) =>
      this.events.emit(CONNECTION_EVENTS.responded, responded),
    );
    this.connection.on(CONNECTION_EVENTS.settled, (connection: ConnectionTypes.Settled) =>
      this.events.emit(CONNECTION_EVENTS.settled, connection),
    );
    this.connection.on(CONNECTION_EVENTS.updated, (connection: ConnectionTypes.Settled) =>
      this.events.emit(CONNECTION_EVENTS.updated, connection),
    );
    this.connection.on(CONNECTION_EVENTS.deleted, (connection: ConnectionTypes.Settled) =>
      this.events.emit(CONNECTION_EVENTS.deleted, connection),
    );
    this.connection.on(CONNECTION_EVENTS.payload, (payload: JsonRpcPayload) =>
      this.onPayload(payload, CONNECTION_CONTEXT),
    );
    // Session Subscription Events
    this.session.on(SESSION_EVENTS.proposed, (proposed: SessionTypes.Proposed) =>
      this.events.emit(SESSION_EVENTS.proposed, proposed),
    );
    this.session.on(SESSION_EVENTS.responded, (responded: SessionTypes.Responded) =>
      this.events.emit(SESSION_EVENTS.responded, responded),
    );
    this.session.on(SESSION_EVENTS.settled, (session: SessionTypes.Settled) =>
      this.events.emit(SESSION_EVENTS.settled, session),
    );
    this.session.on(SESSION_EVENTS.updated, (session: SessionTypes.Settled) =>
      this.events.emit(SESSION_EVENTS.updated, session),
    );
    this.session.on(SESSION_EVENTS.deleted, (session: SessionTypes.Settled) =>
      this.events.emit(SESSION_EVENTS.deleted, session),
    );
    this.session.on(SESSION_EVENTS.payload, (payload: JsonRpcPayload) =>
      this.onPayload(payload, SESSION_CONTEXT),
    );
  }
}

export default Client;
