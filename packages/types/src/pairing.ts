import { JsonRpcPayload, RequestArguments } from "@json-rpc-tools/types";

import { ISequence } from "./sequence";
import { CryptoTypes } from "./crypto";
import { RelayerTypes } from "./relayer";
import { JsonRpcPermissions, SignalTypes } from "./misc";

export declare namespace PairingTypes {
  export interface Permissions {
    jsonrpc: JsonRpcPermissions;
  }

  export interface ProposeParams {
    relay: RelayerTypes.ProtocolOptions;
  }

  export type CreateParams = ProposeParams;

  export type Signal = SignalTypes.Uri;

  export type Peer = CryptoTypes.Peer<Metadata>;

  export interface Proposal {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
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
  }

  export interface SettleParams {
    relay: RelayerTypes.ProtocolOptions;
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

  export interface RequestParams {
    topic: string;
    request: RequestArguments;
  }

  export type MetadataUpdate = { peer: Omit<Peer, "publicKey"> };

  export type Update = MetadataUpdate;

  export interface Payload {
    request: RequestArguments;
  }

  export interface PayloadEvent {
    topic: string;
    payload: JsonRpcPayload;
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
  PairingTypes.Update,
  PairingTypes.CreateParams,
  PairingTypes.RespondParams,
  PairingTypes.UpdateParams,
  PairingTypes.RequestParams,
  PairingTypes.DeleteParams,
  PairingTypes.ProposeParams,
  PairingTypes.SettleParams
> {}
