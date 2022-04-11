import { AppMetadata, JsonRpcPermissions, NotificationPermissions } from "./misc";
import { RelayerTypes } from "./relayer";

export declare namespace JsonRpc {
  // -- shared types --------------------------------- //
  export interface BaseRequest {
    id: string;
    jsonrpc: "2.0";
  }

  export interface BaseResponse extends BaseRequest {
    result: boolean;
  }

  // -- pairing delete ------------------------------------- //
  export interface PairingDeleteParams {
    code: number;
    reason: string;
  }

  export interface PairingDeleteRequest extends BaseRequest {
    method: "wc_pairingDelete";
    params: PairingDeleteParams;
  }

  // -- pairing ping ---------------------------------------- //
  export interface PairingPingRequest extends BaseRequest {
    method: "wc_pairingPing";
    params: {};
  }

  // -- session propose ------------------------------------- //
  export interface SessionProposeParams {
    relays: RelayerTypes.ProtocolOptions[];
    permissions: {
      jsonrpc: JsonRpcPermissions;
      notifications: NotificationPermissions;
    };
    expiry: number;
    blockchainProposed: {
      chains: string[];
      auth?: string;
    };
    proposer: {
      publicKey: string;
      metadata: AppMetadata;
    };
  }

  export interface SessionProposeRequest extends BaseRequest {
    method: "wc_sessionPropose";
    params: SessionProposeParams;
  }

  export interface SessionProposeResponse {
    relay: RelayerTypes.ProtocolOptions[];
    responder: {
      publicKey: string;
    };
  }

  // -- session settle  -------------------------------------- //
  export interface SessionSettleParams {
    relay: RelayerTypes.ProtocolOptions;
    blockchain: {
      chains: string[];
      accounts: string[];
    };
    permissions: Permissions;
    controller: {
      publicKey: string;
      metadata: AppMetadata;
    };
  }

  export interface SessionSettleRequest extends BaseRequest {
    method: "wc_sessionSettle";
    params: SessionSettleParams;
  }
}
