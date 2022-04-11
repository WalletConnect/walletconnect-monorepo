import { AppMetadata } from "./misc";
import { RelayerTypes } from "./relayer";

export declare namespace JsonRpc {
  // -- shared types --------------------------------- //
  export interface BaseRequest {
    id: string;
    jsonrpc: "2.0";
  }

  export interface DefaultSuccessResponse {
    result: true;
  }

  export interface DefaultFailureResponse {
    code: number;
    message: string;
  }

  export type DefaultResponse = DefaultSuccessResponse | DefaultFailureResponse;

  // -- pairing delete ------------------------------------- //
  export interface PairingDeleteRequest extends BaseRequest {
    method: "wc_pairingDelete";
    params: {
      code: number;
      reason: string;
    };
  }

  export type PairingDeleteResponse = DefaultResponse;

  // -- pairing ping ---------------------------------------- //
  export interface PairingPingRequest extends BaseRequest {
    method: "wc_pairingPing";
    params: {};
  }

  export type PairingPingResponse = DefaultResponse;

  // -- session propose ------------------------------------- //
  export interface SessionProposeRequest extends BaseRequest {
    method: "wc_sessionPropose";
    params: {
      relays: RelayerTypes.ProtocolOptions[];
      expiry: number;
      chains: string[];
      methods: string[];
      events: string[];
      proposer: {
        publicKey: string;
        metadata: AppMetadata;
      };
    };
  }

  export type SessionProposeResponse =
    | {
        relay: RelayerTypes.ProtocolOptions;
        responder: {
          publicKey: string;
        };
      }
    | DefaultFailureResponse;

  // -- session settle  -------------------------------------- //
  export interface SessionSettleRequest extends BaseRequest {
    method: "wc_sessionSettle";
    params: {
      relay: RelayerTypes.ProtocolOptions;
      accounts: string[];
      methods: string[];
      events: string[];
      expiry: number;
      controller: {
        publicKey: string;
        metadata: AppMetadata;
      };
    };
  }

  export type SessionSettleResponse = DefaultResponse;

  // -- session update accounts  ------------------------------ //
  export interface SessionUpdateAccountsRequest extends BaseRequest {
    method: "wc_sessionUpdateAccounts";
    params: {
      accounts: string[];
    };
  }

  export type SessionUpdateAccountsResponse = DefaultResponse;

  // -- session update methods  --------------------------------- //
  export interface SessionUpdateMethodsRequest extends BaseRequest {
    method: "wc_sessionUpdateMethods";
    params: {
      methods: string[];
    };
  }

  export type SessionUpdateMethodsResponse = DefaultResponse;

  // -- session update events ----------------------------------- //
  export interface SessionUpdateEventsRequest extends BaseRequest {
    method: "wc_sessionUpdateEvents";
    params: {
      events: string[];
    };
  }

  export type SessionUpdateEventsResponse = DefaultResponse;

  // -- session update expiry ----------------------------------- //
  export interface SessionUpdateExpiryRequest extends BaseRequest {
    method: "wc_sessionUpdateExpiry";
    params: {
      expiry: number;
    };
  }

  export type SessionUpdateExpiryResponse = DefaultResponse;

  // -- session delete  ----------------------------------------- //
  export interface SessionDeleteRequest extends BaseRequest {
    method: "wc_sessionDelete";
    params: {
      code: number;
      reason: string;
    };
  }

  export type SessionDeleteResponse = DefaultResponse;

  // -- session ping  -------------------------------------------- //
  export interface SessionPingRequest extends BaseRequest {
    method: "wc_sessionPing";
    params: {};
  }

  export type SessionPingResponse = DefaultResponse;

  // -- session request -------------------------------------------- //
  export interface SessionRequestRequest extends BaseRequest {
    method: "wc_sessionRequest";
    params: {
      method: string;
      params: unknown;
      chainId: string;
    };
  }

  export type SessionRequestResponse = DefaultResponse;

  // -- session event  -------------------------------------------- //
  export interface SessionEventRequest extends BaseRequest {
    method: "wc_sessionEvent";
    params: {
      name: string;
      data: unknown;
      chainId: string;
    };
  }

  export type SessionEventResponse = DefaultResponse;
}
