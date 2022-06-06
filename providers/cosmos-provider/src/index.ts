import EventEmitter from "eventemitter3";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import { RequestArguments } from "@walletconnect/jsonrpc-utils";
import { SessionTypes } from "@walletconnect/types";
import HttpConnection from "@walletconnect/jsonrpc-http-connection";
import { getChainsFromNamespaces, getAccountsFromNamespaces } from "@walletconnect/utils";
import {
  SignerConnection,
  SIGNER_EVENTS,
  SignerConnectionClientOpts,
} from "@walletconnect/signer-connection";

export const signerMethods = ["cosmos_getAccounts", "cosmos_signDirect", "cosmos_signAmino"];

export const signerEvents = ["chainsChanged", "accountsChanged"];

export interface CosmosRpcMap {
  [chainId: string]: string;
}

export interface CosmosRpcConfig {
  chains: string[];
  methods: string[];
  events: string[];
  rpcMap?: CosmosRpcMap;
}

export function getRpcConfig(opts: CosmosProviderOptions): CosmosRpcConfig {
  return {
    chains: opts?.chains || [],
    methods: opts?.methods || [],
    events: opts?.events || [],
    rpcMap: opts?.rpcMap || undefined,
  };
}

export function getRpcUrl(chainId: string, rpc: CosmosRpcConfig): string | undefined {
  let rpcUrl: string | undefined;
  if (rpc.rpcMap) {
    rpcUrl = rpc.rpcMap[chainId];
  }
  return rpcUrl;
}

export interface CosmosProviderOptions {
  chains: string[];
  methods?: string[];
  events?: string[];
  rpcMap?: CosmosRpcMap;
  client?: SignerConnectionClientOpts;
}

class CosmosProvider {
  public events: any = new EventEmitter();

  public rpc: CosmosRpcConfig;

  public namespace = "cosmos";

  public accounts: string[] = [];

  public signer: JsonRpcProvider;
  public http: JsonRpcProvider | undefined;

  constructor(opts: CosmosProviderOptions) {
    this.rpc = getRpcConfig(opts);
    this.signer = this.setSignerProvider(opts?.client);
    this.http = this.setHttpProvider(this.rpc.chains);
    this.registerEventListeners();
  }

  public async request<T = unknown>(args: RequestArguments, chainId?: string): Promise<T> {
    if (this.rpc.methods.includes(args.method)) {
      const context =
        typeof chainId !== "undefined" ? { chainId: this.formatChainId(chainId) } : undefined;
      return await this.signer.request(args, context);
    }
    if (typeof this.http === "undefined") {
      throw new Error(`Cannot request JSON-RPC method (${args.method}) without provided rpc url`);
    }
    return this.http.request(args);
  }

  public async connect(): Promise<void> {
    await this.signer.connect();
  }

  public async disconnect(): Promise<void> {
    await this.signer.disconnect();
  }

  public on(event: any, listener: any): void {
    this.events.on(event, listener);
  }
  public once(event: string, listener: any): void {
    this.events.once(event, listener);
  }
  public removeListener(event: string, listener: any): void {
    this.events.removeListener(event, listener);
  }
  public off(event: string, listener: any): void {
    this.events.off(event, listener);
  }

  get isWalletConnect() {
    return true;
  }

  // ---------- Private ----------------------------------------------- //

  private registerEventListeners() {
    this.signer.on("connect", async () => {
      const chains = (this.signer.connection as SignerConnection).chains;
      if (chains && chains.length) this.setChainId(chains);
      const accounts = (this.signer.connection as SignerConnection).accounts;
      if (accounts && accounts.length) this.setAccounts(accounts);
    });
    this.signer.connection.on(SIGNER_EVENTS.created, (session: SessionTypes.Struct) => {
      const chains = getChainsFromNamespaces(session.namespaces, [this.namespace]);
      this.setChainId(chains);
      const accounts = getAccountsFromNamespaces(session.namespaces, [this.namespace]);
      this.setAccounts(accounts);
    });
    this.signer.connection.on(SIGNER_EVENTS.updated, (session: SessionTypes.Struct) => {
      const chains = getChainsFromNamespaces(session.namespaces, [this.namespace]);
      this.setChainId(chains);
      const accounts = getAccountsFromNamespaces(session.namespaces, [this.namespace]);
      if (accounts !== this.accounts) {
        this.setAccounts(accounts);
      }
    });
    // TODO: fix this params with any type casting
    this.signer.connection.on(SIGNER_EVENTS.event, (params: any) => {
      if (!this.rpc.chains.includes(params.chainId)) return;
      this.events.emit(params.event.type, params.event.data);
    });
    this.signer.on("disconnect", () => {
      this.events.emit("disconnect");
    });
    this.events.on("chainsChanged", (chains: string[]) => this.setHttpProvider(chains));
  }

  private setSignerProvider(client?: SignerConnectionClientOpts) {
    const connection = new SignerConnection({
      requiredNamespaces: {
        [this.namespace]: {
          chains: this.rpc.chains,
          methods: this.rpc.methods,
          events: this.rpc.events,
        },
      },
      client,
    });
    return new JsonRpcProvider(connection);
  }

  private setHttpProvider(chains: string[]): JsonRpcProvider | undefined {
    const rpcUrl = getRpcUrl(chains[0], this.rpc);
    if (typeof rpcUrl === "undefined") return undefined;
    const http = new JsonRpcProvider(new HttpConnection(rpcUrl));
    return http;
  }

  private isCompatibleChainId(chainId: string): boolean {
    return chainId.startsWith(`${this.namespace}:`);
  }

  private formatChainId(chainId: string): string {
    return `${this.namespace}:${chainId}`;
  }

  private parseChainId(chainId: string): string {
    return chainId.split(":")[1];
  }

  private setChainId(chains: string[]) {
    const compatible = chains
      .filter(x => this.isCompatibleChainId(x))
      .map(x => this.parseChainId(x));
    if (compatible.length) {
      this.rpc.chains = compatible;
      this.events.emit("chainsChanged", this.rpc.chains);
    }
  }

  private parseAccountId(account: string): { chainId: string; address: string } {
    const [namespace, reference, address] = account.split(":");
    const chainId = `${namespace}:${reference}`;
    return { chainId, address };
  }

  private setAccounts(accounts: string[]) {
    this.accounts = accounts
      .filter(x => this.rpc.chains.includes(this.parseChainId(this.parseAccountId(x).chainId)))
      .map(x => this.parseAccountId(x).address);
    this.events.emit("accountsChanged", this.accounts);
  }
}

export default CosmosProvider;
