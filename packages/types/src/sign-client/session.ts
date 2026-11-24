import { RelayerTypes } from "../core/relayer.js";
import { IStore } from "../core/store.js";
import { Verify } from "../core/verify.js";
import { SignClientTypes } from "./client.js";
import { ProposalTypes } from "./proposal.js";
import { AuthTypes } from "./auth.js";
import { EngineTypes } from "./engine.js";
export declare namespace SessionTypes {
  type Expiry = number;

  /**
   * A session peer's metadata. This type is shared by both sides: on the wallet side the dApp's
   * self-asserted identity (`name`, `url`, `icons`) is never kept, and those fields are empty.
   * A follow-up will split the wallet's session type.
   */
  interface PeerMetadata extends SignClientTypes.Metadata {
    /**
     * @deprecated For wallets: always empty. Wallets must use the session's `verification`, never
     * the dApp's own name. dApps still get the wallet's name here.
     */
    name: string;
    /**
     * @deprecated For wallets: always empty. Wallets must use `verification.domain`. dApps still
     * get the wallet's URL here.
     */
    url: string;
    /**
     * @deprecated For wallets: always empty. Wallets must use `verification.icon`. dApps still get
     * the wallet's icons here.
     */
    icons: string[];
  }

  interface BaseNamespace {
    chains?: string[];
    accounts: string[];
    methods: string[];
    events: string[];
  }

  type Namespace = BaseNamespace;

  type Namespaces = Record<string, Namespace>;

  type SessionProperties = ProposalTypes.SessionProperties;
  type ScopedProperties = ProposalTypes.ScopedProperties;

  interface SessionConfig {
    disableDeepLink?: boolean;
  }

  interface Struct {
    topic: string;
    pairingTopic: string;
    relay: RelayerTypes.ProtocolOptions;
    expiry: Expiry;
    acknowledged: boolean;
    controller: string;
    namespaces: Namespaces;
    requiredNamespaces: ProposalTypes.RequiredNamespaces;
    optionalNamespaces: ProposalTypes.OptionalNamespaces;
    sessionProperties?: SessionProperties;
    scopedProperties?: ScopedProperties;
    sessionConfig?: SessionConfig;
    self: {
      publicKey: string;
      metadata: SignClientTypes.Metadata;
    };
    peer: {
      publicKey: string;
      /**
       * dApp side: the wallet's metadata. Wallet side: the dApp's `description`, `redirect` and
       * `verifyUrl` only; its `name`, `url` and `icons` are empty. Wallets must use
       * `verification`.
       */
      metadata: PeerMetadata;
    };
    authentication?: AuthTypes.Cacao[];
    /**
     * Wallet side: who the dApp is, from the proposal's App Verification. On the wallet side,
     * `peer.metadata` keeps only `description`, `redirect` and `verifyUrl`: its `name`, `url` and
     * `icons` are empty.
     */
    verification?: Verify.AppVerification;
    walletPayResult?: EngineTypes.WalletPayResult[];
    transportType?: RelayerTypes.TransportType;
  }
}

export type ISession = IStore<string, SessionTypes.Struct>;
