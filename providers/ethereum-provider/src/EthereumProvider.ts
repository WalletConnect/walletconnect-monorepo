import { EventEmitter } from "events";
import { getAccountsFromNamespaces, isValidArray } from "@walletconnect/utils";
import {
  IEthereumProvider as IProvider,
  ProviderAccounts,
  RequestArguments,
} from "eip1193-provider";
import { Metadata, Namespace, UniversalProvider } from "@walletconnect/universal-provider";
import { Web3Modal } from "@web3modal/standalone";
import { SessionTypes, SignClientTypes } from "@walletconnect/types";

export const RPC_URL = "https://rpc.walletconnect.com/v1/";

export const signerMethods = ["eth_sendTransaction", "personal_sign"];

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
  optionalChains?: string[];
  methods: string[];
  optionalMethods?: string[];
  /**
   * @description Events that the wallet MUST support or the connection will be rejected
   */
  events: string[];
  optionalEvents?: string[];
  rpcMap: EthereumRpcMap;
  projectId: string;
  metadata?: Metadata;
  showQrModal: boolean;
}
export interface ConnectOps {
  chains?: number[];
  optionalChains?: number[];
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

export type NamespacesParams = {
  chains: EthereumRpcConfig["chains"];
  optionalChains?: EthereumRpcConfig["optionalChains"];
  methods?: EthereumRpcConfig["methods"];
  optionalMethods?: EthereumRpcConfig["methods"];
  events?: EthereumRpcConfig["events"];
  rpcMap: EthereumRpcConfig["rpcMap"];
  optionalEvents?: EthereumRpcConfig["events"];
};

export function buildNamespaces(params: NamespacesParams): {
  required: Namespace;
  optional?: Namespace;
} {
  const { chains, optionalChains, methods, optionalMethods, events, optionalEvents, rpcMap } =
    params;

  if (!isValidArray(chains)) {
    throw new Error("Invalid chains");
  }

  const requiredChains = chains;
  const requriedMethods = methods || signerMethods;
  const requiredEvents = events || signerEvents;
  const requiredRpcMap = {
    [getEthereumChainId(requiredChains)]: rpcMap[getEthereumChainId(requiredChains)],
  };

  const required: Namespace = {
    chains: requiredChains,
    methods: requriedMethods,
    events: requiredEvents,
    rpcMap: requiredRpcMap,
  };

  // make a list of events and methods that require additional permissions
  // so we know if we should to include the required chains in the optional namespace
  const eventsRequiringPermissions = events?.filter((event) => !signerEvents.includes(event));
  const methodsRequiringPermissions = methods?.filter((event) => !signerMethods.includes(event));

  if (
    !optionalChains &&
    !optionalEvents &&
    !optionalMethods &&
    !eventsRequiringPermissions?.length &&
    !methodsRequiringPermissions?.length
  ) {
    return { required };
  }

  /*
   * decides whether or not to include the required chains in the optional namespace
   * use case: if there is a single chain as required but additonal methods/events as optional
   */
  const shouldIncludeRequiredChains =
    (eventsRequiringPermissions?.length && methodsRequiringPermissions?.length) || !optionalChains;

  const optional: Namespace = {
    chains: [
      ...new Set(
        shouldIncludeRequiredChains ? requiredChains.concat(optionalChains || []) : optionalChains,
      ),
    ],
    methods: [...new Set(requriedMethods.concat(optionalMethods || []))],
    events: [...new Set(requiredEvents.concat(optionalEvents || []))],
    rpcMap,
  };

  return { required, optional };
}
export interface EthereumProviderOptions {
  projectId: string;
  /**
   * @note Chains that your app intents to use and the peer MUST support. If the peer does not support these chains, the connection will be rejected.
   * @default [1]
   * @example [1, 3, 4, 5, 42]
   */
  chains: number[];
  /**
   * @note Optional chains that your app MAY attempt to use and the peer MAY support. If the peer does not support these chains, the connection will still be established.
   * @default [1]
   * @example [1, 3, 4, 5, 42]
   */
  optionalChains?: number[];
  /**
   * @note Methods that your app intents to use and the peer MUST support. If the peer does not support these methods, the connection will be rejected.
   * @default ["eth_sendTransaction", "personal_sign"]
   */
  methods?: string[];
  /**
   * @note Methods that your app MAY attempt to use and the peer MAY support. If the peer does not support these methods, the connection will still be established.
   */
  optionalMethods?: string[];
  events?: string[];
  optionalEvents?: string[];
  rpcMap?: EthereumRpcMap;
  metadata?: Metadata;
  showQrModal?: boolean;
}

export class EthereumProvider implements IEthereumProvider {
  public events: any = new EventEmitter();
  public namespace = "eip155";
  public accounts: string[] = [];
  public signer: InstanceType<typeof UniversalProvider>;
  public chainId = 1;
  public modal?: Web3Modal;

