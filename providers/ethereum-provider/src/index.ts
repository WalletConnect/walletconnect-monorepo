import { EventEmitter } from "events";
import {
  getChainsFromNamespaces,
  getAccountsFromNamespaces,
  isValidArray,
} from "@walletconnect/utils";
import {
  IEthereumProvider as IProvider,
  ProviderAccounts,
  RequestArguments,
} from "eip1193-provider";
import { Metadata, UniversalProvider } from "@walletconnect/universal-provider";
import { Web3Modal } from "@web3modal/standalone";

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

export interface SessionEvent {
  event: { name: string; data: any };
  chainId: string;
}

export interface EthereumRpcConfig {
  chains: string[];
  methods: string[];
  events: string[];
  rpcMap: EthereumRpcMap;
  projectId: string;
  metadata?: Metadata;
  showQrModal: boolean;
}

export interface ConnectOps {
  chains?: number[];
  rpcMap?: EthereumRpcMap;
  pairingTopic?: string;
}

export interface IEthereumProvider extends IProvider {
  connect(opts?: ConnectOps | undefined): Promise<void>;
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
  projectId: string;
  chains: number[];
  methods?: string[];
  events?: string[];
  rpcMap?: EthereumRpcMap;
  metadata?: Metadata;
  showQrModal?: boolean;
}

class EthereumProvider implements IEthereumProvider {
  public events: any = new EventEmitter();
  public namespace = "eip155";
  public accounts: string[] = [];
  public signer: InstanceType<typeof UniversalProvider>;
  public chainId = 1;

  private rpc: EthereumRpcConfig;
  private modal?: Web3Modal;

  constructor() {
    // assigned during initialize
    this.signer = {} as InstanceType<typeof UniversalProvider>;
    this.rpc = {} as EthereumRpcConfig;
  }

  static async init(opts: EthereumProviderOptions): Promise<EthereumProvider> {
    const provider = new EthereumProvider();
    await provider.initialize(opts);
    return provider;
  }

  public async request<T = unknown>(args: RequestArguments): Promise<T> {
    return await this.signer.request(args, this.formatChainId(this.chainId));
  }

  public sendAsync(
    args: RequestArguments,
    callback: (error: Error | null, response: any) => void,
  ): void {
    this.signer.sendAsync(args, callback, this.formatChainId(this.chainId));
  }

  get connected(): boolean {
    if (!this.signer.client) return false;
    return this.signer.client.core.relayer.connected;
  }

  get connecting(): boolean {
    if (!this.signer.client) return false;
    return this.signer.client.core.relayer.connecting;
  }

  public async enable(): Promise<ProviderAccounts> {
    if (!this.session) await this.connect();
    const accounts = await this.request({ method: "eth_requestAccounts" });
    return accounts as ProviderAccounts;
  }

