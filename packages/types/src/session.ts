import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { IStore } from "./store";

export declare namespace SessionTypes {
  type Methods = string[];

  type Chains = string[];

  type Events = string[];

  type Accounts = string[];

  interface Struct {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    expiry: number;
    acknowledged: boolean;
    controller: string;
    accounts: Accounts;
    methods: Methods;
    events: Events;
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

export interface ISession extends IStore<SessionTypes.Struct> {
  // TODO(ilja) need to handle this as concept of permissions was flattened
  find: (permissions) => SessionTypes.Struct[];
}
