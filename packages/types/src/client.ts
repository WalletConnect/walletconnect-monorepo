import { Logger } from "pino";
import { IJsonRpcProvider, JsonRpcRequest, JsonRpcResponse, IEvents } from "rpc-json-types";

import { IRelay, RelayTypes } from "./relay";
import { IConnection } from "./connection";
import { ISession, SessionTypes } from "./session";
import { IStore } from "./store";
import { SignalTypes } from "./misc";

export interface ClientOptions {
  logger?: string | Logger;
  store?: IStore;
  relayProvider?: string | IJsonRpcProvider;
  overrideContext?: string;
}

export declare namespace ClientTypes {
  export interface ConnectParams {
    metadata: SessionTypes.Metadata;
    permissions: SessionTypes.Permissions;
    relay?: RelayTypes.ProtocolOptions;
    connection?: SignalTypes.ParamsConnection;
  }

  export interface ConnectionRespondParams {
    approved: boolean;
    uri: string;
  }

  export interface SessionRespondParams {
    approved: boolean;
    proposal: SessionTypes.Proposal;
    response: SessionTypes.Response;
  }

  export type RespondParams = ConnectionRespondParams | SessionRespondParams;

  export type UpdateParams = SessionTypes.UpdateParams;

  export interface RequestParams {
    topic: string;
    request: JsonRpcRequest;
    chainId?: string;
  }

  export interface ResolveParams {
    topic: string;
    response: JsonRpcResponse;
  }

  export interface DisconnectParams {
    topic: string;
    reason: string;
  }
}

export abstract class IClient extends IEvents {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract logger: Logger;

  public abstract store: IStore;
  public abstract relay: IRelay;

  public abstract connection: IConnection;
  public abstract session: ISession;

  constructor(opts?: ClientOptions) {
    super();
  }

  public abstract connect(params: ClientTypes.ConnectParams): Promise<SessionTypes.Settled>;
  public abstract respond(params: ClientTypes.RespondParams): Promise<string | undefined>;
  public abstract update(params: ClientTypes.UpdateParams): Promise<SessionTypes.Settled>;
  public abstract request(params: ClientTypes.RequestParams): Promise<any>;
  public abstract resolve(params: ClientTypes.ResolveParams): Promise<void>;
  public abstract disconnect(params: ClientTypes.DisconnectParams): Promise<void>;
}
