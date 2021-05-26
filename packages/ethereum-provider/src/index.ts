import EventEmitter from "eventemitter3";
import { JsonRpcProvider } from "@json-rpc-tools/provider";
import { HttpConnection } from "@json-rpc-tools/http-connection";
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
      return this.signer.request(args, { chainId: this.chainId });
    }
    if (typeof this.http === "undefined") {
      throw new Error(`Cannot request JSON-RPC method (${args.method}) without provided rpc url`);
    }
    return this.http.request(args);
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
    this.signer.connection.on(SIGNER_EVENTS.created, (session: SessionTypes.Settled) => {
      this.setChainId(session.permissions.blockchain.chains);
      this.setAccounts(session.state.accounts);
    });
    this.signer.connection.on(SIGNER_EVENTS.updated, (session: SessionTypes.Settled) => {
      const chain = `eip155:${this.chainId}`;
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
        this.events.emit(notification.type, notification.data);
      },
    );
    this.events.on("chainChanged", chainId => this.setHttpProvider(chainId));
  }

  private setSignerProvider(client?: SignerConnectionClientOpts) {
    const connection = new SignerConnection({
      chains: [`eip155:${this.chainId}`],
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

  private setChainId(chains: string[]) {
    const compatible = chains.filter(x => x.startsWith("eip155"));
    if (compatible.length) {
      this.chainId = Number(compatible[0].split(":")[1]);
      this.events.emit("chainChanged", this.chainId);
    }
  }

  private setAccounts(accounts: string[]) {
    this.accounts = accounts
      .filter(x => x.split("@")[1] === `eip155:${this.chainId}`)
      .map(x => x.split("@")[0]);
    this.events.emit("accountsChanged", this.accounts);
  }
}

export default EthereumProvider;
