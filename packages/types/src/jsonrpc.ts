import { ErrorResponse, JsonRpcResult } from "@walletconnect/jsonrpc-types";
import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { SessionTypes } from "./session";
import { ProposalTypes } from "./proposal";

export declare namespace JsonRpcTypes {
  // -- core ------------------------------------------------------- //
  export type DefaultResponse = true | ErrorResponse;

  export type WcMethod =
    | "wc_pairingDelete"
    | "wc_pairingPing"
    | "wc_sessionPropose"
    | "wc_sessionSettle"
    | "wc_sessionUpdate"
    | "wc_sessionExtend"
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
      proposedNamespaces: ProposalTypes.ProposedNamespace[];
      proposer: {
        publicKey: string;
        metadata: ClientTypes.Metadata;
      };
    };
    wc_sessionSettle: {
      relay: RelayerTypes.ProtocolOptions;
      namespaces: SessionTypes.Namespace[];
      expiry: number;
      controller: {
        publicKey: string;
        metadata: ClientTypes.Metadata;
      };
    };
    wc_sessionUpdate: {
      namespaces: SessionTypes.Namespace[];
    };
    wc_sessionExtend: {};
    wc_sessionDelete: {
      code: number;
      message: string;
    };
    wc_sessionPing: {};
    wc_sessionRequest: {
      request: {
        method: string;
        params: any;
      };
      chainId: string;
    };
    wc_sessionEvent: {
      event: {
        name: string;
        data: unknown;
      };
      chainId: string;
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
    wc_sessionUpdate: true;
    wc_sessionExtend: true;
    wc_sessionDelete: true;
    wc_sessionPing: true;
    wc_sessionRequest: JsonRpcResult;
    wc_sessionEvent: true;
  }

  export type Error = ErrorResponse;
}
