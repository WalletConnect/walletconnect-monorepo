import { EventEmitter } from "events";
import SignClient from "@walletconnect/sign-client";
import { ProviderAccounts } from "eip1193-provider";
import { SessionTypes } from "@walletconnect/types";
import { getSdkError } from "@walletconnect/utils";
import { getDefaultLoggerOptions } from "@walletconnect/logger";
import pino, { Logger } from "pino";
import Eip155Provider from "./subProviders/eip155";
import { getChainFromNamespaces } from "./utils";
import {
  IUniversalProvider,
  ISubProvider,
  RpcProviderMap,
  ConnectParams,
  RequestArguments,
  UniversalProviderOpts,
  NamespaceConfig,
} from "./types";

import { RELAY_URL, LOGGER, STORAGE } from "./constants";

export class UniversalProvider implements IUniversalProvider {
  public client!: SignClient;
  public namespaces!: NamespaceConfig;
  public events: any = new EventEmitter();
  public rpcProviders: RpcProviderMap = {};
  public session!: SessionTypes.Struct;
  public providerOpts: UniversalProviderOpts;
  public logger: Logger;

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
    const [namespace, chainId] = this.validateChain(chain);

    return this.getProvider(namespace).request({
      request: {
        ...args,
      },
      chainId: `${namespace}:${chainId}`,
      topic: this.session?.topic,
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

    const accounts = await this.request({ method: "eth_requestAccounts", params: [] });
    return accounts as ProviderAccounts;
  }

  public async disconnect(): Promise<void> {
    if (!this.client) {
      throw new Error("Sign Client not initialized");
    }

    await this.client.disconnect({
      topic: this.session.topic,
      reason: getSdkError("USER_DISCONNECTED"),
    });
  }

  public async connect(opts: ConnectParams): Promise<SessionTypes.Struct | undefined> {
    if (!this.client) {
      throw new Error("Sign Client not initialized");
    }

    this.setNamespaces(opts.namespaces);
    this.createProviders();

    return opts.skipPairing === true ? undefined : this.pair(opts.pairingTopic);
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
      pairingTopic: pairingTopic,
      requiredNamespaces: this.namespaces,
    });

    // possibly trigger the qr modal from here?
    if (uri) {
      this.events.emit("display_uri", uri);
    }

    this.session = await approval();
    this.onSessionUpdate();
    return this.session;
  }
  // ---------- Private ----------------------------------------------- //

  private async checkStorage() {
    this.namespaces = (await this.client.core.storage.getItem(
      `${STORAGE}/namespaces`,
    )) as NamespaceConfig;
    if (this.namespaces) {
      this.createProviders();
    }

    if (this.client.session.length) {
      const lastKeyIndex = this.client.session.keys.length - 1;
      this.session = this.client.session.get(this.client.session.keys[lastKeyIndex]);
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
      }));

    this.logger.trace(`SignClient Initialized`);
  }

  private createProviders(): void {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    Object.keys(this.namespaces).forEach((namespace) => {
      switch (namespace) {
        case "eip155":
          this.rpcProviders[namespace] = new Eip155Provider({
            // @ts-ignore
            client: this.client,
            namespace: this.namespaces[namespace],
          });
          break;
        case "solana":
          //TODO:
          break;
        case "cosmos":
          //TODO:
          break;
        case "polygon":
          //TODO:
          break;
        case "polkadot":
          //TODO:
          break;
      }
    });
  }

  private registerEventListeners(): void {
    if (typeof this.client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }

    this.client.on("session_ping", (args) => {
      this.events.emit("session_ping", args);
    });

    this.client.on("session_event", (args) => {
      this.events.emit("session_event", args);
    });

    this.client.on("session_update", ({ topic, params }) => {
      const { namespaces } = params;
      const _session = this.client?.session.get(topic);
      this.session = { ..._session, namespaces } as SessionTypes.Struct;
      this.onSessionUpdate();
      this.events.emit("session_update", { topic, params });
    });

    this.client.on("session_delete", () => {
      this.events.emit("session_delete");
    });
  }

  private getProvider(namespace: string): ISubProvider {
    if (!this.rpcProviders[namespace]) {
      throw new Error(`Provider not found: ${namespace}`);
    }
    return this.rpcProviders[namespace];
  }

  private onSessionUpdate(): void {
    Object.keys(this.rpcProviders).forEach((namespace: string) =>
      this.getProvider(namespace).updateNamespace(this.session.namespaces[namespace]),
    );
  }

  private setNamespaces(namespaces: NamespaceConfig): void {
    if (!namespaces || !Object.keys(namespaces).length) {
      throw new Error("Namespaces must be not empty");
    }
    this.client.core.storage.setItem(`${STORAGE}/namespaces`, namespaces);
    this.namespaces = namespaces;
  }

  private validateChain(chain?: string): [string, string] {
    let [namespace, chainId] = chain?.split(":") || ["", ""];

    // validate namespace
    if (namespace) {
      if (!Object.keys(this.namespaces).includes(namespace)) {
        throw new Error(`Invalid namespace: ${namespace}`);
      }
    }

    return !namespace || !chainId ? getChainFromNamespaces(this.namespaces) : [namespace, chainId];
  }
}
export default UniversalProvider;
