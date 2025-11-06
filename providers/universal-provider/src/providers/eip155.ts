import Client from "@walletconnect/sign-client";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import { HttpConnection } from "@walletconnect/jsonrpc-http-connection";
import { EngineTypes, SessionTypes } from "@walletconnect/types";
import { formatJsonRpcRequest } from "@walletconnect/jsonrpc-utils";

import {
  IProvider,
  RpcProvidersMap,
  SubProviderOpts,
  RequestParams,
  SessionNamespace,
  SendCallsResult,
} from "../types/index.js";

import {
  extractCapabilitiesFromSession,
  getChainId,
  getGlobal,
  getRpcUrl,
  getStoredSendCalls,
  prepareCallStatusFromStoredSendCalls,
  Storage,
  storeSendCalls,
} from "../utils/index.js";
import EventEmitter from "events";
import { BUNDLER_URL, PROVIDER_EVENTS } from "../constants/index.js";

class Eip155Provider implements IProvider {
  public name = "eip155";
  public client: Client;
  // the active chainId on the dapp
  public chainId: number;
  public namespace: SessionNamespace;
  public httpProviders: RpcProvidersMap;
  public events: EventEmitter;
  public storage: Storage;

  constructor(opts: SubProviderOpts) {
    this.namespace = opts.namespace;
    this.events = getGlobal("events");
    this.client = getGlobal("client");
    this.httpProviders = this.createHttpProviders();
    this.chainId = parseInt(this.getDefaultChain());
    this.storage = Storage.getStorage(this.client.core.storage);
  }

  public async request<T = unknown>(args: RequestParams): Promise<T> {
    switch (args.request.method) {
      case "eth_requestAccounts":
        return this.getAccounts() as unknown as T;
      case "eth_accounts":
        return this.getAccounts() as unknown as T;
      case "wallet_switchEthereumChain": {
        return (await this.handleSwitchChain(args)) as unknown as T;
      }
      case "eth_chainId":
        return parseInt(this.getDefaultChain()) as unknown as T;
      case "wallet_getCapabilities":
        return (await this.getCapabilities(args)) as unknown as T;
      case "wallet_getCallsStatus":
        return (await this.getCallStatus(args)) as unknown as T;
      case "wallet_sendCalls":
        return (await this.sendCalls(args)) as unknown as T;
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
    const previous = this.chainId;
    this.chainId = parseInt(chainId);
    this.events.emit(PROVIDER_EVENTS.DEFAULT_CHAIN_CHANGED, {
      currentCaipChainId: `${this.name}:${chainId}`,
      previousCaipChainId: `${this.name}:${previous}`,
    });
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

  private getHttpProvider(chainId?: number): JsonRpcProvider {
    const chain = chainId || this.chainId;
    const http = this.httpProviders[chain];
    if (http) {
      return http;
    }

    this.httpProviders = {
      ...this.httpProviders,
      [chain]: this.createHttpProvider(chain),
    };
    return this.httpProviders[chain];
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

  /**
   * util method to get the capabilities for given address and chainIds from the wallet
   * 1. check if the capabilities are stored in the sessionProperties legacy way - address+chainIds for backwards compatibility
   * 2. check if the capabilities are stored in the sessionProperties
   * 3. check if the capabilities are stored in the scopedProperties
   * 4. if not, send the request to the wallet
   * 5. update the session with the capabilities so they can be retrieved later
   * 6. return the capabilities
   */
  private async getCapabilities(args: RequestParams) {
    // if capabilities are stored in the session, return them, else send the request to the wallet
    const address = args.request?.params?.[0];
    const chainIds: string[] = args.request?.params?.[1] || [];

    if (!address) throw new Error("Missing address parameter in `wallet_getCapabilities` request");
    const session = this.client.session.get(args.topic);
    const sessionCapabilities = session?.sessionProperties?.capabilities || {};

    // cache key is address + chainIds to allow requests to be made to different chains
    const capabilitiesKey = `${address}${chainIds.join(",")}`;
    const legacyCapabilities = sessionCapabilities?.[capabilitiesKey];
    if (legacyCapabilities) {
      return legacyCapabilities;
    }
    let cachedCapabilities;
    try {
      cachedCapabilities = extractCapabilitiesFromSession(session, address, chainIds);
    } catch (error) {
      console.warn("Failed to extract capabilities from session", error);
    }

    if (cachedCapabilities) {
      return cachedCapabilities;
    }

    // intentionally omit catching errors/rejection during `request` to allow the error to bubble up
    const capabilities = await this.client.request(args as EngineTypes.RequestParams);
    try {
      // update the session with the capabilities so they can be retrieved later
      await this.client.session.update(args.topic, {
        sessionProperties: {
          ...(session.sessionProperties || {}),
          capabilities: {
            ...(sessionCapabilities || {}),
            [capabilitiesKey]: capabilities,
          } as any, // by spec sessionProperties should be <string, string> but here are used as objects?
        },
      });
    } catch (error) {
      console.warn("Failed to update session with capabilities", error);
    }
    return capabilities;
  }

  private async getCallStatus(args: RequestParams) {
    const session = this.client.session.get(args.topic);
    const bundlerName = session.sessionProperties?.bundler_name as string;
    if (bundlerName) {
      const bundlerUrl = this.getBundlerUrl(args.chainId, bundlerName);
      try {
        return await this.getUserOperationReceipt(bundlerUrl, args);
      } catch (error) {
        console.warn("Failed to fetch call status from bundler", error, bundlerUrl);
      }
    }
    const customUrl = session.sessionProperties?.bundler_url as string;
    if (customUrl) {
      try {
        return await this.getUserOperationReceipt(customUrl, args);
      } catch (error) {
        console.warn("Failed to fetch call status from custom bundler", error, customUrl);
      }
    }

    const storedSendCalls = await getStoredSendCalls({
      resultId: args.request.params?.[0] as string,
      storage: this.storage,
    });
    if (storedSendCalls) {
      try {
        return await prepareCallStatusFromStoredSendCalls(
          storedSendCalls,
          this.getHttpProvider.bind(this),
        );
      } catch (error) {
        console.warn("Failed to fetch call status from stored send calls", error, storedSendCalls);
      }
    }

    if (this.namespace.methods.includes(args.request.method)) {
      return await this.client.request(args as EngineTypes.RequestParams);
    }

    throw new Error("Fetching call status not approved by the wallet.");
  }

  private async getUserOperationReceipt(bundlerUrl: string, args: RequestParams) {
    const url = new URL(bundlerUrl);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        formatJsonRpcRequest("eth_getUserOperationReceipt", [args.request.params?.[0]]),
      ),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch user operation receipt - ${response.status}`);
    }
    return await response.json();
  }

  private getBundlerUrl(cap2ChainId: string, bundlerName: string) {
    return `${BUNDLER_URL}?projectId=${this.client.core.projectId}&chainId=${cap2ChainId}&bundler=${bundlerName}`;
  }

  private async sendCalls(args: RequestParams) {
    const result = await this.client.request<SendCallsResult>(args as EngineTypes.RequestParams);
    const sendCallsParams = args.request.params?.[0];
    const resultId = result?.id;
    const capabilities = result?.capabilities || {};
    const caip2 = capabilities?.caip345?.caip2;
    const transactionHashes = capabilities?.caip345?.transactionHashes;

    if (!resultId || !caip2 || !transactionHashes?.length) {
      return result;
    }

    await storeSendCalls({
      sendCalls: { request: sendCallsParams, result },
      storage: this.storage,
    });
    return result;
  }
}

export default Eip155Provider;
