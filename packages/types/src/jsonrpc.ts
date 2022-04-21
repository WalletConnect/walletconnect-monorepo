import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { SessionTypes } from "./session";

export declare namespace JsonRpcTypes {
  // -- core ------------------------------------------------------- //
  export type DefaultResponse = true | ErrorResponse;

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

  // -- requests --------------------------------------------------- //

  export interface RequestParams {
    wc_pairingDelete: {
      code: number;
      message: string;
    };
    wc_pairingPing: {};
    wc_sessionPropose: {
      relays: RelayerTypes.ProtocolOptions[];
      chains: SessionTypes.Chains;
      methods: SessionTypes.Methods;
      events: SessionTypes.Events;
      proposer: {
        publicKey: string;
        metadata: ClientTypes.Metadata;
      };
    };
    wc_sessionSettle: {
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
    wc_sessionUpdateAccounts: {
      accounts: SessionTypes.Accounts;
    };
    wc_sessionUpdateMethods: {
      methods: SessionTypes.Methods;
    };
    wc_sessionUpdateEvents: {
      events: SessionTypes.Events;
    };
    wc_sessionUpdateExpiry: {
      expiry: number;
    };
    wc_sessionDelete: {
      code: number;
      message: string;
    };
    wc_sessionPing: {};
    wc_sessionRequest: {
      request: {
        method: string;
        params: unknown;
      };
      chainId?: string;
    };
    wc_sessionEvent: {
      event: {
        name: string;
        data: unknown;
      };
      chainId?: string;
    };
  }

  // -- responses -------------------------------------------------- //
  export interface Results {
    wc_pairingDelete: true;
    wc_pairingPing: true;
    wc_sessionPropose: {
      relay: RelayerTypes.ProtocolOptions;
      responderPublicKey: string;
    };
    wc_sessionSettle: true;
    wc_sessionUpdateAccounts: true;
    wc_sessionUpdateMethods: true;
    wc_sessionUpdateEvents: true;
    wc_sessionUpdateExpiry: true;
    wc_sessionDelete: true;
    wc_sessionPing: true;
    wc_sessionRequest: true;
    wc_sessionEvent: true;
  }

  export type Error = ErrorResponse;
}
