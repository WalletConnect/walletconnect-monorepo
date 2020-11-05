import { ISequence } from "./sequence";
import { KeyPair } from "./crypto";
import { RelayTypes } from "./relay";

export declare namespace ConnectionTypes {
  export interface ProposeParams {
    relay: RelayTypes.ProtocolOptions;
  }

  export type CreateParams = ProposeParams;

  export interface Proposal {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    peer: Peer;
  }

  export interface Proposed extends Omit<Proposal, "peer"> {
    keyPair: KeyPair;
  }

  export interface RespondParams {
    approved: boolean;
    proposal: Proposal;
  }

  export interface Responded extends Omit<Proposal, "peer"> {
    keyPair: KeyPair;
    outcome: Outcome;
  }

  export interface SettleParams {
    relay: RelayTypes.ProtocolOptions;
    peer: Peer;
    keyPair: KeyPair;
  }

  export interface Settled {
    topic: string;
    relay: RelayTypes.ProtocolOptions;
    sharedKey: string;
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

  export interface Peer {
    publicKey: string;
    metadata?: Metadata;
  }

  export interface Metadata {
    type: string;
    platform: string;
    version: string;
    os: string;
  }

  // eslint-disable-next-line
  export interface StateParams {}

  // eslint-disable-next-line
  export interface State {}

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

export abstract class IConnection extends ISequence<
  ConnectionTypes.Proposed,
  ConnectionTypes.Proposal,
  ConnectionTypes.Responded,
  ConnectionTypes.Settled,
  ConnectionTypes.Update,
  ConnectionTypes.CreateParams,
  ConnectionTypes.RespondParams,
  ConnectionTypes.UpdateParams,
  ConnectionTypes.DeleteParams,
  ConnectionTypes.ProposeParams,
  ConnectionTypes.SettleParams
> {}
