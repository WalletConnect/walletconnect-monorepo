import { SignClientTypes } from "./client";
import { RelayerTypes } from "../core/relayer";
import { IStore } from "../core/store";

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
    expiry: number;
    relays: RelayerTypes.ProtocolOptions[];
    proposer: {
      publicKey: string;
      metadata: SignClientTypes.Metadata;
    };
    requiredNamespaces: RequiredNamespaces;
    pairingTopic?: string;
  }
}

export type IProposal = IStore<number, ProposalTypes.Struct>;
