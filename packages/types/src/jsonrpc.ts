import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { SessionTypes } from "./session";

export declare namespace JsonRpc {
  export type WcMethod =
    | "wc_pairingDelete"
    | "wc_pairingPing"
    | "wc_sessionPropose"
    | "wc_sessionSettle"
    | "wc_sessionUpdateAccounts"
    | "wc_sessionUpdateMethods"
    | "wc_sessionUpdateEvents"
    | "wc_sessionUpdateExpiry"
    | "wc_sessionDelete"
    | "wc_sessionPing"
    | "wc_sessionRequest"
    | "wc_sessionEvent";

  export type DefaultResponse = { result: true } | { error: ErrorResponse };

  // -- wc_pairingDelete ------------------------------------- //
  export interface PairingDeleteRequestParams {
    code: number;
    message: string;
  }

  export type PairingDeleteResponse = DefaultResponse;

  // -- wc_pairingPing ---------------------------------------- //
  export type PairingPingRequestParams = {};

  export type PairingPingResponse = DefaultResponse;

  // -- wc_sessionPropose ------------------------------------- //
  export interface SessionProposeRequestParams {
    relays: RelayerTypes.ProtocolOptions[];
    chains: SessionTypes.Chains;
    methods: SessionTypes.Methods;
    events: SessionTypes.Events;
    proposer: {
      publicKey: string;
      metadata: ClientTypes.Metadata;
    };
  }

  export type SessionProposeResponse =
    | {
        relay: RelayerTypes.ProtocolOptions;
        responder: {
          publicKey: string;
        };
      }
    | { error: ErrorResponse };

  // -- wc_sessionSettle  -------------------------------------- //
  export interface SessionSettleRequestParams {
    relay: RelayerTypes.ProtocolOptions;
    accounts: SessionTypes.Accounts;
    methods: SessionTypes.Methods;
    events: SessionTypes.Events;
    expiry: number;
    controller: {
      publicKey: string;
      metadata: ClientTypes.Metadata;
    };
  }

  export type SessionSettleResponse = DefaultResponse;

  // -- wc_sessionUpdateAccounts  ------------------------------ //
  export interface SessionUpdateAccountsRequestParams {
    accounts: SessionTypes.Accounts;
  }

  export type SessionUpdateAccountsResponse = DefaultResponse;

  // -- wc_sessionUpdateMethods  --------------------------------- //
  export interface SessionUpdateMethodsRequestParams {
    methods: SessionTypes.Methods;
  }

  export type SessionUpdateMethodsResponse = DefaultResponse;

  // -- wc_sessionUpdateEvents ----------------------------------- //
  export interface SessionUpdateEventsRequestParams {
    events: SessionTypes.Events;
  }

  export type SessionUpdateEventsResponse = DefaultResponse;

  // -- wc_sessionUpdateExpiry ----------------------------------- //
  export interface SessionUpdateExpiryRequestParams {
    expiry: number;
  }

  export type SessionUpdateExpiryResponse = DefaultResponse;

  // -- wc_sessionDelete  ----------------------------------------- //
  export interface SessionDeleteRequestParams {
    code: number;
    reason: string;
  }

  export type SessionDeleteResponse = DefaultResponse;

  // -- wc_sessionPing  -------------------------------------------- //
  export type SessionPingRequestParams = {};

  export type SessionPingResponse = DefaultResponse;

  // -- wc_sessionRequest -------------------------------------------- //
  export interface SessionRequestParams {
    request: {
      method: string;
      params: unknown;
    };
    chainId: string;
  }

  export type SessionRequestResponse = DefaultResponse;

  // -- wc_sessionEvent  -------------------------------------------- //
  export interface SessionEventRequestParams {
    event: {
      name: string;
      data: unknown;
    };
    chainId: string;
  }

  export type SessionEventResponse = DefaultResponse;
}
