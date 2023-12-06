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

import { getChainId, getGlobal, getRpcUrl } from "../utils";
import EventEmitter from "events";
import { PROVIDER_EVENTS } from "../constants";

class Eip155Provider implements IProvider {
  public name = "eip155";
  public client: Client;
  // the active chainId on the dapp
  public chainId: number;
  public namespace: SessionNamespace;
  public httpProviders: RpcProvidersMap;
  public events: EventEmitter;

  constructor(opts: SubProviderOpts) {
    this.namespace = opts.namespace;
    this.events = getGlobal("events");
    this.client = getGlobal("client");
    this.httpProviders = this.createHttpProviders();
    this.chainId = parseInt(this.getDefaultChain());
  }

  public async request<T = unknown>(args: RequestParams): Promise<T> {
    switch (args.request.method) {
      case "eth_requestAccounts":
        return this.getAccounts() as any;
      case "eth_accounts":
        return this.getAccounts() as any;
      case "wallet_switchEthereumChain": {
        return await this.handleSwitchChain(args);
      }
      case "eth_chainId":
        return parseInt(this.getDefaultChain()) as any;
      default:
        break;
    }
    if (this.namespace.methods.includes(args.request.method)) {
      return await this.client.request(args as EngineTypes.RequestParams);
    }
    return this.getHttpProvider().request(args.request);
  }

  public updateNamespace(namespace: SessionTypes.Namespace) {
    this.namespace = Object.assign(this.namespace, namespace);
  }

  public setDefaultChain(chainId: string, rpcUrl?: string | undefined) {
    // http provider exists so just set the chainId
    if (!this.httpProviders[chainId]) {
      this.setHttpProvider(parseInt(chainId), rpcUrl);
    }
    this.chainId = parseInt(chainId);
    this.events.emit(PROVIDER_EVENTS.DEFAULT_CHAIN_CHANGED, `${this.name}:${chainId}`);
  }

  public requestAccounts(): string[] {
    return this.getAccounts();
  }

  public getDefaultChain(): string {
    if (this.chainId) return this.chainId.toString();
    if (this.namespace.defaultChain) return this.namespace.defaultChain;

    const chainId = this.namespace.chains[0];
    if (!chainId) throw new Error(`ChainId not found`);

    return chainId.split(":")[1];
  }

  // ---------- Private ----------------------------------------------- //

  private createHttpProvider(
    chainId: number,
    rpcUrl?: string | undefined,
  ): JsonRpcProvider | undefined {
    const rpc =
      rpcUrl || getRpcUrl(`${this.name}:${chainId}`, this.namespace, this.client.core.projectId);
    if (!rpc) {
      throw new Error(`No RPC url provided for chainId: ${chainId}`);
    }
    const http = new JsonRpcProvider(new HttpConnection(rpc, getGlobal("disableProviderPing")));
    return http;
  }

  private setHttpProvider(chainId: number, rpcUrl?: string): void {
    const http = this.createHttpProvider(chainId, rpcUrl);
    if (http) {
      this.httpProviders[chainId] = http;
    }
  }

  private createHttpProviders(): RpcProvidersMap {
    const http = {};
    this.namespace.chains.forEach((chain) => {
      const parsedChain = parseInt(getChainId(chain));
      http[parsedChain] = this.createHttpProvider(parsedChain, this.namespace.rpcMap?.[chain]);
    });
    return http;
  }

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

  private getHttpProvider(): JsonRpcProvider {
    const chain = this.chainId;
    const http = this.httpProviders[chain];
    if (typeof http === "undefined") {
      throw new Error(`JSON-RPC provider for ${chain} not found`);
    }
    return http;
  }

  private async handleSwitchChain(args: RequestParams): Promise<any> {
    let hexChainId = args.request.params ? args.request.params[0]?.chainId : "0x0";
    hexChainId = hexChainId.startsWith("0x") ? hexChainId : `0x${hexChainId}`;
    const parsedChainId = parseInt(hexChainId, 16);
    // if chainId is already approved, switch locally
    if (this.isChainApproved(parsedChainId)) {
      this.setDefaultChain(`${parsedChainId}`);
    } else if (this.namespace.methods.includes("wallet_switchEthereumChain")) {
      // try to switch chain within the wallet
      await this.client.request({
        topic: args.topic,
        request: {
          method: args.request.method,
          params: [
            {
              chainId: hexChainId,
            },
          ],
        },
        chainId: this.namespace.chains?.[0], // Sending a previously unapproved chainId will cause namespace validation failure so we must set request chainId to the first chainId in the namespace to avoid it
      } as EngineTypes.RequestParams);
      this.setDefaultChain(`${parsedChainId}`);
    } else {
      throw new Error(
        `Failed to switch to chain 'eip155:${parsedChainId}'. The chain is not approved or the wallet does not support 'wallet_switchEthereumChain' method.`,
      );
    }
    return null;
  }

  private isChainApproved(chainId: number): boolean {
    return this.namespace.chains.includes(`${this.name}:${chainId}`);
  }
}

export default Eip155Provider;
