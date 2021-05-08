import { Logger } from "pino";
import {
  JsonRpcPayload,
  IEvents,
  RequestArguments,
  JsonRpcRequest,
  JsonRpcResponse,
} from "@json-rpc-tools/types";

import { IClient } from "./client";
import { CryptoTypes } from "./crypto";
import { ISubscription, SubscriptionEvent } from "./subscription";
import { IJsonRpcHistory } from "./history";
import { AppMetadata, JsonRpcPermissions, Reason, SignalTypes } from "./misc";
import { RelayerTypes } from "./relayer";

export declare namespace SequenceTypes {
  export type Relay = RelayerTypes.ProtocolOptions;
  export interface BasePermissions {
    jsonrpc: JsonRpcPermissions;
  }
  export type ProposedPermissions = BasePermissions;

  export interface SettledPermissions extends ProposedPermissions {
    controller: CryptoTypes.Participant;
  }
  export type Permissions = SettledPermissions;

  export interface ProposeParams {
    relay: Relay;
    timeout?: number;
  }

  export type CreateParams = ProposeParams;

  export type Signal = SignalTypes.Base;

  export type Participant = CryptoTypes.Participant;
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
  }

  export interface Upgrade<Per = Permissions> {
    permissions: Partial<Per>;
  }

  export interface Update<S = State> {
    state: Partial<S>;
  }

  export interface Request {
    request: RequestArguments;
  }

  export interface PayloadEvent {
    topic: string;
    payload: JsonRpcPayload;
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

  export interface Success<S = State, Par = Participant> {
    topic: string;
    relay: Relay;
    responder: Par;
    expiry: number;
    state: S;
  }

  export interface Failed {
    reason: Reason;
  }

  export type Outcome<S = State, Par = Participant> = Failed | Success<S, Par>;
  export interface State {
    metadata?: AppMetadata;
  }
}

export abstract class ISequence<
  Pending = SequenceTypes.Pending,
  Settled = SequenceTypes.Settled,
  Upgrade = SequenceTypes.Upgrade,
  Update = SequenceTypes.Update,
  CreateParams = SequenceTypes.CreateParams,
  RespondParams = SequenceTypes.RespondParams,
  RequestParams = SequenceTypes.RequestParams,
  UpgradeParams = SequenceTypes.UpgradeParams,
  UpdateParams = SequenceTypes.UpdateParams,
  DeleteParams = SequenceTypes.DeleteParams,
  ProposeParams = SequenceTypes.ProposeParams,
  SettleParams = SequenceTypes.SettleParams,
  Participant = SequenceTypes.Participant
> extends IEvents {
  // pending subscriptions
  public abstract pending: ISubscription<Pending>;
  // settled subscriptions
  public abstract settled: ISubscription<Settled>;
  // jsonrpc history
  public abstract history: IJsonRpcHistory;

  // returns settled subscriptions length
  public abstract readonly length: number;
  // returns settled subscriptions topics
  public abstract readonly topics: string[];
  // returns settled subscriptions values
  public abstract readonly values: Settled[];

  // describes sequence context
  protected abstract context: string;

  constructor(public client: IClient, public logger: Logger) {
    super();
  }

  // initialize with persisted state
  public abstract init(): Promise<void>;

  // get settled subscription data
  public abstract get(topic: string): Promise<Settled>;
  // called by either to ping peer
  public abstract ping(topic: string, timeout?: number): Promise<void>;
  // send JSON-RPC to settled subscription
  public abstract send(topic: string, payload: JsonRpcPayload): Promise<void>;

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

  // ---------- Protected ----------------------------------------------- //

  // called by proposer (internally)
  protected abstract propose(params?: ProposeParams): Promise<Pending>;
  // called by both (internally)
  protected abstract settle(params: SettleParams): Promise<Settled>;

  // callback for proposed subscriptions payloads
  protected abstract onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // callback for responded subscriptions payloads
  protected abstract onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // callback for settled subscriptions payloads
  protected abstract onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // callback for incoming JSON-RPC payloads
  protected abstract onPayload(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // callback for state update payloads
  protected abstract onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // callback for permission upgrade payloads
  protected abstract onUpgrade(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // validates and processes state udpates
  protected abstract handleUpdate(
    topic: string,
    update: Update,
    participant: Participant,
  ): Promise<Update>;
  protected abstract handleUpgrade(
    topic: string,
    params: Upgrade,
    participant: Participant,
  ): Promise<Upgrade>;
}
