import { ISequence } from "./sequence";
import { CryptoTypes } from "./crypto";
import { RelayTypes } from "./relay";
import { SettingTypes } from "./settings";

export declare namespace SessionTypes {
  export interface SignalProposeParams {
    type: SignalTypeConnection;
    params: Pick<SignalParamsConnection, "topic">;
  }

  export interface ProposeParams {
    signal: SignalProposeParams;
    relay: RelayTypes.ProtocolOptions;
    setting: SettingTypes.Proposal;
    metadata: Metadata;
  }

  export type CreateParams = ProposeParams;

  export type SignalTypeConnection = "connection";

  export type SignalType = SignalTypeConnection;

  export interface SignalParamsConnection {
    topic: string;
  }

  export type SignalParams = SignalParamsConnection;

  export interface BaseSignal {
    type: SignalType;
    params: SignalParams;
  }

  export interface SignalConnection extends BaseSignal {
    type: SignalTypeConnection;
    params: SignalParamsConnection;
  }

  export type Signal = SignalConnection;

  export type Peer = Required<CryptoTypes.Peer<Metadata>>;

  export interface Proposal {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    proposer: Peer;
    signal: Signal;
    setting: SettingTypes.Proposal;
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

  export interface RespondParams<S = any> {
    approved: boolean;
    proposal: Proposal;
    state: S;
    metadata: Metadata;
  }

  export interface SettleParams {
    relay: RelayTypes.ProtocolOptions;
    self: CryptoTypes.Self;
    peer: Peer;
    setting: SettingTypes.Settled;
  }

  export interface UpdateParams<S = any> {
    topic: string;
    update: Update<S>;
  }

  export type StateUpdate<S = any> = { state: S };

  export type MetadataUpdate = { peer: Omit<Peer, "publicKey"> };

  export type Update<S = any> = StateUpdate<S> | MetadataUpdate;

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
    setting: SettingTypes.Settled;
  }

  export interface Metadata {
    name: string;
    description: string;
    url: string;
    icons: string[];
  }

  export interface Success {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    setting: SettingTypes.Settled;
    responder: Peer;
  }
  export interface Failed {
    reason: string;
  }

  export type Outcome = Failed | Success;
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
