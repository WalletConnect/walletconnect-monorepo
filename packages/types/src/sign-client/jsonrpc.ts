import { ErrorResponse, JsonRpcResult } from "@walletconnect/jsonrpc-types";
import { SignClientTypes } from "./client";
import { RelayerTypes } from "../core/relayer";
import { SessionTypes } from "./session";
import { ProposalTypes } from "./proposal";

export declare namespace JsonRpcTypes {
  // -- core ------------------------------------------------------- //
  export type DefaultResponse = true | ErrorResponse;

  export type WcMethod =
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
    wc_pairingPing: Record<string, unknown>;
    wc_sessionPropose: {
      relays: RelayerTypes.ProtocolOptions[];
      requiredNamespaces: ProposalTypes.RequiredNamespaces;
      optionalNamespaces: ProposalTypes.OptionalNamespaces;
      sessionProperties?: ProposalTypes.SessionProperties;
      proposer: {
        publicKey: string;
        metadata: SignClientTypes.Metadata;
      };
      expiryTimestamp?: number;
    };
    wc_sessionSettle: {
      relay: RelayerTypes.ProtocolOptions;
      namespaces: SessionTypes.Namespaces;
      sessionProperties?: ProposalTypes.SessionProperties;
      pairingTopic: string;
      expiry: number;
      controller: {
        publicKey: string;
        metadata: SignClientTypes.Metadata;
      };
    };
    wc_sessionUpdate: {
      namespaces: SessionTypes.Namespaces;
    };
    wc_sessionExtend: Record<string, unknown>;
    wc_sessionDelete: {
      code: number;
      message: string;
    };
    wc_sessionPing: Record<string, unknown>;
    wc_sessionRequest: {
      request: {
        method: string;
        params: any;
        expiryTimestamp?: number;
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
