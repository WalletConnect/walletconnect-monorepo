import SignClient from "@walletconnect/sign-client";
import { SignClientTypes, ProposalTypes } from "@walletconnect/types";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import { IProvider } from "./providers";

export interface UniversalProviderOpts {
  projectId?: string;
  metadata?: SignClientTypes.Metadata;
  logger?: string;
  client?: SignClient;
  relayUrl?: string;
}

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
}

export interface NamespaceConfig {
  [namespace: string]: Namespace;
}

export interface SessionNamespace extends Namespace {
  accounts?: string[];
}

export interface ConnectParams {
  namespaces: NamespaceConfig;
  pairingTopic?: string;
  skipPairing?: boolean;
}

export interface SubProviderOpts {
  client: SignClient;
  namespace: Namespace;
}

export interface RequestParams {
  topic: string;
  request: RequestArguments;
  chainId: string;
}

export interface RequestArguments {
  method: string;
  params?: any[] | undefined;
}
