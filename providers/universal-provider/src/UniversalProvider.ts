import pino from "pino";
import SignClient from "@walletconnect/sign-client";
import { ProviderAccounts } from "eip1193-provider";
import { SessionTypes } from "@walletconnect/types";
import { getSdkError, isValidArray } from "@walletconnect/utils";
import { getDefaultLoggerOptions, Logger } from "@walletconnect/logger";
import Eip155Provider from "./providers/eip155";
import SolanaProvider from "./providers/solana";
import CosmosProvider from "./providers/cosmos";
import CardanoProvider from "./providers/cardano";
import {
  IUniversalProvider,
  IProvider,
  RpcProviderMap,
  ConnectParams,
  RequestArguments,
  UniversalProviderOpts,
  NamespaceConfig,
  PairingsCleanupOpts,
} from "./types";

import { RELAY_URL, LOGGER, STORAGE } from "./constants";
import EventEmitter from "events";

export class UniversalProvider implements IUniversalProvider {
  public client!: SignClient;
  public namespaces!: NamespaceConfig;
  public events: EventEmitter = new EventEmitter();
  public rpcProviders: RpcProviderMap = {};
  public session?: SessionTypes.Struct;
  public providerOpts: UniversalProviderOpts;
  public logger: Logger;
  public uri: string | undefined;

  static async init(opts: UniversalProviderOpts) {
    const provider = new UniversalProvider(opts);
    await provider.initialize();
    return provider;
  }

  constructor(opts: UniversalProviderOpts) {
    this.providerOpts = opts;
    this.logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? opts.logger
        : pino(getDefaultLoggerOptions({ level: opts?.logger || LOGGER }));
  }

  public async request<T = unknown>(
    args: RequestArguments,
    chain?: string | undefined,
  ): Promise<T> {

    if (!chain && args.params?.[0]?.chainId) {
      chain = args.params?.[0]?.chainId;
	    if (chain?.indexOf("0x") === 0)
	      chain = "eip155:" + parseInt(chain, 16).toString()
	}

    if (!this.session) {
      throw new Error("Please call connect() before request()");
    }

	const [namespace, reqChain] = this.getNamespaceFromChain(chain);

    const provider = this.getProvider(namespace);
    const chainId = reqChain || provider.getDefaultChainId();

    return await provider.request({
      request: {
        ...args,
      },
      chainId: `${namespace}:${chainId}`,
      topic: this.session.topic,
    });
  }

  public sendAsync(
    args: RequestArguments,
    callback: (error: Error | null, response: any) => void,
    chain?: string | undefined,
  ): void {
    this.request(args, chain)
      .then((response) => callback(null, response))
      .catch((error) => callback(error, undefined));
  }

  public async enable(): Promise<ProviderAccounts> {
    if (!this.client) {
      throw new Error("Sign Client not initialized");
    }
    if (!this.session) {
      await this.connect({ namespaces: this.namespaces });
    }
    const accounts = await this.requestAccounts();
    return accounts as ProviderAccounts;
  }

  public async disconnect(): Promise<void> {
    if (!this.session) {
      throw new Error("Please call connect() before enable()");
    }
    await this.client.disconnect({
      topic: this.session?.topic,
      reason: getSdkError("USER_DISCONNECTED"),
    });
    await this.cleanup();
  }

