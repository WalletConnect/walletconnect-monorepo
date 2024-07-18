import { RelayerTypes } from "../core/relayer";
import { IStore } from "../core/store";
import { SignClientTypes } from "./client";
import { ProposalTypes } from "./proposal";
import { AuthTypes } from "./auth";

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
    sessionProperties?: ProposalTypes.SessionProperties;
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
  }
}

export type ISession = IStore<string, SessionTypes.Struct>;
