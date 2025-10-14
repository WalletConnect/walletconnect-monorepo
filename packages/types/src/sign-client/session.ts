import { RelayerTypes } from "../core/relayer.js";
import { IStore } from "../core/store.js";
import { SignClientTypes } from "./client.js";
import { ProposalTypes } from "./proposal.js";
import { AuthTypes } from "./auth.js";

export declare namespace SessionTypes {
  type Expiry = number;

  interface BaseNamespace {
    chains?: string[];
    accounts: string[];
    methods: string[];
    events: string[];
  }

  type Namespace = BaseNamespace;

  type Namespaces = Record<string, Namespace>;

  type SessionProperties = ProposalTypes.SessionProperties;
  type ScopedProperties = ProposalTypes.ScopedProperties;

  interface SessionConfig {
    disableDeepLink?: boolean;
  }

  interface Struct {
    topic: string;
    pairingTopic: string;
    relay: RelayerTypes.ProtocolOptions;
    expiry: Expiry;
    acknowledged: boolean;
    controller: string;
    namespaces: Namespaces;
    requiredNamespaces: ProposalTypes.RequiredNamespaces;
    optionalNamespaces: ProposalTypes.OptionalNamespaces;
    sessionProperties?: SessionProperties;
    scopedProperties?: ScopedProperties;
    sessionConfig?: SessionConfig;
    self: {
      publicKey: string;
      metadata: SignClientTypes.Metadata;
    };
    peer: {
      publicKey: string;
      metadata: SignClientTypes.Metadata;
    };
    authentication?: AuthTypes.Cacao[];
    transportType?: RelayerTypes.TransportType;
  }
}

export type ISession = IStore<string, SessionTypes.Struct>;
