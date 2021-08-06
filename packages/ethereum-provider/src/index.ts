import { EventEmitter } from "events";
import { JsonRpcProvider } from "@walletconnect/jsonrpc-provider";
import { HttpConnection } from "@walletconnect/jsonrpc-http-connection";
import { SessionTypes } from "@walletconnect/types";
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

export const infuraNetworks = {
  1: "mainnet",
  3: "ropsten",
  4: "rinkeby",
  5: "goerli",
  42: "kovan",
};

export const providerEvents = {
  changed: {
    chain: "chainChanged",
    accounts: "accountsChanged",
  },
};

export interface EthereumRpcConfig {
  infuraId?: string;
  custom?: {
    [chainId: number]: string;
  };
}

export function getInfuraRpcUrl(chainId: number, infuraId?: string): string | undefined {
  let rpcUrl: string | undefined;
  const network = infuraNetworks[chainId];
  if (network) {
    rpcUrl = `https://${network}.infura.io/v3/${infuraId}`;
  }
  return rpcUrl;
}

export function getRpcUrl(chainId: number, rpc?: EthereumRpcConfig): string | undefined {
  let rpcUrl: string | undefined;
  const infuraUrl = getInfuraRpcUrl(chainId, rpc?.infuraId);
  if (rpc && rpc.custom) {
    rpcUrl = rpc.custom[chainId];
  } else if (infuraUrl) {
    rpcUrl = infuraUrl;
  }
  return rpcUrl;
}

export interface EthereumProviderOptions {
  chainId: number;
  methods?: string[];
  rpc?: EthereumRpcConfig;
  client?: SignerConnectionClientOpts;
}

class EthereumProvider implements IEthereumProvider {
  public events: any = new EventEmitter();

  private rpc: EthereumRpcConfig | undefined;

  public namespace = "eip155";
  public chainId = 1;
  public methods = signerMethods;

  public accounts: string[] = [];

  public signer: JsonRpcProvider;
  public http: JsonRpcProvider | undefined;

  constructor(opts?: EthereumProviderOptions) {
    this.rpc = opts?.rpc;
    this.chainId = opts?.chainId || this.chainId;
    this.methods = opts?.methods ? [...opts?.methods, ...this.methods] : this.methods;
    this.signer = this.setSignerProvider(opts?.client);
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
    if (args.method.startsWith("eth_signTypedData") || this.methods.includes(args.method)) {
      return this.signer.request(args, { chainId: this.formatChainId(this.chainId) });
    }
    if (typeof this.http === "undefined") {
      throw new Error(`Cannot request JSON-RPC method (${args.method}) without provided rpc url`);
    }
    return this.http.request(args);
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
    this.signer.on("connect", async () => {
      const chains = (this.signer.connection as SignerConnection).chains;
      if (chains && chains.length) this.setChainId(chains);
      const accounts = (this.signer.connection as SignerConnection).accounts;
      if (accounts && accounts.length) this.setAccounts(accounts);
    });
    this.signer.connection.on(SIGNER_EVENTS.created, (session: SessionTypes.Settled) => {
      this.setChainId(session.permissions.blockchain.chains);
      this.setAccounts(session.state.accounts);
    });
    this.signer.connection.on(SIGNER_EVENTS.updated, (session: SessionTypes.Settled) => {
      const chain = this.formatChainId(this.chainId);
      if (!session.permissions.blockchain.chains.includes(chain)) {
        this.setChainId(session.permissions.blockchain.chains);
      }
      if (session.state.accounts !== this.accounts) {
        this.setAccounts(session.state.accounts);
      }
    });
    this.signer.connection.on(
      SIGNER_EVENTS.notification,
      (notification: SessionTypes.Notification) => {
        if (notification.type === providerEvents.changed.accounts) {
          this.accounts = notification.data;
          this.events.emit(providerEvents.changed.accounts, this.accounts);
        } else if (notification.type === providerEvents.changed.chain) {
          this.chainId = notification.data;
          this.events.emit(providerEvents.changed.chain, this.chainId);
        } else {
          this.events.emit(notification.type, notification.data);
        }
      },
    );
    this.events.on(providerEvents.changed.chain, chainId => this.setHttpProvider(chainId));
  }

  private setSignerProvider(client?: SignerConnectionClientOpts) {
    const connection = new SignerConnection({
      chains: [this.formatChainId(this.chainId)],
      methods: this.methods,
      client,
    });
    return new JsonRpcProvider(connection);
  }

  private setHttpProvider(chainId: number): JsonRpcProvider | undefined {
    const rpcUrl = getRpcUrl(chainId, this.rpc);
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
      this.events.emit(providerEvents.changed.chain, this.chainId);
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
    this.events.emit(providerEvents.changed.accounts, this.accounts);
  }
}

export default EthereumProvider;
