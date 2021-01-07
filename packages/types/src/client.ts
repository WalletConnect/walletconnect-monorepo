import { Logger } from "pino";
import { IKeyValueStorage } from "keyvaluestorage";
import {
  IJsonRpcProvider,
  JsonRpcRequest,
  JsonRpcResponse,
  IEvents,
  RequestArguments,
} from "@json-rpc-tools/types";

import { IRelayer, RelayTypes } from "./relay";
import { IPairing } from "./pairing";
import { ISession, SessionTypes } from "./session";
import { SignalTypes } from "./misc";

export interface ClientOptions {
  logger?: string | Logger;
  storage?: IKeyValueStorage;
  relayProvider?: string | IJsonRpcProvider;
  overrideContext?: string;
}

export abstract class IClient extends IEvents {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract logger: Logger;

  public abstract relayer: IRelayer;
  public abstract storage: IKeyValueStorage;

  public abstract pairing: IPairing;
  public abstract session: ISession;

  public abstract context: string;

  constructor(opts?: ClientOptions) {
    super();
  }

  // for proposer to propose a session to a responder
  public abstract connect(params: ClientTypes.ConnectParams): Promise<SessionTypes.Settled>;
  // for responder to receive a session proposal from a proposer
  public abstract pair(params: ClientTypes.PairParams): Promise<void>;

  // for responder to approve a session proposal
  public abstract approve(params: ClientTypes.ApproveParams): Promise<SessionTypes.Settled>;
  // for responder to reject a session proposal
  public abstract reject(params: ClientTypes.RejectParams): Promise<void>;

  // for responder to update session state
  public abstract update(params: ClientTypes.UpdateParams): Promise<void>;
  // for either to send notifications
  public abstract notify(params: ClientTypes.NotifyParams): Promise<void>;

  // for proposer to request JSON-RPC
  public abstract request(params: ClientTypes.RequestParams): Promise<any>;
  // for responder to respond JSON-RPC
  public abstract respond(params: ClientTypes.RespondParams): Promise<void>;

  // for either to disconnect a session
  public abstract disconnect(params: ClientTypes.DisconnectParams): Promise<void>;
}

export declare namespace ClientTypes {
  export interface ConnectParams {
    metadata: SessionTypes.Metadata;
    permissions: SessionTypes.BasePermissions;
    relay?: RelayTypes.ProtocolOptions;
    pairing?: SignalTypes.ParamsPairing;
  }

  export interface PairParams {
    uri: string;
  }

  export interface ApproveParams {
    proposal: SessionTypes.Proposal;
    response: SessionTypes.Response;
  }
  export interface RejectParams {
    proposal: SessionTypes.Proposal;
  }

  export type UpdateParams = SessionTypes.UpdateParams;

  export type NotifyParams = SessionTypes.NotifyParams;

  export interface RequestParams {
    topic: string;
    request: RequestArguments;
    chainId?: string;
  }

  export interface RespondParams {
    topic: string;
    response: JsonRpcResponse;
  }

  export interface DisconnectParams {
    topic: string;
    reason: string;
  }
}
