import { SignClientTypes } from "./client.js";
import { RelayerTypes } from "../core/relayer.js";
import { IStore } from "../core/store.js";

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
  type ScopedProperties = Record<string, unknown>;

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
    scopedProperties?: ScopedProperties;
    pairingTopic: string;
    // these two fields are for verifyContext
    attestation?: string;
    encryptedId?: string;
  }
}

export type IProposal = IStore<number, ProposalTypes.Struct>;
