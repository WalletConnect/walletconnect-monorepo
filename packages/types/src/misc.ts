import { CryptoTypes } from "./crypto";
import { RelayTypes } from "./relay";

export declare namespace SignalTypes {
  export type Method = MethodConnection | MethodUri;

  export type Params = ParamsConnection | ParamsUri;

  export interface Base {
    method: Method;
    params: Params;
  }

  export type MethodConnection = "connection";

  export interface ParamsConnection {
    topic: string;
  }

  export interface Connection extends Base {
    method: MethodConnection;
    params: ParamsConnection;
  }

  export type MethodUri = "uri";

  export interface ParamsUri {
    uri: string;
  }

  export interface Uri extends Base {
    method: MethodUri;
    params: ParamsUri;
  }
}

export interface JsonRpcPermissions {
  methods: string[];
}

export declare namespace NotificationPermissions {
  export interface Proposal {
    types: string[];
  }

  export interface Settled {
    types: string[];
    controller: CryptoTypes.Participant;
  }
}

export declare namespace BlockchainTypes {
  export interface Permissions {
    chainIds: string[];
  }
  export interface State {
    accountIds: string[];
  }
}

export interface UriParameters {
  protocol: string;
  version: number;
  topic: string;
  publicKey: string;
  relay: RelayTypes.ProtocolOptions;
}
