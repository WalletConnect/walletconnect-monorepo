import { Logger } from "pino";
import { IKeyValueStorage, KeyValueStorageOptions } from "keyvaluestorage";
import { IEvents } from "@walletconnect/events";
import { JsonRpcResponse } from "@walletconnect/jsonrpc-types";

import { IRelayer, RelayerTypes } from "./relayer";
import { ISession, SessionTypes } from "./session";
import { IPairing, PairingTypes } from "./pairing";
import { SignalTypes, AppMetadata, Reason } from "./misc";
import { ICrypto, IKeyChain } from "./crypto";
import { IHeartBeat } from "./heartbeat";
import { IStorage } from "./storage";
import { IEncoder } from "./encoder";

export interface ClientOptions {
  name?: string;
  projectId?: string;
  controller?: boolean;
  metadata?: AppMetadata;
  relayUrl?: string;
  logger?: string | Logger;
  keychain?: IKeyChain;
  storage?: IKeyValueStorage;
  storageOptions?: KeyValueStorageOptions;
}

export abstract class IClient extends IEvents {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract logger: Logger;

  public abstract heartbeat: IHeartBeat;

  public abstract crypto: ICrypto;

  public abstract encoder: IEncoder;
  public abstract storage: IStorage;
  public abstract relayer: IRelayer;

  public abstract pairing: IPairing;
  public abstract session: ISession;

  public abstract readonly name: string;
  public abstract readonly context: string;

  public abstract readonly controller: boolean;
  public abstract readonly metadata: AppMetadata | undefined;

  public abstract readonly relayUrl: string | undefined;
  public abstract readonly projectId: string | undefined;

  constructor(opts?: ClientOptions) {
    super();
  }

  // for proposer to propose a session to a responder
  public abstract connect(params: ClientTypes.ConnectParams): Promise<SessionTypes.Settled>;
  // for responder to receive a session proposal from a proposer
  public abstract pair(params: ClientTypes.PairParams): Promise<PairingTypes.Settled>;

  // for responder to approve a session proposal
  public abstract approve(params: ClientTypes.ApproveParams): Promise<SessionTypes.Settled>;
  // for responder to reject a session proposal
  public abstract reject(params: ClientTypes.RejectParams): Promise<void>;

  // for controller to update session state
  public abstract update(params: ClientTypes.UpdateParams): Promise<void>;
  // for controller to upgrade session permissions
  public abstract upgrade(params: ClientTypes.UpgradeParams): Promise<void>;
  // for controller to extend session expiry
  public abstract extend(params: ClientTypes.ExtendParams): Promise<void>;

  // for proposer to request JSON-RPC
  public abstract request(params: ClientTypes.RequestParams): Promise<any>;
  // for responder to respond JSON-RPC
  public abstract respond(params: ClientTypes.RespondParams): Promise<void>;

  // for either to ping and verify peer is online
  public abstract ping(params: ClientTypes.PingParams): Promise<void>;
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

  export interface ResponseInput {
    state: SessionTypes.State;
    metadata?: AppMetadata;
  }

  export interface ApproveParams {
    proposal: SessionTypes.Proposal;
    response: ResponseInput;
  }
  export interface RejectParams {
    proposal: SessionTypes.Proposal;
    reason?: Reason;
  }

  export type UpdateParams = SessionTypes.UpdateParams;

  export type UpgradeParams = SessionTypes.UpgradeParams;

  export type ExtendParams = SessionTypes.ExtendParams;

  export type RequestParams = SessionTypes.RequestParams;

  export interface RespondParams {
    topic: string;
    response: JsonRpcResponse;
  }

  export interface PingParams {
    topic: string;
    timeout?: number;
  }

  export type NotifyParams = SessionTypes.NotifyParams;

  export type DisconnectParams = SessionTypes.DeleteParams;
}
