import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { IStore } from "./store";

export declare namespace ProposalTypes {
  interface BaseRequiredNamespace {
    chains: string[];
    methods: string[];
    events: string[];
  }

  interface RequiredNamespace extends BaseRequiredNamespace {
    extension?: BaseRequiredNamespace[];
  }

  type RequiredNamespaces = Record<string, RequiredNamespace>;

  export interface Struct {
    id: number;
    relays: RelayerTypes.ProtocolOptions[];
    proposer: {
      publicKey: string;
      metadata: ClientTypes.Metadata;
    };
    requiredNamespaces: RequiredNamespaces;
    pairingTopic?: string;
  }
}

export type IProposal = IStore<number, ProposalTypes.Struct>;
