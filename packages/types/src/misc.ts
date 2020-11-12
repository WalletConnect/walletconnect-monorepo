import { EventEmitter } from "events";

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

export interface BlockchainPermissions {
  chainIds: string[];
}
export interface BlockchainState {
  accountIds: string[];
}

export interface UriParameters {
  protocol: string;
  version: number;
  topic: string;
  publicKey: string;
  relay: RelayTypes.ProtocolOptions;
}

export abstract class IEvents {
  public abstract events: EventEmitter;

  public abstract on(event: string, listener: any): void;
  public abstract once(event: string, listener: any): void;
  public abstract off(event: string, listener: any): void;
}
