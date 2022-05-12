import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { IStore } from "./store";

export declare namespace ProposalTypes {
  interface RequiredNamespaceBody {
    chains: string[];
    methods: string[];
    events: string[];
    extension?: {
      chains: string[];
      methods?: string[];
      events?: string[];
    }[];
  }

  type RequiredNamespaces = Record<string, RequiredNamespaceBody>;

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
