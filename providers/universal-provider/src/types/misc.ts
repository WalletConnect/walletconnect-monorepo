import SignClient from "@walletconnect/sign-client";
import {
  SignClientTypes,
  ProposalTypes,
  AuthTypes,
  SessionTypes,
  EngineTypes,
} from "@walletconnect/types";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import { KeyValueStorageOptions, IKeyValueStorage } from "@walletconnect/keyvaluestorage";
import { IEvents } from "@walletconnect/events";
import { Logger } from "@walletconnect/logger";
import { IProvider } from "./providers.js";

/**
 * @param session - The session to use. If not provided, the provider will create a new session.
 */
export interface UniversalProviderOpts extends SignClientTypes.Options {
  projectId?: string;
  metadata?: Metadata;
  logger?: string | Logger;
  client?: SignClient;
  relayUrl?: string;
  storageOptions?: KeyValueStorageOptions;
  storage?: IKeyValueStorage;
  name?: string;
  disableProviderPing?: boolean;
  session?: SessionTypes.Struct;
  /** Base URL of the wallet fee API, without a trailing slash. Defaults to `https://api.walletconnect.com` */
  walletFeeApiUrl?: string;
}

export type Metadata = SignClientTypes.Metadata;

export interface RpcProvidersMap {
  [provider: string]: JsonRpcProvider;
}

export interface EthereumRpcMap {
  [chainId: string]: string;
}

export interface NamespacesMap {
  [chainId: string]: Namespace;
}

export interface RpcProviderMap {
  [chainId: string]: IProvider;
}

export interface Namespace extends ProposalTypes.BaseRequiredNamespace {
  chains: string[];
  rpcMap?: EthereumRpcMap;
  defaultChain?: string;
}

export interface NamespaceConfig {
  [namespace: string]: Namespace;
}

export interface SessionNamespace extends Namespace {
  accounts?: string[];
}

export interface ConnectParams {
  /**
   * @deprecated Use `optionalNamespaces` instead.
   */
  namespaces?: NamespaceConfig;
  optionalNamespaces?: NamespaceConfig;
  sessionProperties?: SessionTypes.SessionProperties;
  scopedProperties?: SessionTypes.ScopedProperties;
  pairingTopic?: string;
  skipPairing?: boolean;
  authentication?: AuthTypes.AuthenticateRequestParams[];
  walletPay?: EngineTypes.WalletPayParams;
}

export type AuthenticateParams = AuthTypes.SessionAuthenticateParams;

export interface SubProviderOpts {
  namespace: Namespace;
}

export interface RequestParams {
  topic: string;
  request: RequestArguments;
  chainId: string;
  id?: number;
  expiry?: number;
}

export interface RequestArguments {
  method: string;
  params?: unknown[] | Record<string, unknown> | object | undefined;
}
export interface PairingsCleanupOpts {
  deletePairings?: boolean;
}
export interface ProviderRpcError extends Error {
  message: string;
  code: number;
  data?: unknown;
}

export interface ProviderMessage {
  type: string;
  data: unknown;
}

export interface ProviderInfo {
  chainId: string;
}

export type ProviderChainId = string;

export type ProviderAccounts = string[];

export interface EIP1102Request extends RequestArguments {
  method: "eth_requestAccounts";
}

export interface EIP1193Provider extends IEvents {
  // connection event
  on(event: "connect", listener: (info: ProviderInfo) => void): void;
  // disconnection event
  on(event: "disconnect", listener: (error: ProviderRpcError) => void): void;
  // arbitrary messages
  on(event: "message", listener: (message: ProviderMessage) => void): void;
  // chain changed event
  on(event: "chainChanged", listener: (chainId: ProviderChainId) => void): void;
  // accounts changed event
  on(event: "accountsChanged", listener: (accounts: ProviderAccounts) => void): void;
  // make an Ethereum RPC method call.
  request(args: RequestArguments): Promise<unknown>;
}

export interface IEthereumProvider extends EIP1193Provider {
  // legacy alias for EIP-1102
  enable(): Promise<ProviderAccounts>;
}

type Capability = {
  [key: string]: unknown;
  optional?: boolean;
};

export interface SendCallsParams {
  version: string;
  id?: string;
  from?: `0x${string}`;
  chainId: `0x${string}`;
  atomicRequired: boolean;
  calls: {
    to?: `0x${string}`;
    data?: `0x${string}`;
    value?: `0x${string}`;
    capabilities?: Record<string, Capability>;
  }[];
  capabilities?: Record<string, Capability>;
}
export interface SendCallsResult {
  id: string;
  capabilities: {
    caip345: {
      caip2: string;
      transactionHashes: string[];
    };
  };
}
export interface StoreSendCallsParams {
  request: SendCallsParams;
  result: SendCallsResult;
}

export type StoredSendCalls = StoreSendCallsParams & {
  expiry: number;
};

export type DefaultChainChanged = {
  currentCaipChainId: string;
  previousCaipChainId: string;
};

export type OnChainChanged = {
  currentCaipChainId: string;
  previousCaipChainId?: string;
  internal?: boolean;
};

export type EmitAccountsChangedOnChainChange = {
  namespace: string;
  currentCaipChainId: string;
  previousCaipChainId?: string;
};

/**
 * Message a dApp posts to the host to hand over a pairing URI.
 */
export type WalletConnectHostMessage = {
  type: "wc_session_offer";
  uri: string;
};

/**
 * Bridge a host, such as a wallet's in-app browser, injects before the page loads.
 */
export interface WalletConnectHost {
  /** Set to `true` by the host only when it opened the app, e.g. from a wallet's Explore section. */
  autoConnect?: boolean;
  postMessage?: (message: WalletConnectHostMessage) => void;
}

declare global {
  interface Window {
    walletConnectHost?: WalletConnectHost;
  }
}

/**
 * The wallet's fee config for the active chain, as returned by `getWalletFee()`.
 */
export type WalletFee = {
  /** CAIP-2 ID of the active chain, e.g. `eip155:11155111` */
  chainId: string;
  /** Fee in basis points, already capped by the API */
  feeBps?: number;
  /** Fee recipient address on the active chain */
  recipient?: string;
  referralCode?: string;
};

/**
 * Response of `GET /wallet-fee/v1/config`.
 */
export type WalletFeeConfig = {
  feeBps?: number;
  /** CAIP-10 accounts, one per chain */
  recipients: string[];
  referralCode?: string;
};
