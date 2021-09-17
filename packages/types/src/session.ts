import { JsonRpcRequest, JsonRpcResponse } from "@walletconnect/jsonrpc-types";

import { ISequence, SequenceTypes } from "./sequence";
import { SignalTypes, BlockchainTypes, AppMetadata, NotificationPermissions } from "./misc";
import { CryptoTypes } from "./crypto";
import { IEngine } from "./engine";

export declare namespace SessionTypes {
  export type Status = SequenceTypes.Status;

  export type JsonRpc = SequenceTypes.JsonRpc;

  export type Events = SequenceTypes.Events;

  export type Config = SequenceTypes.Config<Events, JsonRpc, Status>;

  export type Relay = SequenceTypes.Relay;

  export interface BasePermissions extends SequenceTypes.BasePermissions {
    blockchain: BlockchainTypes.Permissions;
  }

  export interface ProposedPermissions extends SequenceTypes.ProposedPermissions {
    blockchain: BlockchainTypes.Permissions;
    notifications: NotificationPermissions;
  }

  export interface SettledPermissions extends SequenceTypes.SettledPermissions {
    controller: CryptoTypes.Participant;
  }

  export type Permissions = SettledPermissions;

  export interface ProposeParams extends SequenceTypes.ProposeParams {
    signal: Signal;
    metadata: AppMetadata;
    permissions: ProposedPermissions;
    ttl?: number;
  }

  export type CreateParams = ProposeParams;

  // Pairing method is specific to Session
  export type Signal = SignalTypes.Pairing;

  // Peer requires metadata in Session
  export interface Participant extends SequenceTypes.Participant {
    metadata: AppMetadata;
  }

  export interface ProposedPeer extends Participant {
    controller: boolean;
  }

  export type Proposal = SequenceTypes.Proposal<Signal, ProposedPeer, ProposedPermissions>;

  export type ProposedStatus = SequenceTypes.ProposedStatus;

  export type RespondedStatus = SequenceTypes.RespondedStatus;

  export type PendingStatus = SequenceTypes.PendingStatus;

  export type BasePending = SequenceTypes.BasePending<Participant, Proposal>;

  export type ProposedPending = SequenceTypes.ProposedPending<Participant, Proposal>;

  export type RespondedPending = SequenceTypes.RespondedPending<Participant, Proposal, State>;

  export type Pending = SequenceTypes.Pending<Participant, Proposal, State>;

  export interface RespondParams extends SequenceTypes.RespondParams<Proposal> {
    response: ResponseInput;
  }

  export type SettleParams = SequenceTypes.SettleParams<State, Participant, Permissions>;

  export interface UpgradeParams extends Upgrade {
    topic: string;
  }

  export interface UpdateParams extends Update {
    topic: string;
  }

  export interface RequestParams extends SequenceTypes.RequestParams {
    chainId?: string;
  }

  export type Upgrade = SequenceTypes.Upgrade<Permissions>;

  export type Update = SequenceTypes.Update<State>;

  export interface Request extends SequenceTypes.Request {
    chainId?: string;
  }

  export interface PayloadEvent extends SequenceTypes.PayloadEvent {
    chainId?: string;
  }

  export interface RequestEvent extends Omit<PayloadEvent, "payload"> {
    request: JsonRpcRequest;
  }

  export interface ResponseEvent extends Omit<PayloadEvent, "payload"> {
    response: JsonRpcResponse;
  }

  export type DeleteParams = SequenceTypes.DeleteParams;

  export type Settled = SequenceTypes.Settled<State, Participant, Permissions>;

  export type Created = Settled;

  export type Approval = SequenceTypes.Approval<State, Participant>;

  export type Rejection = SequenceTypes.Rejection;

  export type Response = Rejection | Approval;

  export type Success = SequenceTypes.Success<State, Participant>;

  export type Failed = SequenceTypes.Failed;

  export type Outcome = Failed | Success;

  export type State = BlockchainTypes.State;

  export interface ResponseInput {
    state: State;
    metadata: AppMetadata;
  }

  export type DefaultSignalParams = SequenceTypes.DefaultSignalParams<ProposedPeer>;

  export type Notification = SequenceTypes.Notification;

  export type NotificationEvent = SequenceTypes.NotificationEvent;

  export type NotifyParams = SequenceTypes.NotifyParams;

  export type Engine = IEngine<
    Pending,
    Settled,
    Upgrade,
    Update,
    CreateParams,
    RespondParams,
    RequestParams,
    UpgradeParams,
    UpdateParams,
    DeleteParams,
    ProposeParams,
    SettleParams,
    NotifyParams,
    Participant,
    Permissions
  >;
}

export abstract class ISession extends ISequence<
  SessionTypes.Engine,
  SessionTypes.Config,
  SessionTypes.Pending,
  SessionTypes.Settled,
  SessionTypes.Upgrade,
  SessionTypes.Update,
  SessionTypes.State,
  SessionTypes.Permissions,
  SessionTypes.CreateParams,
  SessionTypes.RespondParams,
  SessionTypes.RequestParams,
  SessionTypes.UpgradeParams,
  SessionTypes.UpdateParams,
  SessionTypes.DeleteParams,
  SessionTypes.ProposeParams,
  SessionTypes.SettleParams,
  SessionTypes.NotifyParams,
  SessionTypes.Participant,
  SessionTypes.Signal,
  SessionTypes.DefaultSignalParams,
  SessionTypes.ProposedPermissions
> {}
