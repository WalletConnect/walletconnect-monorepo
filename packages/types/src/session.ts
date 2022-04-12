import { IStore } from "./store";

export declare namespace SessionTypes {
  interface Data {
    topic: string;
    methods: Methods;
    chains: Chains;
    events: Events;
  }

  type Methods = string[];

  type Chains = string[];

  type Events = string[];

  type Accounts = string[];
}

export interface ISession extends IStore<SessionTypes.Data> {
  find: (permissions) => SessionTypes.Data[];
}
