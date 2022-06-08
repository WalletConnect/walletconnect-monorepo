import { EventEmitter } from "events";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import { HttpConnection } from "@walletconnect/jsonrpc-http-connection";
import { SessionTypes } from "@walletconnect/types";
import { getChainsFromNamespaces, getAccountsFromNamespaces } from "@walletconnect/utils";
import {
  SignerConnection,
  SIGNER_EVENTS,
  SignerConnectionClientOpts,
} from "@walletconnect/signer-connection";
import { IEthereumProvider, ProviderAccounts, RequestArguments } from "eip1193-provider";

export const signerMethods = [
  "eth_requestAccounts",
  "eth_accounts",
  "eth_chainId",
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_sign",
  "eth_signTypedData",
  "personal_sign",
];

export const signerEvents = ["chainChanged", "accountsChanged"];

export interface EthereumRpcMap {
  [chainId: string]: string;
}
export interface EthereumRpcConfig {
  chains: string[];
  methods: string[];
  events: string[];
  rpcMap?: EthereumRpcMap;
}

export function getRpcConfig(opts: EthereumProviderOptions): EthereumRpcConfig {
  return {
    chains: opts?.chainId ? [`eip155:${opts.chainId}`] : [],
    methods: opts?.methods || [],
    events: opts?.events || [],
    rpcMap: opts?.rpcMap || undefined,
  };
}

export function getRpcUrl(chainId: string, rpc: EthereumRpcConfig): string | undefined {
  let rpcUrl: string | undefined;
  if (rpc.rpcMap) {
    rpcUrl = rpc.rpcMap[getEthereumChainId([chainId])];
  }
  return rpcUrl;
}

export function getEthereumChainId(chains: string[]): number {
  return Number(chains[0].split(":")[1]);
}

export interface EthereumProviderOptions {
  chainId: number;
  methods?: string[];
  events?: string[];
  rpcMap?: EthereumRpcMap;
  client?: SignerConnectionClientOpts;
}

class EthereumProvider implements IEthereumProvider {
  public events: any = new EventEmitter();
  public rpc: EthereumRpcConfig;
  public namespace = "eip155";
  public accounts: string[] = [];
  public signer: JsonRpcProvider;
  public http: JsonRpcProvider | undefined;
  public chainId: number;

  constructor(opts: EthereumProviderOptions) {
    this.rpc = getRpcConfig(opts);
    this.signer = this.setSignerProvider(opts?.client);
    this.chainId = getEthereumChainId(this.rpc.chains);
    this.http = this.setHttpProvider(this.chainId);
    this.registerEventListeners();
  }

  public async request<T = unknown>(args: RequestArguments): Promise<T> {
    switch (args.method) {
      case "eth_requestAccounts":
        await this.connect();
        return this.accounts as any;
      case "eth_accounts":
        return this.accounts as any;
      case "eth_chainId":
        return this.chainId as any;
      default:
        break;
    }
    if (args.method.startsWith("eth_signTypedData") || this.rpc.methods.includes(args.method)) {
      return this.signer.request(args, { chainId: this.formatChainId(this.chainId) });
    }
    if (typeof this.http === "undefined") {
      throw new Error(`Cannot request JSON-RPC method (${args.method}) without provided rpc url`);
    }
    return this.http.request(args);
  }

  public sendAsync(
    args: RequestArguments,
    callback: (error: Error | null, response: any) => void,
  ): void {
    this.request(args)
      .then(response => callback(null, response))
      .catch(error => callback(error, undefined));
  }

  get connected(): boolean {
    return (this.signer.connection as SignerConnection).connected;
  }

  get connecting(): boolean {
    return (this.signer.connection as SignerConnection).connecting;
  }

  public async enable(): Promise<ProviderAccounts> {
    const accounts = await this.request({ method: "eth_requestAccounts" });
    return accounts as ProviderAccounts;
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
    this.signer.on("connect", () => {
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
    this.signer.connection.on(SIGNER_EVENTS.event, (params: any) => {
      if (!this.rpc.chains.includes(params.chainId)) return;
      const { event } = params;
      if (event.type === "accountsChanges") {
        // this.accounts = event.data;
        this.events.emit("accountsChanged", this.accounts);
      } else if (event.type === "chainChanged") {
        // this.setChainId([event.data]);
        this.events.emit("chainChanged", this.chainId);
      } else {
        this.events.emit(event.type, event.data);
      }
    });
    this.signer.on("disconnect", () => {
      this.events.emit("disconnect");
    });
    this.events.on("chainChanged", (chainId: number) => this.setHttpProvider(chainId));
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

  private setHttpProvider(chainId: number): JsonRpcProvider | undefined {
    const rpcUrl = getRpcUrl(`${this.namespace}:${chainId}`, this.rpc);
    if (typeof rpcUrl === "undefined") return undefined;
    const http = new JsonRpcProvider(new HttpConnection(rpcUrl));
    return http;
  }

  private isCompatibleChainId(chainId: string): boolean {
    return chainId.startsWith(`${this.namespace}:`);
  }

  private formatChainId(chainId: number): string {
    return `${this.namespace}:${chainId}`;
  }

  private parseChainId(chainId: string): number {
    return Number(chainId.split(":")[1]);
  }

  private setChainId(chains: string[]) {
    const compatible = chains.filter(x => this.isCompatibleChainId(x));
    if (compatible.length) {
      this.chainId = this.parseChainId(compatible[0]);
      this.events.emit("chainChanged", this.chainId);
    }
  }

  private parseAccountId(account: string): { chainId: string; address: string } {
    const [namespace, reference, address] = account.split(":");
    const chainId = `${namespace}:${reference}`;
    return { chainId, address };
  }

  private setAccounts(accounts: string[]) {
    this.accounts = accounts
      .filter(x => this.parseChainId(this.parseAccountId(x).chainId) === this.chainId)
      .map(x => this.parseAccountId(x).address);
    this.events.emit("accountsChanged", this.accounts);
  }
}

export default EthereumProvider;
