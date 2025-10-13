import SignClient from "@walletconnect/sign-client";
import { SignClientTypes, ProposalTypes, AuthTypes, SessionTypes } from "@walletconnect/types";
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
