import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { SessionTypes } from "./session";

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
      message: string;
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
      chains: SessionTypes.Chains;
      methods: SessionTypes.Methods;
      events: SessionTypes.Events;
      proposer: {
        publicKey: string;
        metadata: ClientTypes.Metadata;
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
      accounts: SessionTypes.Accounts;
      methods: SessionTypes.Methods;
      events: SessionTypes.Events;
      expiry: number;
      controller: {
        publicKey: string;
        metadata: ClientTypes.Metadata;
      };
    };
  }

  export type SessionSettleResponse = DefaultResponse;

  // -- session update accounts  ------------------------------ //
  export interface SessionUpdateAccountsRequest extends BaseRequest {
    method: "wc_sessionUpdateAccounts";
    params: {
      accounts: SessionTypes.Accounts;
    };
  }

  export type SessionUpdateAccountsResponse = DefaultResponse;

  // -- session update methods  --------------------------------- //
  export interface SessionUpdateMethodsRequest extends BaseRequest {
    method: "wc_sessionUpdateMethods";
    params: {
      methods: SessionTypes.Methods;
    };
  }

  export type SessionUpdateMethodsResponse = DefaultResponse;

  // -- session update events ----------------------------------- //
  export interface SessionUpdateEventsRequest extends BaseRequest {
    method: "wc_sessionUpdateEvents";
    params: {
      events: SessionTypes.Events;
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
  export interface SessionRequest extends BaseRequest {
    method: "wc_sessionRequest";
    params: {
      request: {
        method: string;
        params: unknown;
      };
      chainId: string;
    };
  }

  export type SessionRequestResponse = DefaultResponse;

  // -- session event  -------------------------------------------- //
  export interface SessionEventRequest extends BaseRequest {
    method: "wc_sessionEvent";
    params: {
      event: {
        name: string;
        data: unknown;
      };
      chainId: string;
    };
  }

  export type SessionEventResponse = DefaultResponse;
}