  private rpc: EthereumRpcConfig;

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
    const { required, optional } = buildNamespaces(this.rpc);
    try {
      const session = await new Promise<SessionTypes.Struct | undefined>(
        async (resolve, reject) => {
          if (this.rpc.showQrModal) {
            this.modal?.subscribeModal((state) => {
              // the modal was closed so reject the promise
              if (!state.open && !this.signer.session)
                reject(new Error("User rejected the request."));
            });
          }
          resolve(
            await this.signer.connect({
              namespaces: {
                [this.namespace]: required,
              },
              ...(optional && {
                optionalNamespaces: {
                  [this.namespace]: optional,
                },
              }),
              pairingTopic: opts?.pairingTopic,
            }),
          );
        },
      );
      if (!session) return;
      this.setChainIds(this.rpc.chains);
      const accounts = getAccountsFromNamespaces(session.namespaces, [this.namespace]);
      this.setAccounts(accounts);
      this.events.emit("connect", { chainId: this.chainId, accounts: this.accounts });
    } catch (error) {
      this.signer.logger.error(error);
      throw error;
    } finally {
      if (this.modal) this.modal.closeModal();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.session) {
      await this.signer.disconnect();
    }
    this.reset();
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
    this.signer.on("session_event", (payload: SignClientTypes.EventArguments["session_event"]) => {
      const { params } = payload;
      const { event } = params;
      if (event.name === "accountsChanged") {
        this.accounts = event.data;
        this.events.emit("accountsChanged", this.accounts);
      } else if (event.name === "chainChanged") {
        this.setChainId(this.formatChainId(event.data));
      } else {
        this.events.emit(event.name, event.data);
      }
      this.events.emit("session_event", payload);
    });

    this.signer.on("chainChanged", (chainId: number) => {
      this.chainId = chainId;
      this.events.emit("chainChanged", chainId);
    });

    this.signer.on(
      "session_update",
      (payload: SignClientTypes.EventArguments["session_update"]) => {
        this.events.emit("session_update", payload);
      },
    );

    this.signer.on(
      "session_delete",
      (payload: SignClientTypes.EventArguments["session_delete"]) => {
        this.reset();
        this.events.emit("session_delete", payload);
      },
    );

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
    const chainIds = compatible.map((c) => this.parseChainId(c));
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
      chains: opts.chains?.map((chain) => this.formatChainId(chain)) || [`${this.namespace}:1`],
      optionalChains: opts.optionalChains
        ? opts.optionalChains.map((chain) => this.formatChainId(chain))
        : undefined,
      methods: opts?.methods || signerMethods,
      events: opts?.events || signerEvents,
      optionalMethods: opts?.optionalMethods || [],
      optionalEvents: opts?.optionalEvents || [],
      rpcMap:
        opts?.rpcMap ||
        this.buildRpcMap(opts.chains.concat(opts.optionalChains || []), opts.projectId),
      showQrModal: opts?.showQrModal ?? true,
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
    this.loadPersistedSession();
    if (this.rpc.showQrModal)
      this.modal = new Web3Modal({
        walletConnectVersion: 2,
        projectId: this.rpc.projectId,
        standaloneChains: this.rpc.chains,
      });
  }

  private loadConnectOpts(opts?: ConnectOps) {
    if (!opts) return;
    const { chains, optionalChains, rpcMap } = opts;
    if (chains && isValidArray(chains)) {
      this.rpc.chains = chains.map((chain) => this.formatChainId(chain));
      chains.forEach((chain) => {
        this.rpc.rpcMap[chain] = rpcMap?.[chain] || this.getRpcUrl(chain);
      });
    }
    if (optionalChains && isValidArray(optionalChains)) {
      this.rpc.optionalChains = [];
      this.rpc.optionalChains = optionalChains?.map((chain) => this.formatChainId(chain));
      optionalChains.forEach((chain) => {
        this.rpc.rpcMap[chain] = rpcMap?.[chain] || this.getRpcUrl(chain);
      });
    }
  }

  private getRpcUrl(chainId: number, projectId?: string): string {
    const providedRpc = this.rpc.rpcMap?.[chainId];
    return (
      providedRpc ||
      `${RPC_URL}?chainId=eip155:${chainId}&projectId=${projectId || this.rpc.projectId}`
    );
  }

  private loadPersistedSession() {
    if (!this.session) return;
    this.setChainIds(this.session.namespaces[this.namespace].accounts);
    this.setAccounts(this.session.namespaces[this.namespace].accounts);
  }

  private reset() {
    this.chainId = 1;
    this.accounts = [];
  }
}

export default EthereumProvider;
