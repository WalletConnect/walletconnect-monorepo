import {
  JsonRpcPayload,
  JsonRpcRequest,
  JsonRpcResponse,
  RequestArguments,
} from "@json-rpc-tools/types";

import { ISequence } from "./sequence";
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
  export interface BasePermissions {
    jsonrpc: JsonRpcPermissions;
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

  export interface ProposeParams {
    signal: Signal;
    relay: RelayerTypes.ProtocolOptions;
    metadata: AppMetadata;
    permissions: ProposedPermissions;
    ttl?: number;
    timeout?: number;
  }

  export type CreateParams = ProposeParams;

  export type Signal = SignalTypes.Pairing;

  export type Peer = Required<CryptoTypes.Peer<AppMetadata>>;

  export interface ProposedPeer extends Peer {
    controller: boolean;
  }

  export interface Proposal {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    proposer: ProposedPeer;
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
    relay: RelayerTypes.ProtocolOptions;
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
    reason?: Reason;
  }

  export interface SettleParams {
    relay: RelayerTypes.ProtocolOptions;
    self: CryptoTypes.Self;
    peer: Peer;
    state: State;
    permissions: SettledPermissions;
    ttl: number;
    expiry: number;
  }

  export interface UpgradeParams extends Upgrade {
    topic: string;
  }

  export interface UpdateParams extends Update {
    topic: string;
  }

  export interface RequestParams {
    topic: string;
    request: RequestArguments;
    chainId?: string;
    timeout?: number;
  }

  export interface Upgrade {
    permissions: Partial<BasePermissions>;
  }

  export interface Update {
    state: Partial<State>;
  }

  export interface Payload {
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
    reason: Reason;
  }

  export interface Settled {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    self: CryptoTypes.Self;
    peer: Peer;
    permissions: SettledPermissions;
    expiry: number;
    state: State;
  }

  export type Created = Settled;

  export interface Success {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    responder: Peer;
    expiry: number;
    state: State;
  }
  export interface Failed {
    reason: Reason;
  }

  export type Outcome = Failed | Success;

  export type State = BlockchainTypes.State;

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
  SessionTypes.SettleParams
> {
  public abstract send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void>;

  public abstract notify(params: SessionTypes.NotifyParams): Promise<void>;

  protected abstract onNotification(event: SubscriptionEvent.Payload): Promise<void>;
}
