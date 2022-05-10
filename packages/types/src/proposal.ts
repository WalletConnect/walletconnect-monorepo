import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { IStore } from "./store";

export declare namespace ProposalTypes {
  interface ProposedNamespace {
    methods: string[];
    events: string[];
    chains: string[];
  }

  export interface Struct {
    id: number;
    relays: RelayerTypes.ProtocolOptions[];
    proposer: {
      publicKey: string;
      metadata: ClientTypes.Metadata;
    };
    proposedNamespaces: ProposedNamespace[];
    pairingTopic?: string;
  }
}

export type IProposal = IStore<number, ProposalTypes.Struct>;
