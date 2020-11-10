export declare namespace SettingTypes {
  export interface WriteAccessProposal {
    proposer: boolean;
    responder: boolean;
  }

  export interface BaseStateProposalConfig<P = any> {
    params: P;
  }

  export interface StateProposalConfig<P = any> extends BaseStateProposalConfig<P> {
    writeAccess: WriteAccessProposal;
  }

  export type StateProposal<P = any> = Record<string, StateProposalConfig<P>>;

  export interface Proposal<P = any> {
    state: StateProposal<P>;
    methods: string[];
  }

  export interface Participant {
    publicKey: string;
  }

  export interface WriteAccessSettled {
    [publicKey: string]: boolean;
  }

  export interface BaseStateSettledConfig<S = any> {
    data: S;
  }

  export type BaseStateSettled<S = any> = Record<string, BaseStateSettledConfig<S>>;

  export interface StateSettledConfig<S = any> extends BaseStateSettledConfig<S> {
    writeAccess: WriteAccessSettled;
  }

  export type StateSettled<S = any> = Record<string, StateSettledConfig<S>>;

  export interface Settled<S = any> {
    state: StateSettled<S>;
    methods: string[];
  }

  export type StateUpdate<S = any> = Record<string, BaseStateSettledConfig<S>>;

  export interface GenerateSettledParams<P = any, S = any> {
    proposal: Proposal<P>;
    proposer: Participant;
    responder: Participant;
    state: BaseStateSettled<S>;
  }

  export interface HandleSettledStateUpdateParams<S = any> {
    settled: Settled<S>;
    update: StateUpdate<S>;
    participant: Participant;
  }
}