  public async connect(opts: ConnectParams): Promise<SessionTypes.Struct | undefined> {
    if (!this.client) {
      throw new Error("Sign Client not initialized");
    }
    const { namespaces } = opts;
    this.setNamespaces(namespaces);
    this.createProviders();
    await this.cleanupPendingPairings();
    return opts.skipPairing === true ? undefined : await this.pair(opts.pairingTopic);
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

  public async pair(pairingTopic: string | undefined): Promise<SessionTypes.Struct> {
    const { uri, approval } = await this.client.connect({
      pairingTopic,
      requiredNamespaces: this.namespaces,
    });

    if (uri) {
      this.uri = uri;
      this.events.emit("display_uri", uri);
    }

    this.session = await approval();
    this.onSessionUpdate();
    this.onConnect();
    return this.session;
  }

  public setDefaultChain(chain: string, rpcUrl?: string | undefined) {
    try {
      const [namespace, chainId] = this.getNamespaceFromChain(chain);
      this.getProvider(namespace).setDefaultChain(chainId, rpcUrl);
    } catch (error) {
      // ignore the error if the fx is used prematurely before namespaces are set
      if (!/Please call connect/.test((error as Error).message)) throw error;
    }
  }

  public async cleanupPendingPairings(opts: PairingsCleanupOpts = {}): Promise<void> {
    this.logger.info("Cleaning up inactive pairings...");
    const inactivePairings = this.client.pairing.getAll();

    if (!isValidArray(inactivePairings)) return;

    for (const pairing of inactivePairings) {
      if (opts.deletePairings) {
        this.client.core.expirer.set(pairing.topic, 0);
      } else {
        await this.client.core.relayer.subscriber.unsubscribe(pairing.topic);
      }
    }

    this.logger.info(`Inactive pairings cleared: ${inactivePairings.length}`);
  }

  // ---------- Private ----------------------------------------------- //

  private async checkStorage() {
    this.namespaces =
      ((await this.client.core.storage.getItem(`${STORAGE}/namespaces`)) as NamespaceConfig) || {};
    if (this.namespaces) {
      this.createProviders();
    }

    if (this.client.session.length) {
      const lastKeyIndex = this.client.session.keys.length - 1;
      this.session = this.client.session.get(this.client.session.keys[lastKeyIndex]);
      this.onSessionUpdate();
    }
  }

  private async initialize() {
    this.logger.trace(`Initialized`);
    await this.createClient();
    this.checkStorage();
    this.registerEventListeners();
  }

  private async createClient() {
    this.client =
      this.providerOpts.client ||
      (await SignClient.init({
        logger: this.providerOpts.logger || LOGGER,
        relayUrl: this.providerOpts.relayUrl || RELAY_URL,
        projectId: this.providerOpts.projectId,
        metadata: this.providerOpts.metadata, // fetch metadata automatically if not provided?
        storageOptions: this.providerOpts.storageOptions,
        name: this.providerOpts.name,
      }));

    this.logger.trace(`SignClient Initialized`);
  }

  private createProviders(): void {
    if (!this.client) {
      throw new Error("Sign Client not initialized");
    }

    Object.keys(this.namespaces).forEach((namespace) => {
      switch (namespace) {
        case "eip155":
          this.rpcProviders[namespace] = new Eip155Provider({
            client: this.client,
            namespace: this.namespaces[namespace],
            events: this.events,
          });
          break;
        case "solana":
          this.rpcProviders[namespace] = new SolanaProvider({
            client: this.client,
            namespace: this.namespaces[namespace],
            events: this.events,
          });
          break;
        case "cosmos":
          this.rpcProviders[namespace] = new CosmosProvider({
            client: this.client,
            namespace: this.namespaces[namespace],
            events: this.events,
          });
          break;
        case "polkadot":
          //TODO:
          break;
        case "cip34":
          this.rpcProviders[namespace] = new CardanoProvider({
            client: this.client,
            namespace: this.namespaces[namespace],
            events: this.events,
          });
          break;
      }
    });
  }

  private registerEventListeners(): void {
    if (typeof this.client === "undefined") {
      throw new Error("Sign Client is not initialized");
    }

    this.client.on("session_ping", (args) => {
      this.events.emit("session_ping", args);
    });

    this.client.on("session_event", (args) => {
      const { params } = args;
      const { event } = params;
      if (event.name === "accountsChanged") {
        this.events.emit("accountsChanged", event.data);
      } else if (event.name === "chainChanged") {
        this.onChainChanged(event.data, params.chainId);
      } else {
        this.events.emit(event.name, event.data);
      }

      this.events.emit("session_event", args);
    });

    this.client.on("session_update", ({ topic, params }) => {
      const { namespaces } = params;
      const _session = this.client?.session.get(topic);
      this.session = { ..._session, namespaces } as SessionTypes.Struct;
      this.onSessionUpdate();
      this.events.emit("session_update", { topic, params });
    });

    this.client.on("session_delete", async (payload) => {
      await this.cleanup();
      this.events.emit("session_delete", payload);
    });
  }

  private getProvider(namespace: string): IProvider {
    if (!this.rpcProviders[namespace]) {
      throw new Error(`Provider not found: ${namespace}`);
    }
    return this.rpcProviders[namespace];
  }

  private onSessionUpdate(): void {
    Object.keys(this.rpcProviders).forEach((namespace: string) => {
      this.getProvider(namespace).updateNamespace(
        this.session?.namespaces[namespace] as SessionTypes.BaseNamespace,
      );
    });
  }

  private setNamespaces(namespaces: NamespaceConfig): void {
    if (!namespaces || !Object.keys(namespaces).length) {
      throw new Error("Namespaces must be not empty");
    }
    this.client.core.storage.setItem(`${STORAGE}/namespaces`, namespaces);
    this.namespaces = namespaces;
  }

  private getNamespaceFromChain(chain?: string): [string, string] {
    const [namespace, chainId] = chain?.split(":") || ["", ""];

    // validate namespace
    if (namespace) {
      if (!Object.keys(this.namespaces).includes(namespace)) {
        throw new Error(
          `Namespace '${namespace}' is not configured. Please call connect() first with namespace config.`,
        );
      }
    }

    return [namespace ?? Object.keys(this.namespaces)[0], chainId];
  }

  private async requestAccounts(): Promise<string[]> {
    const [namespace] = this.getNamespaceFromChain();
    return await this.getProvider(namespace).requestAccounts();
  }

  private onChainChanged(newChain: string, caip2Chain: string): void {
    const [namespace, chainId] = this.getNamespaceFromChain(caip2Chain);
    this.getProvider(namespace).setDefaultChain(chainId);
    this.events.emit("chainChanged", newChain);
  }

  private onConnect() {
    this.events.emit("connect", { session: this.session });
  }

  private async cleanup() {
    this.session = undefined;
    await this.cleanupPendingPairings({ deletePairings: true });
  }
}
export default UniversalProvider;
