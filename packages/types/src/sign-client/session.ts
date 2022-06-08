import { SignClientTypes } from "./client";
import { RelayerTypes } from "../core/relayer";
import { IStore } from "../core/store";
import { ProposalTypes } from "./proposal";

export declare namespace SessionTypes {
  type Expiry = number;

  interface BaseNamespace {
    accounts: string[];
    methods: string[];
    events: string[];
  }

  interface Namespace extends BaseNamespace {
    extension?: BaseNamespace[];
  }

  type Namespaces = Record<string, Namespace>;

  interface Struct {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    expiry: Expiry;
    acknowledged: boolean;
    controller: string;
    namespaces: Namespaces;
    requiredNamespaces: ProposalTypes.RequiredNamespaces;
    self: {
      publicKey: string;
      metadata: SignClientTypes.Metadata;
    };
    peer: {
      publicKey: string;
      metadata: SignClientTypes.Metadata;
    };
  }
}

export type ISession = IStore<string, SessionTypes.Struct>;
