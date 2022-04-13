import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { IStore } from "./store";

export declare namespace SessionTypes {
  type Chains = string[];

  type Methods = string[];

  type Events = string[];

  type Accounts = string[];

  type Expiry = number;

  interface Struct {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    expiry: Expiry;
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

  interface Updatable {
    accounts?: Accounts;
    methods?: Methods;
    events?: Events;
    expiry?: Expiry;
  }
  interface Filters extends Updatable {
    chains?: Chains;
  }
}

export interface ISession extends IStore<SessionTypes.Struct> {
  find: (filters: SessionTypes.Filters) => SessionTypes.Struct[];
}
