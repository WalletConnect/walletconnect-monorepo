import { ErrorResponse, JsonRpcRequest } from "@walletconnect/jsonrpc-types";

import { RelayerTypes } from "./relayer";

export declare namespace SignalTypes {
  export type Method = MethodPairing | MethodUri;

  export type Params = ParamsPairing | ParamsUri;

  export interface Base {
    method: Method;
    params: Params;
  }

  export type MethodPairing = "pairing";

  export interface ParamsPairing {
    topic: string;
  }

  export interface Pairing extends Base {
    method: MethodPairing;
    params: ParamsPairing;
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

export interface NotificationPermissions {
  types: string[];
}

export declare namespace BlockchainTypes {
  export interface Permissions {
    chains: string[];
  }
  export interface State {
    accounts: string[];
  }
}

export interface UriParameters {
  protocol: string;
  version: number;
  topic: string;
  publicKey: string;
  relay: RelayerTypes.ProtocolOptions;
  controller: boolean;
}

export interface AppMetadata {
  name: string;
  description: string;
  url: string;
  icons: string[];
}

export interface RelayClientMetadata {
  protocol: string;
  version: number;
  env: string;
  host?: string;
}

export declare namespace Validation {
  export interface Valid {
    valid: true;
  }

  export interface Invalid {
    valid: false;
    error: ErrorResponse;
  }

  export type Result = Valid | Invalid;
}

export type Reason = ErrorResponse;

export interface RequestEvent {
  topic: string;
  request: JsonRpcRequest;
  chainId?: string;
}
