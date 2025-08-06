import { SignClientTypes } from "./client";
import { RelayerTypes } from "../core/relayer";
import { IStore } from "../core/store";
import { EngineTypes } from "./engine";

export declare namespace ProposalTypes {
  interface BaseRequiredNamespace {
    chains?: string[];
    methods: string[];
    events: string[];
  }

  type RequiredNamespace = BaseRequiredNamespace;

  type RequiredNamespaces = Record<string, RequiredNamespace>;
  type OptionalNamespaces = Record<string, RequiredNamespace>;
  type SessionProperties = Record<string, unknown>;
  type ScopedProperties = Record<string, unknown>;

  type BasePendingRequest = {
    method: string;
    paramsBlueprint?: {
      type: "array" | "object";
      items: {
        position: number;
        value: string;
        key: string;
        encoding: "hex" | "none" | "base58" | "base64";
      }[];
    };
  };

  type Hex = `0x${string}`;

  type PaymentOption = {
    asset: string;
    amount: Hex;
    recipient: string;
  };

  type PayRequest = {
    version: string;
    orderId?: string;
    acceptedPayments: PaymentOption[];
    expiry: number;
  };

  type PendingRequest =
    | (BasePendingRequest & {
        type: "authentication";
        chainIds: string[];
        data: { message: string };
      })
    | (BasePendingRequest & {
        type: "wallet_pay";
        data: PayRequest;
      });

  type PendingRequests = PendingRequest[];
  type PendingRequestsResults = EngineTypes.PendingRequestResult[];

  export interface Struct {
    id: number;
    /**
     * @deprecated in favor of expiryTimestamp
     */
    expiry?: number;
    expiryTimestamp: number;
    relays: RelayerTypes.ProtocolOptions[];
    proposer: {
      publicKey: string;
      metadata: SignClientTypes.Metadata;
    };
    requiredNamespaces: RequiredNamespaces;
    optionalNamespaces: OptionalNamespaces;
    sessionProperties?: SessionProperties;
    scopedProperties?: ScopedProperties;
    pairingTopic: string;
    // these two fields are for verifyContext
    attestation?: string;
    encryptedId?: string;
    pendingRequests?: PendingRequests;
  }
}

export type IProposal = IStore<number, ProposalTypes.Struct>;
