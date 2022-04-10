import { AppMetadata } from "./misc";
import { RelayerTypes } from "./relayer";

export declare namespace JsonRpc {
  // -- shared types --------------------------------------------- //
  export interface BaseRequest {
    id: string;
    jsonrpc: "2.0";
  }

  export interface JsonrpcPermissions {
    methods: string[];
  }

  export interface NotificationsPermissions {
    types: string[];
  }

  export interface Permissions {
    jsonrpc: JsonrpcPermissions;
    notifications: NotificationsPermissions;
  }

  // -- client.createSession ------------------------------------- //
  export interface CreateSessionParams {
    relays: RelayerTypes.ProtocolOptions[];
    permissions: JsonRpc.Permissions;
    ttl: number;
    blockchainProposed: {
      chains: string[];
      auth?: string;
    };
    proposer: {
      publicKey: string;
      metadata: AppMetadata;
    };
  }

  export interface CreateSessionRequest extends JsonRpc.BaseRequest {
    method: "wc_sessionPropose";
    params: CreateSessionParams;
  }

  export interface CreateSessionResponse {
    relay: RelayerTypes.ProtocolOptions[];
    responder: {
      publicKey: string;
    };
  }
}
