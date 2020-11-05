import { ISequence } from "./sequence";
import { KeyPair } from "./crypto";
import { RelayTypes } from "./relay";

export declare namespace SessionTypes {
  export interface ProposeParams {
    connection: { topic: string };
    relay: RelayTypes.ProtocolOptions;
    stateParams: StateParams;
    ruleParams: RuleParams;
    metadata: Metadata;
  }

  export type CreateParams = ProposeParams;

  export interface Proposal {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    peer: Peer;
    stateParams: StateParams;
    ruleParams: RuleParams;
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
    state: State;
    metadata: Metadata;
    proposal: Proposal;
  }

  export interface SettleParams {
    relay: RelayTypes.ProtocolOptions;
    keyPair: KeyPair;
    peer: Peer;
    state: State;
    rules: Rules;
  }

  export interface UpdateParams {
    topic: string;
    state?: State;
    metadata?: Metadata;
  }

  export type Update = { state: State } | { metadata: Metadata };

  export interface DeleteParams {
    topic: string;
    reason: string;
  }

  export interface Settled {
    relay: RelayTypes.ProtocolOptions;
    topic: string;
    sharedKey: string;
    keyPair: KeyPair;
    peer: Peer;
    state: State;
    rules: Rules;
  }

  export interface Peer {
    publicKey: string;
    metadata: Metadata;
  }

  export interface Metadata {
    name: string;
    description: string;
    url: string;
    icons: string[];
  }

  export interface StateParams {
    chains: string[];
  }

  export interface State {
    accounts: string[];
  }

  export interface WriteAccessParams {
    [key: string]: {
      proposer: boolean;
      responder: boolean;
    };
  }

  export interface RuleParams {
    state: WriteAccessParams;
    jsonrpc: string[];
  }

  export interface WriteAccess {
    [key: string]: {
      [publicKey: string]: boolean;
    };
  }

  export interface Rules {
    state: WriteAccess;
    jsonrpc: string[];
  }

  export interface Success {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    state: State;
    peer: Peer;
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
