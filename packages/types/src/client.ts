import { IJsonRpcProvider } from "rpc-json-types";

import { IRelay, RelayProtocolOptions } from "./relay";
import { IConnection } from "./connection";
import { ISession, SessionTypes } from "./session";
import { IStore } from "./store";
import { IEvents } from "./events";

export interface ClientOptions {
  store?: IStore;
  relayProvider?: string | IJsonRpcProvider;
}

export declare namespace ClientTypes {
  export interface ConnectParams {
    chains: string[];
    jsonrpc: string[];
    app?: string | SessionTypes.Metadata;
    relay?: RelayProtocolOptions;
  }

  export interface RespondParams {
    approved: boolean;
    proposal: string | SessionTypes.Proposal;
    response?: {
      state: SessionTypes.State;
      app?: string | SessionTypes.Metadata;
    };
  }

  export interface DisconnectParams {
    topic: string;
    reason: string;
  }
}

export abstract class IClient extends IEvents {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract store: IStore;
  public abstract relay: IRelay;

  public abstract connection: IConnection;
  public abstract session: ISession;

  constructor(opts?: ClientOptions) {
    super();
  }

  public abstract connect(params: ClientTypes.ConnectParams): Promise<SessionTypes.Settled>;
  public abstract respond(params: ClientTypes.RespondParams): Promise<string | undefined>;
  public abstract disconnect(params: ClientTypes.DisconnectParams): Promise<void>;
}
