import { Logger } from "pino";
import { IKeyValueStorage, KeyValueStorageOptions } from "keyvaluestorage";
import { IJsonRpcProvider, JsonRpcResponse, IEvents } from "@walletconnect/jsonrpc-types";

import { IRelayer, RelayerTypes } from "./relayer";
import { ISession, SessionTypes } from "./session";
import { IPairing } from "./pairing";
import { SignalTypes, AppMetadata, Reason } from "./misc";
import { ICrypto, IKeyChain } from "./crypto";

export interface ClientOptions {
  name?: string;
  controller?: boolean;
  metadata?: AppMetadata;
  logger?: string | Logger;
  keychain?: IKeyChain;
  storage?: IKeyValueStorage;
  relayProvider?: string | IJsonRpcProvider;
  storageOptions?: KeyValueStorageOptions;
}

export abstract class IClient extends IEvents {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract logger: Logger;
  public abstract crypto: ICrypto;

  public abstract relayer: IRelayer;
  public abstract storage: IKeyValueStorage;

  public abstract pairing: IPairing;
  public abstract session: ISession;

  public abstract context: string;

  public abstract readonly controller: boolean;
  public abstract metadata: AppMetadata | undefined;

  constructor(opts?: ClientOptions) {
    super();
  }

  // for proposer to propose a session to a responder
  public abstract connect(params: ClientTypes.ConnectParams): Promise<SessionTypes.Settled>;
  // for responder to receive a session proposal from a proposer
  public abstract pair(params: ClientTypes.PairParams): Promise<string>;

  // for responder to approve a session proposal
  public abstract approve(params: ClientTypes.ApproveParams): Promise<SessionTypes.Settled>;
  // for responder to reject a session proposal
  public abstract reject(params: ClientTypes.RejectParams): Promise<void>;
  // for responder to upgrade session permissions
  public abstract upgrade(params: ClientTypes.UpgradeParams): Promise<void>;
  // for responder to update session state
  public abstract update(params: ClientTypes.UpdateParams): Promise<void>;

  // for proposer to request JSON-RPC
  public abstract request(params: ClientTypes.RequestParams): Promise<any>;
  // for responder to respond JSON-RPC
  public abstract respond(params: ClientTypes.RespondParams): Promise<void>;

  // for either to send notifications
  public abstract notify(params: ClientTypes.NotifyParams): Promise<void>;
  // for either to disconnect a session
  public abstract disconnect(params: ClientTypes.DisconnectParams): Promise<void>;
}

export declare namespace ClientTypes {
  export interface ConnectParams {
    permissions: SessionTypes.BasePermissions;
    metadata?: AppMetadata;
    relay?: RelayerTypes.ProtocolOptions;
    pairing?: SignalTypes.ParamsPairing;
  }

  export interface PairParams {
    uri: string;
  }

  export interface Response {
    state: SessionTypes.State;
    metadata?: AppMetadata;
  }

  export interface ApproveParams {
    proposal: SessionTypes.Proposal;
    response: Response;
  }
  export interface RejectParams {
    proposal: SessionTypes.Proposal;
    reason?: Reason;
  }

  export type UpgradeParams = SessionTypes.UpgradeParams;

  export type UpdateParams = SessionTypes.UpdateParams;

  export type RequestParams = SessionTypes.RequestParams;

  export interface RespondParams {
    topic: string;
    response: JsonRpcResponse;
  }

  export type NotifyParams = SessionTypes.NotifyParams;

  export type DisconnectParams = SessionTypes.DeleteParams;
}
