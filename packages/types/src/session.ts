import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { IStore } from "./store";

export declare namespace SessionTypes {
  type Expiry = number;

  interface Namespace {
    methods: string[];
    events: string[];
    accounts: string[];
  }

  interface ProposedNamespace {
    methods: string[];
    events: string[];
    chains: string[];
  }

  interface Struct {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    expiry: Expiry;
    acknowledged: boolean;
    controller: string;
    namespaces: Namespace[];
    self: {
      publicKey: string;
      metadata: ClientTypes.Metadata;
    };
    peer: {
      publicKey: string;
      metadata: ClientTypes.Metadata;
    };
  }

  interface Updatable {
    namespace?: Namespace;
    expiry?: Expiry;
  }
}

export interface ISession extends IStore<string, SessionTypes.Struct> {
  find: (filters: SessionTypes.Updatable) => SessionTypes.Struct[];
}