  public async connect(opts?: ConnectOps): Promise<void> {
    if (!this.signer.client) {
      throw new Error("Provider not initialized. Call init() first");
    }

    this.loadConnectOpts(opts);

    try {
      const session = await this.signer.connect({
        namespaces: {
          [this.namespace]: {
            chains: this.rpc.chains,
            methods: this.rpc.methods,
            events: this.rpc.events,
            rpcMap: this.rpc.rpcMap,
          },
        },
        pairingTopic: opts?.pairingTopic,
      });
      if (!session) return;
      const chains = getChainsFromNamespaces(session.namespaces, [this.namespace]);
      this.setChainIds(chains);
      const accounts = getAccountsFromNamespaces(session.namespaces, [this.namespace]);
      this.setAccounts(accounts);
      this.events.emit("connect", { chainId: this.chainId, accounts: this.accounts });
    } catch (error) {
      throw new Error((error as Error).message);
    } finally {
      if (this.modal) this.modal.closeModal();
    }
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

  get session() {
    return this.signer.session;
  }
  // ---------- Private ----------------------------------------------- //

  private registerEventListeners() {
    this.signer.on("session_event", (payload: any) => {
      const { params } = payload;
      if (!this.rpc.chains.includes(params.chainId)) return;
      const { event } = params;
      if (event.name === "accountsChanged") {
        this.accounts = event.data;
        this.events.emit("accountsChanged", this.accounts);
      } else if (event.name === "chainChanged") {
        this.setChainId(event.data);
      } else {
        this.events.emit(event.name, event.data);
      }
      this.events.emit("session_event", payload);
    });

    this.signer.on("disconnect", () => {
      this.events.emit("disconnect");
    });

    this.signer.on("display_uri", (uri: string) => {
      if (this.rpc.showQrModal) {
        this.modal?.openModal({ uri });
      }
      this.events.emit("display_uri", uri);
    });
  }

  private setHttpProvider(chainId: number): void {
    const formattedChain = this.formatChainId(chainId);
    this.signer.setDefaultChain(formattedChain, this.getRpcUrl(chainId));
  }

  private isCompatibleChainId(chainId: string): boolean {
    return typeof chainId === "string" ? chainId.startsWith(`${this.namespace}:`) : false;
  }

  private formatChainId(chainId: number): string {
    return `${this.namespace}:${chainId}`;
  }

  private parseChainId(chainId: string): number {
    return Number(chainId.split(":")[1]);
  }

  private setChainIds(chains: string[]) {
    const compatible = chains.filter((x) => this.isCompatibleChainId(x));
    const chainIds = compatible.map((c) => this.parseChainId(c)).filter((c) => c !== this.chainId);
    if (chainIds.length) {
      this.chainId = chainIds[0];
      this.events.emit("chainChanged", this.chainId);
    }
  }

  private setChainId(chain: string) {
    if (this.isCompatibleChainId(chain)) {
      const chainId = this.parseChainId(chain);
      this.chainId = chainId;
      this.setHttpProvider(chainId);
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
      .filter((x) => this.parseChainId(this.parseAccountId(x).chainId) === this.chainId)
      .map((x) => this.parseAccountId(x).address);
    this.events.emit("accountsChanged", this.accounts);
  }

  private getRpcConfig(opts: EthereumProviderOptions): EthereumRpcConfig {
    return {
      chains: opts.chains.map((chain) => this.formatChainId(chain)) || [`${this.namespace}:1`],
      methods: opts?.methods || signerMethods,
      events: opts?.events || signerEvents,
      rpcMap: opts?.rpcMap || this.buildRpcMap(opts.chains, opts.projectId),
      showQrModal: opts?.showQrModal || true,
      projectId: opts.projectId,
      metadata: opts.metadata,
    };
  }

  private buildRpcMap(chains: number[], projectId: string): EthereumRpcMap {
    const map: EthereumRpcMap = {};
    chains.forEach((chain) => {
      map[chain] = this.getRpcUrl(chain, projectId);
    });
    return map;
  }

  private async initialize(opts: EthereumProviderOptions) {
    this.rpc = this.getRpcConfig(opts);
    this.chainId = getEthereumChainId(this.rpc.chains);
    this.signer = await UniversalProvider.init({ projectId: this.rpc.projectId });
    this.registerEventListeners();
    if (this.rpc.showQrModal)
      this.modal = new Web3Modal({
        projectId: this.rpc.projectId,
        standaloneChains: this.rpc.chains,
      });
  }

  private loadConnectOpts(opts?: ConnectOps) {
    if (!opts) return;
    const { chains, rpcMap } = opts;
    if (!isValidArray(chains) || !chains) return;
    this.rpc.chains = this.rpc.chains.concat(chains.map((chain) => this.formatChainId(chain)));
    // filter duplicate chains
    this.rpc.chains = [...new Set(this.rpc.chains)];
    chains.forEach((chain) => {
      this.rpc.rpcMap[chain] = rpcMap?.[chain] || this.getRpcUrl(chain);
    });
  }

  private getRpcUrl(chainId: number, projectId?: string): string {
    const providedRpc = this.rpc.rpcMap?.[chainId];
    return (
      providedRpc ||
      `https://rpc.walletconnect.com/v1/?chainId=eip155:${chainId}&projectId=${
        projectId || this.rpc.projectId
      }`
    );
  }
}

export default EthereumProvider;
