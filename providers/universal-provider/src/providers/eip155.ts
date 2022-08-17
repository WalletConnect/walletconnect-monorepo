import Client from "@walletconnect/sign-client";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import { HttpConnection } from "@walletconnect/jsonrpc-http-connection";
import { EngineTypes, SessionTypes } from "@walletconnect/types";

import {
  IProvider,
  RpcProvidersMap,
  SubProviderOpts,
  RequestParams,
  SessionNamespace,
} from "../types";

import { getRpcUrl } from "../utils";

class Eip155Provider implements IProvider {
  public name = "eip155";
  public client: Client;
  // the active chainId on the dapp
  public chainId: number;
  public namespace: SessionNamespace;
  public httpProviders: RpcProvidersMap;

  constructor(opts: SubProviderOpts) {
    this.namespace = opts.namespace;
    this.client = opts.client;
    this.httpProviders = this.createHttpProviders();
    this.chainId = this.getDefaultChainId();
  }

  public async request<T = unknown>(args: RequestParams): Promise<T> {
    switch (args.request.method) {
      case "eth_requestAccounts":
        return this.getAccounts() as any;
      case "eth_accounts":
        return this.getAccounts() as any;
      case "eth_chainId":
        return this.getDefaultChainId() as any;
      default:
        break;
    }
    if (this.namespace.methods.includes(args.request.method)) {
      return this.client.request(args as EngineTypes.RequestParams);
    }
    return this.getHttpProvider().request(args.request);
  }

  public updateNamespace(namespace: SessionTypes.Namespace) {
    this.namespace = Object.assign(this.namespace, namespace);
  }

  // ---------- Private ----------------------------------------------- //

  private setHttpProvider(chainId: string): JsonRpcProvider | undefined {
    const rpcUrl = getRpcUrl(chainId, this.namespace);
    if (typeof rpcUrl === "undefined") return undefined;
    const http = new JsonRpcProvider(new HttpConnection(rpcUrl));
    return http;
  }

  private createHttpProviders(): RpcProvidersMap {
    const http = {};
    this.namespace.chains.forEach((chain) => {
      http[chain] = this.setHttpProvider(chain);
    });
    return http;
  }

  private getAccounts(): string[] {
    const accounts = this.namespace.accounts;
    if (!accounts) {
      return [];
    }

    return (
      accounts
        // get the accounts from the active chain
        .filter((account) => account.split(":")[1] == this.chainId.toString())
        // remove namespace & chainId from the string
        .map((account) => account.split(":")[2]) || []
    );
  }

  private getDefaultChainId(): number {
    if (this.chainId) return this.chainId;
    const chainId = this.namespace.chains[0];

    if (!chainId) throw new Error(`ChainId not found`);

    return parseInt(chainId.split(":")[1]);
  }

  private getHttpProvider(): JsonRpcProvider {
    const chain = `${this.name}:${this.chainId}`;
    const http = this.httpProviders[chain];
    if (typeof http === "undefined") {
      throw new Error(`JSON-RPC provider for ${chain} not found`);
    }
    return http;
  }
}

export default Eip155Provider;
