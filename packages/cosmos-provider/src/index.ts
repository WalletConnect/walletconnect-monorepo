import EventEmitter from "eventemitter3";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import { RequestArguments } from "@walletconnect/jsonrpc-utils";
import { SessionTypes } from "@walletconnect/types";
import {
  SignerConnection,
  SIGNER_EVENTS,
  SignerConnectionClientOpts,
} from "@walletconnect/signer-connection";
import HttpConnection from "@walletconnect/jsonrpc-http-connection";

export const signerMethods = ["cosmos_getAccounts", "cosmos_signDirect", "cosmos_signAmino"];

export const providerEvents = {
  changed: {
    chains: "chainsChanged",
    accounts: "accountsChanged",
  },
};

export interface CosmosRpcConfig {
  custom?: {
    [chainId: string]: string;
  };
}

export function getRpcUrl(chainId: string, rpc?: CosmosRpcConfig): string | undefined {
  let rpcUrl: string | undefined;
  if (rpc && rpc.custom) {
    rpcUrl = rpc.custom[chainId];
  }
  return rpcUrl;
}

export interface CosmosProviderOptions {
  chains: string[];
  methods?: string[];
  rpc?: CosmosRpcConfig;
  client?: SignerConnectionClientOpts;
}

class CosmosProvider {
  public events: any = new EventEmitter();

  private rpc: CosmosRpcConfig | undefined;

  public namespace = "cosmos";
  public chains: string[] = [];
  public methods: string[] = signerMethods;

  public accounts: string[] = [];

  public signer: JsonRpcProvider;
  public http: JsonRpcProvider | undefined;

  constructor(opts?: CosmosProviderOptions) {
    this.rpc = opts?.rpc;
    this.chains = opts?.chains || this.chains;
    this.methods = opts?.methods ? [...opts?.methods, ...this.methods] : this.methods;
    this.signer = this.setSignerProvider(opts?.client);
    this.http = this.setHttpProvider(this.chains);
    this.registerEventListeners();
  }

  public async request<T = unknown>(args: RequestArguments, chainId?: string): Promise<T> {
    if (this.methods.includes(args.method)) {
      const context =
        typeof chainId !== "undefined" ? { chainId: this.formatChainId(chainId) } : undefined;
      return this.signer.request(args, context);
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
    this.signer.connection.on(SIGNER_EVENTS.created, (session: SessionTypes.Settled) => {
      this.setChainId(session.permissions.blockchain.chains);
      this.setAccounts(session.state.accounts);
    });
    this.signer.connection.on(SIGNER_EVENTS.updated, (session: SessionTypes.Settled) => {
      this.setChainId(session.permissions.blockchain.chains);
      if (session.state.accounts !== this.accounts) {
        this.setAccounts(session.state.accounts);
      }
    });
    this.signer.connection.on(
      SIGNER_EVENTS.notification,
      (notification: SessionTypes.Notification) => {
        this.events.emit(notification.type, notification.data);
      },
    );
    this.events.on(providerEvents.changed.chains, chains => this.setHttpProvider(chains));
  }

  private setSignerProvider(client?: SignerConnectionClientOpts) {
    const connection = new SignerConnection({
      chains: this.chains.map(x => this.formatChainId(x)),
      methods: this.methods,
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
      this.chains = compatible;
      this.events.emit(providerEvents.changed.chains, this.chains);
    }
  }

  private parseAccountId(account: string): { chainId: string; address: string } {
    const [namespace, reference, address] = account.split(":");
    const chainId = `${namespace}:${reference}`;
    return { chainId, address };
  }

  private setAccounts(accounts: string[]) {
    this.accounts = accounts
      .filter(x => this.chains.includes(this.parseChainId(this.parseAccountId(x).chainId)))
      .map(x => this.parseAccountId(x).address);
    this.events.emit(providerEvents.changed.accounts, this.accounts);
  }
}

export default CosmosProvider;
