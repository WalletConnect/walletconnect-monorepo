import { JsonRpcPayload } from "rpc-json-types";

import { ISequence } from "./sequence";
import { CryptoTypes } from "./crypto";
import { RelayTypes } from "./relay";
import { BlockchainPermissions, BlockchainState, JsonRpcPermissions, SignalTypes } from "./misc";

export declare namespace SessionTypes {
  export interface Permissions {
    jsonrpc: JsonRpcPermissions;
    blockchain: BlockchainPermissions;
  }

  export interface ProposeParams {
    signal: Signal;
    relay: RelayTypes.ProtocolOptions;
    metadata: Metadata;
    permissions: Permissions;
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
    response: Response;
  }

  export interface SettleParams {
    relay: RelayTypes.ProtocolOptions;
    self: CryptoTypes.Self;
    peer: Peer;
    state: State;
    permissions: Permissions;
    ttl: number;
    expiry: number;
  }

  export interface UpdateParams {
    topic: string;
    update: Update;
  }

  export type StateUpdate = { state: Partial<BlockchainState> };

  export type Update = StateUpdate;

  export interface Payload {
    chainId?: string;
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

  export interface State extends BlockchainState {
    controller: CryptoTypes.Participant;
  }

  export interface Response {
    state: Omit<State, "controller">;
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
> {}
