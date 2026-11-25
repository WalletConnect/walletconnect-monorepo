import { AuthTypes } from "./auth.js";
import { EngineTypes } from "./engine.js";
import { SignClientTypes } from "./client.js";
import { RelayerTypes } from "../core/relayer.js";
import { IStore } from "../core/store.js";
import { Verify } from "../core/verify.js";

export declare namespace ProposalTypes {
  interface BaseRequiredNamespace {
    chains?: string[];
    methods: string[];
    events: string[];
  }

  type RequiredNamespace = BaseRequiredNamespace;

  type RequiredNamespaces = Record<string, RequiredNamespace>;
  type OptionalNamespaces = Record<string, RequiredNamespace>;
  type SessionProperties = Record<string, string>;
  type ScopedProperties = Record<string, unknown>;

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
    // these two fields are for the legacy attestation
    attestation?: string;
    encryptedId?: string;
    /** Wallet side: the proposal's App Verification. */
    verification?: Verify.AppVerification;
    /**
     * Wallet side: the proposal's App Signature `iss`, when it was signed. The session is pinned to
     * it from the start: see `SessionTypes.Struct.appDomain`.
     */
    appDomain?: string;
    requests?: {
      authentication?: AuthTypes.AuthenticateParams[];
      walletPay?: EngineTypes.WalletPayParams;
    };
  }
}

export declare namespace ProposalTypes {
  /** A proposal as a wallet sees it: without the app's self-asserted identity. */
  export type WalletStruct = Omit<
    Struct,
    "proposer" | "attestation" | "encryptedId" | "appDomain"
  > & {
    proposer: { publicKey: string; metadata: SignClientTypes.PeerMetadata };
  };
}

export type IProposal = IStore<number, ProposalTypes.Struct>;
