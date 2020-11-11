import { CryptoTypes } from "./crypto";

export declare namespace SettingTypes {
  export interface JsonRpcConfig {
    methods: string[];
  }

  export interface WriteAccessProposal {
    proposer: boolean;
    responder: boolean;
  }

  export type WriteAccessProposalConfig<P = any> = Record<keyof P, WriteAccessProposal>;

  export type StateProposal<P = any> = {
    params: P;
    writeAccess: WriteAccessProposalConfig<P>;
  };

  export interface Proposal<P = any> {
    state: StateProposal<P>;
    jsonrpc: JsonRpcConfig;
  }

  export interface WriteAccessSettled {
    [publicKey: string]: boolean;
  }

  export type WriteAccessSettledConfig<P = any> = Record<keyof P, WriteAccessSettled>;

  export type StateSettled<S = any> = {
    data: S;
    writeAccess: WriteAccessSettledConfig<S>;
  };

  export interface Settled<S = any> {
    state: StateSettled<S>;
    jsonrpc: JsonRpcConfig;
  }

  export interface GenerateSettledParams<P = any, S = any> {
    proposal: Proposal<P>;
    proposer: CryptoTypes.Peer;
    responder: CryptoTypes.Peer;
    state: S;
  }

  export interface HandleSettledStateUpdateParams<S = any> {
    settled: Settled<S>;
    update: Partial<S>;
    participant: CryptoTypes.Peer;
  }
}

export interface Caip25StateParams {
  accounts: {
    chains: string[];
  };
}

export interface Caip25StateSettled {
  accounts: string[];
}
