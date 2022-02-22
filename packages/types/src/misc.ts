import { ErrorResponse, JsonRpcRequest } from "@walletconnect/jsonrpc-types";

import { RelayerTypes } from "./relayer";

export { Logger } from "pino";

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
  symKey: string;
  relay: RelayerTypes.ProtocolOptions;
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

export interface Topic {
  topic: string;
}

export interface RequestEvent {
  topic: string;
  request: JsonRpcRequest;
  chainId?: string;
}
