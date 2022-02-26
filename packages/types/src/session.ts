import { Logger } from "pino";
import {
  JsonRpcPayload,
  IEvents,
  RequestArguments,
  JsonRpcRequest,
  JsonRpcResponse,
} from "@walletconnect/jsonrpc-types";

import { IClient } from "./client";
import { CryptoTypes } from "./crypto";
import { IJsonRpcHistory } from "./history";
import {
  AppMetadata,
  BlockchainTypes,
  JsonRpcPermissions,
  NotificationPermissions,
  Reason,
} from "./misc";
import { IStore } from "./store";
import { IExpirer } from "./expirer";
import { RelayerTypes } from ".";

export declare namespace SessionTypes {
  export interface Events {
    proposed: string;
    responded: string;
    settled: string;
    updated: string;
    upgraded: string;
    extended: string;
    deleted: string;
    request: string;
    response: string;
    notified: string;
    sync: string;
  }
  export interface JsonRpc {
    propose: string;
    settle: string;
    update: string;
    upgrade: string;
    extend: string;
    delete: string;
    request: string;
    ping: string;
    notify: string;
  }

  export interface Config<E = Events, J = JsonRpc> {
    ttl: number;
    events: E;
    jsonrpc: J;
  }

  export type Relay = RelayerTypes.ProtocolOptions;
  export interface BasePermissions {
    jsonrpc: JsonRpcPermissions;
    blockchain: BlockchainTypes.Permissions;
    notifications?: NotificationPermissions;
  }
  export interface ProposedPermissions extends BasePermissions {
    blockchain: BlockchainTypes.Permissions;
    notifications: NotificationPermissions;
  }

  export interface SettledPermissions extends ProposedPermissions {
    controller: CryptoTypes.Participant;
  }
  export type Permissions = SettledPermissions;

  export interface ProposeParams {
    relay: Relay;
    metadata: AppMetadata;
    permissions: ProposedPermissions;
    ttl?: number;
    timeout?: number;
  }

  export type CreateParams = ProposeParams;

  export interface Participant extends CryptoTypes.Participant {
    metadata: AppMetadata;
  }

  export interface Participants<Par = Participant> {
    self: Par;
    peer: Par;
  }

  export interface ProposedPeer extends Participant {
    controller: boolean;
  }

  export interface Proposal<Par = ProposedPeer, Per = ProposedPermissions> {
    topic: string;
    relay: Relay;
    proposer: Par;
    permissions: Per;
    ttl: number;
  }

  export interface RespondParams<Pro = Proposal> {
    approved: boolean;
    proposal: Pro;
    response: ResponseInput;
    reason?: Reason;
  }

  export interface SettleParams<S = State, Par = Participant, Per = Permissions> {
    relay: Relay;
    participants: Participants<Par>;
    state: S;
    permissions: Per;
    ttl: number;
    expiry: number;
  }

  export interface UpdateParams<S = State> extends Update<S> {
    topic: string;
  }

  export interface UpgradeParams<Per = Permissions> extends Upgrade<Per> {
    topic: string;
  }

  export interface ExtendParams {
    topic: string;
    ttl: number;
  }

  export interface RequestParams {
    topic: string;
    request: RequestArguments;
    timeout?: number;
    chainId?: string;
  }

  export interface Update<S = State> {
    state: Partial<S>;
  }

  export interface Upgrade<Per = Permissions> {
    permissions: Partial<Per>;
  }

  export interface Extension {
    expiry: number;
  }

  export interface Request {
    request: RequestArguments;
    chainId?: string;
  }

  export interface PayloadEvent {
    topic: string;
    payload: JsonRpcPayload;
    chainId?: string;
  }

  export interface RequestEvent extends Omit<PayloadEvent, "payload"> {
    request: JsonRpcRequest;
  }

  export interface ResponseEvent extends Omit<PayloadEvent, "payload"> {
    response: JsonRpcResponse;
  }

  export interface DeleteParams {
    topic: string;
    reason: Reason;
  }

  export interface Settled<S = State, Par = Participant, Per = Permissions> {
    topic: string;
    relay: Relay;
    participants: Participants<Par>;
    permissions: Per;
    expiry: number;
    state: S;
    acknowledged: boolean;
  }

  export type Created<S = State, Par = Participant, Per = Permissions> = Settled<S, Par, Per>;

  export interface Approval<S = State, Par = Participant> {
    relay: Relay;
    responder: Par;
    expiry: number;
    state: S;
  }

  export interface Rejection {
    reason: Reason;
  }

  export type Response<S = State, Par = Participant> = Rejection | Approval<S, Par>;

  export interface Success<S = State, Par = Participant> extends Approval<S, Par> {
    topic: string;
  }

  export type Failed = Rejection;

