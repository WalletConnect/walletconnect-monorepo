import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { IStore } from "./store";

export declare namespace SessionTypes {
  type Expiry = number;

  interface NamespaceBody {
    accounts: string[];
    methods: string[];
    events: string[];
    extension?: {
      accounts: string[];
      methods?: string[];
      events?: string[];
    }[];
  }

  type Namespaces = Record<string, NamespaceBody>;

  interface Struct {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    expiry: Expiry;
    acknowledged: boolean;
    controller: string;
    namespaces: Namespaces;
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
    namespace?: {
      key: string;
      body: NamespaceBody;
    };
    expiry?: Expiry;
  }
}

export interface ISession extends IStore<string, SessionTypes.Struct> {
  find: (filters: SessionTypes.Updatable) => SessionTypes.Struct[];
}
