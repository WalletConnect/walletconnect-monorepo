import { JsonRpcPayload } from "@json-rpc-tools/types";

import { ISequence } from "./sequence";
import { CryptoTypes } from "./crypto";
import { RelayTypes } from "./relay";
import { JsonRpcPermissions, SignalTypes } from "./misc";

export declare namespace ConnectionTypes {
  export interface Permissions {
    jsonrpc: JsonRpcPermissions;
  }

  export interface ProposeParams {
    relay: RelayTypes.ProtocolOptions;
  }

  export type CreateParams = ProposeParams;

  export type Signal = SignalTypes.Uri;

  export type Peer = CryptoTypes.Peer<Metadata>;

  export interface Proposal {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    proposer: Peer;
    signal: Signal;
    permissions: Permissions;
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
  }

  export interface SettleParams {
    relay: RelayTypes.ProtocolOptions;
    peer: Peer;
    self: CryptoTypes.Self;
    permissions: Permissions;
    ttl: number;
    expiry: number;
  }

  export interface UpdateParams {
    topic: string;
    update: Update;
  }

  export type MetadataUpdate = { peer: Omit<Peer, "publicKey"> };

  export type Update = MetadataUpdate;
  export interface Payload {
    payload: JsonRpcPayload;
  }

  export interface PayloadEvent extends Payload {
    topic: string;
  }

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
    permissions: Permissions;
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
    relay: RelayTypes.ProtocolOptions;
    responder: Peer;
    expiry: number;
  }

  export interface Failed {
    reason: string;
  }

  export type Outcome = Failed | Success;
}

export abstract class IConnection extends ISequence<
  ConnectionTypes.Pending,
  ConnectionTypes.Settled,
  ConnectionTypes.Update,
  ConnectionTypes.CreateParams,
  ConnectionTypes.RespondParams,
  ConnectionTypes.UpdateParams,
  ConnectionTypes.DeleteParams,
  ConnectionTypes.ProposeParams,
  ConnectionTypes.SettleParams
> {}
