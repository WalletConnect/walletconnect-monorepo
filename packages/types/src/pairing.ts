import {
  JsonRpcPayload,
  JsonRpcRequest,
  JsonRpcResponse,
  RequestArguments,
} from "@json-rpc-tools/types";

import { ISequence } from "./sequence";
import { CryptoTypes } from "./crypto";
import { RelayerTypes } from "./relayer";
import { JsonRpcPermissions, SignalTypes } from "./misc";

export declare namespace PairingTypes {
  export interface BasePermissions {
    jsonrpc: JsonRpcPermissions;
  }
  export type ProposedPermissions = BasePermissions;

  export interface SettledPermissions extends ProposedPermissions {
    controller: CryptoTypes.Participant;
  }
  export type Permissions = SettledPermissions;

  export interface ProposeParams {
    relay: RelayerTypes.ProtocolOptions;
    timeout?: number;
  }

  export type CreateParams = ProposeParams;

  export type Signal = SignalTypes.Uri;

  export type Peer = CryptoTypes.Peer<Metadata>;

  export interface Proposal {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
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
    reason?: string;
  }

  export interface SettleParams {
    relay: RelayerTypes.ProtocolOptions;
    peer: Peer;
    self: CryptoTypes.Self;
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
    timeout?: number;
  }

  export interface Upgrade {
    permissions: Partial<Permissions>;
  }

  export interface Update {
    peer: Omit<Peer, "publicKey">;
  }

  export interface Payload {
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
    reason: string;
  }

  export interface Settled {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    sharedKey: string;
    self: CryptoTypes.Self;
    peer: Peer;
    permissions: SettledPermissions;
    expiry: number;
  }

  export type Created = Settled;

  export interface Metadata {
    type: string;
    platform: string;
    version: string;
    os: string;
  }

  export interface Success {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    responder: Peer;
    expiry: number;
  }

  export interface Failed {
    reason: string;
  }

  export type Outcome = Failed | Success;
}

export abstract class IPairing extends ISequence<
  PairingTypes.Pending,
  PairingTypes.Settled,
  PairingTypes.Upgrade,
  PairingTypes.Update,
  PairingTypes.CreateParams,
  PairingTypes.RespondParams,
  PairingTypes.RequestParams,
  PairingTypes.UpgradeParams,
  PairingTypes.UpdateParams,
  PairingTypes.DeleteParams,
  PairingTypes.ProposeParams,
  PairingTypes.SettleParams
> {}
