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
  SignalTypes,
} from "./misc";
import { RelayerTypes } from "./relayer";
import { IEngine } from "./engine";
import { IState } from "./state";

export declare namespace SequenceTypes {
  export interface Status {
    proposed: string;
    responded: string;
    pending: string;
    settled: string;
  }
  export interface Events {
    proposed: string;
    responded: string;
    settled: string;
    updated: string;
    deleted: string;
    request: string;
    response: string;
    sync: string;
    notification: string;
  }
  export interface JsonRpc {
    propose: string;
    approve: string;
    reject: string;
    update: string;
    upgrade: string;
    delete: string;
    payload: string;
    ping: string;
    notification: string;
  }

  export interface Config<E = Events, J = JsonRpc, S = Status> {
    events: E;
    jsonrpc: J;
    status: S;
  }

  export type Relay = RelayerTypes.ProtocolOptions;
  export interface BasePermissions {
    jsonrpc: JsonRpcPermissions;
    blockchain?: BlockchainTypes.Permissions;
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
    timeout?: number;
    signal?: Signal;
    ttl?: number;
    permissions?: ProposedPermissions;
    metadata?: AppMetadata;
  }

  export type CreateParams = ProposeParams;

  export type Signal = SignalTypes.Base;

  export interface Participant extends CryptoTypes.Participant {
    metadata?: AppMetadata;
  }

  export interface ProposedPeer extends Participant {
    controller: boolean;
  }

  export interface Proposal<S = Signal, Par = ProposedPeer, Per = ProposedPermissions> {
    topic: string;
    relay: Relay;
    proposer: Par;
    signal: S;
    permissions: Per;
    ttl: number;
  }

  export type ProposedStatus = "proposed";

  export type RespondedStatus = "responded";

  export type PendingStatus = ProposedStatus | RespondedStatus;

  export interface BasePending<Par = Participant, Pro = Proposal> {
    status: PendingStatus;
    topic: string;
    relay: Relay;
    self: Par;
    proposal: Pro;
  }

  export interface ProposedPending<Par = Participant, Pro = Proposal>
    extends BasePending<Par, Pro> {
    status: ProposedStatus;
  }

  export interface RespondedPending<Par = Participant, Pro = Proposal, S = State>
    extends BasePending<Par, Pro> {
    status: RespondedStatus;
    outcome: Outcome<S, Par>;
  }

  export type Pending<Par = Participant, Pro = Proposal, S = State> =
    | ProposedPending<Par, Pro>
    | RespondedPending<Par, Pro, S>;

  export interface RespondParams<Pro = Proposal> {
    approved: boolean;
    proposal: Pro;
    reason?: Reason;
    response?: ResponseInput;
  }

  export interface SettleParams<S = State, Par = Participant, Per = Permissions> {
    relay: Relay;
    peer: Par;
    self: Par;
    state: S;
    permissions: Per;
    ttl: number;
    expiry: number;
  }

  export interface UpgradeParams<Per = Permissions> extends Upgrade<Per> {
    topic: string;
  }

  export interface UpdateParams<S = State> extends Update<S> {
    topic: string;
  }

  export interface RequestParams {
    topic: string;
    request: RequestArguments;
    timeout?: number;
    chainId?: string;
  }

  export interface Upgrade<Per = Permissions> {
    permissions: Partial<Per>;
  }

  export interface Update<S = State> {
    state: Partial<S>;
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
    self: Par;
    peer: Par;
    permissions: Per;
    expiry: number;
    state: S;
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

  export type State = any;

  export interface ResponseInput {
    state?: State;
    metadata?: AppMetadata;
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

  export type Engine = IEngine;
}

export abstract class ISequence<
  Engine = SequenceTypes.Engine,
  Config = SequenceTypes.Config,
  Pending = SequenceTypes.Pending,
  Settled = SequenceTypes.Settled,
  Upgrade = SequenceTypes.Upgrade,
  Update = SequenceTypes.Update,
  State = SequenceTypes.State,
  Permissions = SequenceTypes.Permissions,
  CreateParams = SequenceTypes.CreateParams,
  RespondParams = SequenceTypes.RespondParams,
  RequestParams = SequenceTypes.RequestParams,
  UpgradeParams = SequenceTypes.UpgradeParams,
  UpdateParams = SequenceTypes.UpdateParams,
  DeleteParams = SequenceTypes.DeleteParams,
  ProposeParams = SequenceTypes.ProposeParams,
  SettleParams = SequenceTypes.SettleParams,
  NotifyParams = SequenceTypes.NotifyParams,
  Participant = SequenceTypes.Participant,
  Signal = SequenceTypes.Signal,
  DefaultSignalParams = SequenceTypes.DefaultSignalParams,
  ProposedPermissions = SequenceTypes.ProposedPermissions
> extends IEvents {
  // pending sequences
  public abstract pending: IState<Pending>;
  // settled sequences
  public abstract settled: IState<Settled>;
  // jsonrpc history
  public abstract history: IJsonRpcHistory;

  // returns settled sequences length
  public abstract readonly length: number;
  // returns settled sequences topics
  public abstract readonly topics: string[];
  // returns settled sequences values
  public abstract readonly values: Settled[];

  // describes sequence name
  public abstract name: string;

  // describes sequence context
  public abstract readonly context: string;

  // describes sequence config
  public abstract config: Config;

  // sequence protocol engine
  public abstract engine: Engine;

  constructor(public client: IClient, public logger: Logger) {
    super();
  }

  // initialize with persisted state
  public abstract init(): Promise<void>;

  // get settled sequence state
  public abstract get(topic: string): Promise<Settled>;

  // find compatible settled sequence
  public abstract find(permissions: Partial<Permissions>): Promise<Settled[]>;

  // called by either to ping peer
  public abstract ping(topic: string, timeout?: number): Promise<void>;
  // called by either to send JSON-RPC
  public abstract send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void>;

  // called by proposer
  public abstract create(params?: CreateParams): Promise<Settled>;
  // called by responder
  public abstract respond(params: RespondParams): Promise<Pending>;

  // called by proposer to request JSON-RPC
  public abstract request(params: RequestParams): Promise<any>;
  // called by responder to upgrade permissions
  public abstract upgrade(params: UpgradeParams): Promise<Settled>;

  // called by either to update state
  public abstract update(params: UpdateParams): Promise<Settled>;
  // called by either to terminate
  public abstract delete(params: DeleteParams): Promise<void>;
  // called by either to notify
  public abstract notify(params: NotifyParams): Promise<void>;

  // merge callbacks for sequence engine
  public abstract mergeUpdate(topic: string, update: Update): Promise<State>;
  public abstract mergeUpgrade(topic: string, upgrade: Upgrade): Promise<Permissions>;

  // validator callbacks for sequence engine
  public abstract validateRespond(params?: RespondParams): Promise<void>;
  public abstract validateRequest(params?: RequestParams): Promise<void>;
  public abstract validatePropose(params?: ProposeParams): Promise<void>;

  // default callbacks for sequence engine
  public abstract getDefaultSignal(params: DefaultSignalParams): Promise<Signal>;
  public abstract getDefaultTTL(): Promise<number>;
  public abstract getDefaultPermissions(): Promise<ProposedPermissions>;
}
