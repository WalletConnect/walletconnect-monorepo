import HttpConnection from "@walletconnect/jsonrpc-http-connection";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import Client from "@walletconnect/sign-client";
import { EngineTypes, SessionTypes } from "@walletconnect/types";
import EventEmitter from "events";
import { GENERIC_SUBPROVIDER_NAME, PROVIDER_EVENTS } from "../constants/index.js";
import {
  IProvider,
  RequestParams,
  RpcProvidersMap,
  SessionNamespace,
  SubProviderOpts,
} from "../types/index.js";
import { getGlobal, getRpcUrl } from "../utils/index.js";
import { parseChainId } from "@walletconnect/utils";

class GenericProvider implements IProvider {
  public name = GENERIC_SUBPROVIDER_NAME;
  public client: Client;
  public httpProviders: RpcProvidersMap;
  public events: EventEmitter;
  public namespace: SessionNamespace;
  public chainId: string;

  constructor(opts: SubProviderOpts) {
    this.namespace = opts.namespace;
    this.events = getGlobal("events");
    this.client = getGlobal("client");
    this.chainId = this.getDefaultChain();
    this.name = this.getNamespaceName();
    this.httpProviders = this.createHttpProviders();
  }

  public updateNamespace(namespace: SessionTypes.Namespace) {
    this.namespace.chains = [
      ...new Set((this.namespace.chains || []).concat(namespace.chains || [])),
    ];
    this.namespace.accounts = [
      ...new Set((this.namespace.accounts || []).concat(namespace.accounts || [])),
    ];
    this.namespace.methods = [
      ...new Set((this.namespace.methods || []).concat(namespace.methods || [])),
    ];
    this.namespace.events = [
      ...new Set((this.namespace.events || []).concat(namespace.events || [])),
    ];
    this.httpProviders = this.createHttpProviders();
  }

  public requestAccounts(): string[] {
    return this.getAccounts();
  }

  public request<T = unknown>(args: RequestParams): Promise<T> {
    if (this.namespace.methods.includes(args.request.method)) {
      return this.client.request(args as EngineTypes.RequestParams);
    }
    return this.getHttpProvider(args.chainId).request(args.request);
  }

  public setDefaultChain(chainId: string, rpcUrl?: string | undefined) {
    // http provider exists so just set the chainId
    if (!this.httpProviders[chainId]) {
      this.setHttpProvider(chainId, rpcUrl);
    }
    const previous = this.chainId;
    this.chainId = chainId;
    this.events.emit(PROVIDER_EVENTS.DEFAULT_CHAIN_CHANGED, {
      currentCaipChainId: `${this.name}:${chainId}`,
      previousCaipChainId: `${this.name}:${previous}`,
    });
  }

  public getDefaultChain(): string {
    if (this.chainId) return this.chainId;
    if (this.namespace.defaultChain) return this.namespace.defaultChain;

    const chainId = this.namespace.chains[0];
    if (!chainId) throw new Error(`ChainId not found`);

    return chainId.split(":")[1];
  }

  public getNamespaceName(): string {
    const chainId = this.namespace.chains[0];
    if (!chainId) throw new Error(`ChainId not found`);

    return parseChainId(chainId).namespace;
  }

  // --------- PRIVATE --------- //

  private getAccounts(): string[] {
    const accounts = this.namespace.accounts;
    if (!accounts) {
      return [];
    }

    return [
      ...new Set(
        accounts
          // get the accounts from the active chain
          .filter((account) => account.split(":")[1] === this.chainId.toString())
          // remove namespace & chainId from the string
          .map((account) => account.split(":")[2]),
      ),
    ];
  }

  private createHttpProviders(): RpcProvidersMap {
    const http = {};
    this.namespace?.accounts?.forEach((account) => {
      const chain = parseChainId(account);
      const customRpcUrl = this.namespace?.rpcMap?.[`${chain.namespace}:${chain.reference}`];
      http[chain.reference] = this.createHttpProvider(account, customRpcUrl);
    });
    return http;
  }

  private getHttpProvider(chain: string): JsonRpcProvider {
    const chainReference = parseChainId(chain).reference;
    const http = this.httpProviders[chainReference];
    if (typeof http === "undefined") {
      throw new Error(`JSON-RPC provider for ${chain} not found`);
    }
    return http;
  }

  private setHttpProvider(chainId: string, rpcUrl?: string): void {
    const http = this.createHttpProvider(chainId, rpcUrl);
    if (http) {
      this.httpProviders[chainId] = http;
    }
  }

  private createHttpProvider(chainId: string, rpcUrl?: string): JsonRpcProvider | undefined {
    const rpc = rpcUrl || getRpcUrl(chainId, this.namespace, this.client.core.projectId);
    if (!rpc) {
      throw new Error(`No RPC url provided for chainId: ${chainId}`);
    }
    const http = new JsonRpcProvider(new HttpConnection(rpc, getGlobal("disableProviderPing")));
    return http;
  }
}

export default GenericProvider;