  export type Outcome<S = State, Par = Participant> = Failed | Success<S, Par>;

  export type State = {
    blockchain: BlockchainTypes.State;
  };

  export interface ResponseInput {
    state: State;
    metadata: AppMetadata;
  }

  export interface DefaultSignalParams<P = ProposedPeer> {
    topic: string;
    relay: Relay;
    proposer: P;
  }

  export interface Notification {
    type: string;
    data: any;
  }

  export interface NotificationEvent {
    topic: string;
    notification: Notification;
  }

  export type NotifyParams = NotificationEvent;
}

export abstract class ISession<
  Config = SessionTypes.Config,
  Proposal = SessionTypes.Proposal,
  Settled = SessionTypes.Settled,
  Update = SessionTypes.Update,
  Upgrade = SessionTypes.Upgrade,
  Extension = SessionTypes.Extension,
  State = SessionTypes.State,
  Permissions = SessionTypes.Permissions,
  CreateParams = SessionTypes.CreateParams,
  RespondParams = SessionTypes.RespondParams,
  RequestParams = SessionTypes.RequestParams,
  UpdateParams = SessionTypes.UpdateParams,
  UpgradeParams = SessionTypes.UpgradeParams,
  ExtendParams = SessionTypes.ExtendParams,
  DeleteParams = SessionTypes.DeleteParams,
  ProposeParams = SessionTypes.ProposeParams,
  SettleParams = SessionTypes.SettleParams,
  NotifyParams = SessionTypes.NotifyParams,
  Participant = SessionTypes.Participant,
  DefaultSignalParams = SessionTypes.DefaultSignalParams,
  ProposedPermissions = SessionTypes.ProposedPermissions
> extends IEvents {
  // stored sessions
  public abstract store: IStore<Settled>;
  // jsonrpc history
  public abstract history: IJsonRpcHistory;
  // session expiry
  public abstract expirer: IExpirer;

  // returns settled sessions length
  public abstract readonly length: number;
  // returns settled sessions topics
  public abstract readonly topics: string[];
  // returns settled sessions values
  public abstract readonly values: Settled[];

  // controller configuration
  public abstract readonly name: string;
  public abstract readonly context: string;
  public abstract readonly config: Config;

  constructor(public client: IClient, public logger: Logger) {
    super();
  }

  // initialize with persisted state
  public abstract init(): Promise<void>;

  // get settled session state
  public abstract get(topic: string): Promise<Settled>;

  // find compatible settled session
  public abstract find(permissions: Partial<Permissions>): Promise<Settled[]>;

  // called by either to ping peer
  public abstract ping(topic: string, timeout?: number): Promise<void>;
  // called by either to send JSON-RPC
  public abstract send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void>;

  // called by proposer
  public abstract create(params?: CreateParams): Promise<Settled>;
  // called by responder
  public abstract respond(params: RespondParams): Promise<Settled>;

  // called by proposer to request JSON-RPC
  public abstract request(params: RequestParams): Promise<any>;

  // called by controller to update state
  public abstract update(params: UpdateParams): Promise<Settled>;
  // called by controller to upgrade permissions
  public abstract upgrade(params: UpgradeParams): Promise<Settled>;
  // called by controller to extend expiry
  public abstract extend(params: ExtendParams): Promise<Settled>;

  // called by either to terminate
  public abstract delete(params: DeleteParams): Promise<void>;
  // called by either to notify
  public abstract notify(params: NotifyParams): Promise<void>;

  // merge callbacks for session engine
  public abstract mergeUpdate(topic: string, update: Update): Promise<State>;
  public abstract mergeUpgrade(topic: string, upgrade: Upgrade): Promise<Permissions>;
  public abstract mergeExtension(topic: string, extension: Extension): Promise<Extension>;

  // validator callbacks for session engine
  public abstract validateRespond(params?: RespondParams): Promise<void>;
  public abstract validateRequest(params?: RequestParams): Promise<void>;
  public abstract validatePropose(params?: ProposeParams): Promise<void>;

  // state transitions
  protected abstract propose(params?: ProposeParams): Promise<Proposal>;
  protected abstract settle(params: SettleParams): Promise<Settled>;

  // event callbacks
  protected abstract onResponse(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onAcknowledge(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onMessage(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onRequest(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onUpdate(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onUpgrade(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onExtend(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onNotify(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;

  protected abstract handleUpdate(
    topic: string,
    update: Update,
    participant: Participant,
  ): Promise<Update>;
  protected abstract handleUpgrade(
    topic: string,
    upgrade: Upgrade,
    participant: Participant,
  ): Promise<Upgrade>;
  protected abstract handleExtension(
    topic: string,
    extension: Extension,
    participant: Participant,
  ): Promise<Extension>;
}
