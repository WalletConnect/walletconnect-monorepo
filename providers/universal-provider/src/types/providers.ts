import SignClient from "@walletconnect/sign-client";
import { SessionTypes } from "@walletconnect/types";
import { JsonRpcResult } from "@walletconnect/jsonrpc-types";

import {
  RpcProvidersMap,
  RpcProviderMap,
  RequestParams,
  RequestArguments,
  SessionNamespace,
  NamespaceConfig,
  ConnectParams,
  IEthereumProvider,
} from "./misc.js";

export interface IProvider {
  readonly namespace: SessionNamespace;
  readonly httpProviders: RpcProvidersMap;
  readonly client: SignClient;

  request: <T = unknown>(args: RequestParams) => Promise<T>;
  updateNamespace: (args: SessionTypes.Namespace) => void;
  setDefaultChain: (chainId: string, rpcUrl?: string | undefined) => void;
  getDefaultChain: () => string;
  requestAccounts: () => string[];
}

export interface IUniversalProvider extends IEthereumProvider {
  client?: SignClient;
  namespaces?: NamespaceConfig;
  rpcProviders: RpcProviderMap;
  session?: SessionTypes.Struct;
  uri: string | undefined;

  request: <T = unknown>(args: RequestArguments, chain?: string) => Promise<T>;
  sendAsync: (
    args: RequestArguments,
    callback: (error: Error | null, response: JsonRpcResult) => void,
    chain?: string,
  ) => void;
  pair: (pairingTopic: string | undefined) => Promise<SessionTypes.Struct>;
  connect: (opts: ConnectParams) => Promise<SessionTypes.Struct | undefined>;
  disconnect: () => Promise<void>;
  cleanupPendingPairings: () => Promise<void>;
  abortPairingAttempt(): void;
  setDefaultChain: (chainId: string, rpcUrl?: string | undefined) => void;
}
