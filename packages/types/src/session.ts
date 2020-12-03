import { JsonRpcPayload } from "@json-rpc-tools/types";

import { ISequence } from "./sequence";
import { CryptoTypes } from "./crypto";
import { RelayTypes } from "./relay";
import { SignalTypes, BlockchainTypes, JsonRpcPermissions, NotificationPermissions } from "./misc";
import { SubscriptionEvent } from "./subscription";

export declare namespace SessionTypes {
  export interface BasePermissions {
    jsonrpc: JsonRpcPermissions;
    blockchain: BlockchainTypes.Permissions;
  }

  export interface StatePermissions {
    controller: CryptoTypes.Participant;
  }

  export interface ProposedPermissions extends BasePermissions {
    notifications: NotificationPermissions.Proposal;
  }

  export interface SettledPermissions extends BasePermissions {
    notifications: NotificationPermissions.Settled;
    state: StatePermissions;
  }

  export interface ProposeParams {
    signal: Signal;
    relay: RelayTypes.ProtocolOptions;
    metadata: Metadata;
    permissions: ProposedPermissions;
    ttl?: number;
  }

  export type CreateParams = ProposeParams;

  export type Signal = SignalTypes.Connection;

  export type Peer = Required<CryptoTypes.Peer<Metadata>>;

  export interface Proposal {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    proposer: Peer;
    signal: Signal;
    permissions: ProposedPermissions;
    ttl: number;
  }

  export type ProposedStatus = "proposed";

  export type RespondedStatus = "responded";

  export type PendingStatus = ProposedStatus | RespondedStatus;

  export interface BasePending {
    status: PendingStatus;
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    self: CryptoTypes.Self;
    proposal: Proposal;
  }

  export interface ProposedPending extends BasePending {
    status: ProposedStatus;
  }

  export interface RespondedPending extends BasePending {
    status: RespondedStatus;
    outcome: Outcome;
  }

  export type Pending = ProposedPending | RespondedPending;

  export interface RespondParams {
    approved: boolean;
    proposal: Proposal;
    response: Response;
  }

  export interface SettleParams {
    relay: RelayTypes.ProtocolOptions;
    self: CryptoTypes.Self;
    peer: Peer;
    state: State;
    permissions: SettledPermissions;
    ttl: number;
    expiry: number;
  }

  export interface UpdateParams {
    topic: string;
    update: Update;
  }

  export type StateUpdate = { state: Partial<BlockchainTypes.State> };

  export type Update = StateUpdate;

  export interface Payload {
    chainId?: string;
    payload: JsonRpcPayload;
  }

  export interface PayloadEvent extends Payload {
    topic: string;
  }

  export interface Notification {
    type: string;
    data: any;
  }

  export interface NotificationEvent extends Notification {
    topic: string;
  }

  export type NotifyParams = NotificationEvent;
  export interface DeleteParams {
    topic: string;
    reason: string;
  }

  export interface Settled {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    sharedKey: string;
    self: CryptoTypes.Self;
    peer: Peer;
    permissions: SettledPermissions;
    expiry: number;
    state: State;
  }

  export type Created = Settled;

  export interface Metadata {
    name: string;
    description: string;
    url: string;
    icons: string[];
  }

  export interface Success {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    responder: Peer;
    expiry: number;
    state: State;
  }
  export interface Failed {
    reason: string;
  }

  export type Outcome = Failed | Success;

  export type State = BlockchainTypes.State;

  export interface Response {
    state: State;
    metadata: Metadata;
  }
}

export abstract class ISession extends ISequence<
  SessionTypes.Pending,
  SessionTypes.Settled,
  SessionTypes.Update,
  SessionTypes.CreateParams,
  SessionTypes.RespondParams,
  SessionTypes.UpdateParams,
  SessionTypes.DeleteParams,
  SessionTypes.ProposeParams,
  SessionTypes.SettleParams
> {
  public abstract notify(params: SessionTypes.NotifyParams): Promise<void>;

  protected abstract onNotification(event: SubscriptionEvent.Payload): Promise<void>;
}
