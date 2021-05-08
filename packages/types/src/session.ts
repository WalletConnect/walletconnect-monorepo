import {
  JsonRpcPayload,
  JsonRpcRequest,
  JsonRpcResponse,
  RequestArguments,
} from "@json-rpc-tools/types";

import { ISequence, SequenceTypes } from "./sequence";
import { CryptoTypes } from "./crypto";
import { RelayerTypes } from "./relayer";
import {
  SignalTypes,
  BlockchainTypes,
  JsonRpcPermissions,
  NotificationPermissions,
  AppMetadata,
  Reason,
} from "./misc";
import { SubscriptionEvent } from "./subscription";

export declare namespace SessionTypes {
  export type Relay = SequenceTypes.Relay;

  export interface BasePermissions extends SequenceTypes.BasePermissions {
    blockchain: BlockchainTypes.Permissions;
    notifications?: NotificationPermissions;
  }
  export interface ProposedPermissions extends BasePermissions {
    notifications: NotificationPermissions;
  }

  export interface SettledPermissions extends ProposedPermissions {
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
    response: Response;
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

  export type Success = SequenceTypes.Success<State, Participant>;

  export type Failed = SequenceTypes.Failed;

  export type Outcome = Failed | Success;

  export type State = BlockchainTypes.State;

  export interface Notification {
    type: string;
    data: any;
  }

  export interface NotificationEvent extends Notification {
    topic: string;
  }

  export type NotifyParams = NotificationEvent;

  export interface Response {
    state: State;
    metadata: AppMetadata;
  }
}

export abstract class ISession extends ISequence<
  SessionTypes.Pending,
  SessionTypes.Settled,
  SessionTypes.Upgrade,
  SessionTypes.Update,
  SessionTypes.CreateParams,
  SessionTypes.RespondParams,
  SessionTypes.RequestParams,
  SessionTypes.UpgradeParams,
  SessionTypes.UpdateParams,
  SessionTypes.DeleteParams,
  SessionTypes.ProposeParams,
  SessionTypes.SettleParams,
  SessionTypes.Participant
> {
  public abstract send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void>;

  public abstract notify(params: SessionTypes.NotifyParams): Promise<void>;

  protected abstract onNotification(event: SubscriptionEvent.Payload): Promise<void>;
}
