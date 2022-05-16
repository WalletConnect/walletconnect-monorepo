import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { IStore } from "./store";

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
    self: {
      publicKey: string;
      metadata: ClientTypes.Metadata;
    };
    peer: {
      publicKey: string;
      metadata: ClientTypes.Metadata;
    };
  }
}

export type ISession = IStore<string, SessionTypes.Struct>;
