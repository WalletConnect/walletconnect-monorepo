import { ISequence } from "./sequence";
import { KeyPair } from "./crypto";
import { RelayTypes } from "./relay";
import { ConnectionTypes } from "./connection";
import { SettingTypes } from "./settings";

export declare namespace SessionTypes {
  export interface SignalProposeParams {
    type: SignalTypeConnection;
    params: Pick<SignalParamsConnection, "topic">;
  }

  export interface ProposeParams {
    signal: SignalProposeParams;
    relay: RelayTypes.ProtocolOptions;
    chains: string[];
    methods: string[];
    metadata: Metadata;
  }

  export type CreateParams = ProposeParams;

  export type SignalTypeConnection = "connection";

  export type SignalType = SignalTypeConnection;

  export interface SignalParamsConnection {
    topic: string;
    keyPair: KeyPair;
    sharedKey: string;
    peer: ConnectionTypes.Participant;
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

  export interface Proposal {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    proposer: Participant;
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
    keyPair: KeyPair;
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
    state: SettingTypes.BaseStateSettled<string[]>;
    metadata: Metadata;
  }

  export interface SettleParams {
    relay: RelayTypes.ProtocolOptions;
    keyPair: KeyPair;
    peer: Participant;
    setting: SettingTypes.Settled;
  }

  export interface UpdateParams {
    topic: string;
    state?: SettingTypes.StateUpdate<string[]>;
    metadata?: Metadata;
  }

  export type Update = { state: SettingTypes.StateUpdate<string[]> } | { metadata: Metadata };

  export interface DeleteParams {
    topic: string;
    reason: string;
  }

  export interface Settled {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    sharedKey: string;
    keyPair: KeyPair;
    peer: Participant;
    setting: SettingTypes.Settled;
  }

  export interface Participant {
    publicKey: string;
    metadata: Metadata;
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
    responder: Participant;
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
