import SignClient from "@walletconnect/sign-client";
import { SessionTypes } from "@walletconnect/types";
import { IEthereumProvider } from "eip1193-provider";

import {
  RpcProvidersMap,
  RpcProviderMap,
  RequestParams,
  RequestArguments,
  SessionNamespace,
  NamespaceConfig,
} from ".";

export interface ISubProvider {
  readonly namespace: SessionNamespace;
  readonly httpProviders: RpcProvidersMap;
  readonly client: SignClient;

  request: <T = unknown>(args: RequestParams) => Promise<T>;
  updateNamespace: (args: SessionTypes.Namespace) => void;
}

export interface IUniversalProvider extends IEthereumProvider {
  client?: SignClient;
  namespaces?: NamespaceConfig;
  rpcProviders: RpcProviderMap;
  session: any;

  request: <T = unknown>(args: RequestArguments, chain?: string) => Promise<T>;
  sendAsync: (
    args: RequestArguments,
    callback: (error: Error | null, response: any) => void,
    chain?: string,
  ) => void;
  pair: (pairingTopic: string | undefined) => Promise<SessionTypes.Struct>;
}