import { SignClientTypes } from "./client";
import { RelayerTypes } from "../core/relayer";
import { IStore } from "../core/store";

export declare namespace ProposalTypes {
  interface BaseRequiredNamespace {
    chains?: string[];
    methods: string[];
    events: string[];
  }

  type RequiredNamespace = BaseRequiredNamespace;

  type RequiredNamespaces = Record<string, RequiredNamespace>;
  type OptionalNamespaces = Record<string, RequiredNamespace>;
  type SessionProperties = Record<string, string>;

  export interface Struct {
    id: number;
    /**
     * @deprecated in favor of expiryTimestamp
     */
    expiry?: number;
    expiryTimestamp: number;
    relays: RelayerTypes.ProtocolOptions[];
    proposer: {
      publicKey: string;
      metadata: SignClientTypes.Metadata;
    };
    requiredNamespaces: RequiredNamespaces;
    optionalNamespaces: OptionalNamespaces;
    sessionProperties?: SessionProperties;
    pairingTopic?: string;
  }
}

export type IProposal = IStore<number, ProposalTypes.Struct>;
