import { SignClient } from "@walletconnect/sign-client";
import { SessionTypes } from "@walletconnect/types";
import { JsonRpcResult } from "@walletconnect/jsonrpc-types";
import { createLogger, getSdkError, isValidArray, parseNamespaceKey } from "@walletconnect/utils";
import { Logger } from "@walletconnect/logger";

import {
  convertChainIdToNumber,
  getAccountsFromSession,
  getChainsFromApprovedSession,
  mergeRequiredOptionalNamespaces,
  parseCaip10Account,
  populateNamespacesChains,
  setGlobal,
} from "./utils/index.js";
import Eip155Provider from "./providers/eip155.js";
import GenericProvider from "./providers/generic.js";

import {
  IUniversalProvider,
  IProvider,
  RpcProviderMap,
  ConnectParams,
  RequestArguments,
  UniversalProviderOpts,
  NamespaceConfig,
  PairingsCleanupOpts,
  ProviderAccounts,
  AuthenticateParams,
  DefaultChainChanged,
  OnChainChanged,
  EmitAccountsChangedOnChainChange,
} from "./types/index.js";

import {
  RELAY_URL,
  LOGGER,
  STORAGE,
  PROVIDER_EVENTS,
  GENERIC_SUBPROVIDER_NAME,
  CONTEXT,
} from "./constants/index.js";
import EventEmitter from "events";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";

export class UniversalProvider implements IUniversalProvider {
  public client!: InstanceType<typeof SignClient>;
  public namespaces?: NamespaceConfig;
  public optionalNamespaces?: NamespaceConfig;
  public sessionProperties?: SessionTypes.SessionProperties;
  public scopedProperties?: SessionTypes.ScopedProperties;
  public events: EventEmitter = new EventEmitter();
  public rpcProviders: RpcProviderMap = {};
  public session?: SessionTypes.Struct;
  public providerOpts: UniversalProviderOpts;
  public logger: Logger;
  public uri: string | undefined;

  private disableProviderPing = false;

  static async init(opts: UniversalProviderOpts) {
    const provider = new UniversalProvider(opts);
    await provider.initialize();
    return provider;
  }

  constructor(opts: UniversalProviderOpts) {
    this.providerOpts = opts;
    this.logger = createLogger({
      logger: opts.logger ?? LOGGER,
      name: this.providerOpts.name ?? CONTEXT,
    });
    this.disableProviderPing = opts?.disableProviderPing || false;
  }

  public async request<T = unknown>(
    args: RequestArguments,
    chain?: string | undefined,
    expiry?: number | undefined,
  ): Promise<T> {
    const [namespace, chainId] = this.validateChain(chain);

    if (!this.session) {
      throw new Error("Please call connect() before request()");
    }
    return (await this.getProvider(namespace).request({
      request: {
        ...args,
      },
      chainId: `${namespace}:${chainId}`,
      topic: this.session.topic,
      expiry,
    })) as T;
  }

  public sendAsync(
    args: RequestArguments,
    callback: (error: Error | null, response: JsonRpcResult) => void,
    chain?: string | undefined,
    expiry?: number | undefined,
  ): void {
    const id = new Date().getTime();
    this.request(args, chain, expiry)
      .then((response) => callback(null, formatJsonRpcResult(id, response)))
      .catch((error) => callback(error, undefined as any));
  }

  public async enable(): Promise<ProviderAccounts> {
    if (!this.client) {
      throw new Error("Sign Client not initialized");
    }
    if (!this.session) {
      await this.connect({
        namespaces: this.namespaces,
        optionalNamespaces: this.optionalNamespaces,
        sessionProperties: this.sessionProperties,
        scopedProperties: this.scopedProperties,
      });
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
    this.setNamespaces(opts);
    // omit `await` to avoid delaying the pairing flow
    this.cleanupPendingPairings();
    if (opts.skipPairing) return;

    return await this.pair(opts.pairingTopic);
  }

  public async authenticate(opts: AuthenticateParams, walletUniversalLink?: string) {
    if (!this.client) {
      throw new Error("Sign Client not initialized");
    }
    this.setNamespaces(opts);
    await this.cleanupPendingPairings();

    const { uri, response } = await this.client.authenticate(opts, walletUniversalLink);
    if (uri) {
      this.uri = uri;
      this.events.emit("display_uri", uri);
    }
    const result = await response();
    this.session = result.session;
    if (this.session) {
      // assign namespaces from session if not already defined
      const approved = populateNamespacesChains(this.session.namespaces) as NamespaceConfig;
      this.namespaces = mergeRequiredOptionalNamespaces(this.namespaces, approved);
      await this.persist("namespaces", this.namespaces);
      this.onConnect();
    }
    return result;
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
      optionalNamespaces: this.optionalNamespaces,
      sessionProperties: this.sessionProperties,
      scopedProperties: this.scopedProperties,
    });

    if (uri) {
      this.uri = uri;
      this.events.emit("display_uri", uri);
    }

    const session = await approval();
    this.session = session;
    // assign namespaces from session if not already defined
    const approved = populateNamespacesChains(session.namespaces) as NamespaceConfig;
    this.namespaces = mergeRequiredOptionalNamespaces(this.namespaces, approved);
    await this.persist("namespaces", this.namespaces);
    await this.persist("optionalNamespaces", this.optionalNamespaces);

    this.onConnect();
    return this.session;
  }

  public setDefaultChain(chain: string, rpcUrl?: string | undefined) {
    try {
      // ignore without active session
      if (!this.session) return;
      const [namespace, chainId] = this.validateChain(chain);
      const provider = this.getProvider(namespace);
      provider.setDefaultChain(chainId, rpcUrl);
    } catch (error) {
      // ignore the error if the fx is used prematurely before namespaces are set
      if (!/Please call connect/.test((error as Error).message)) throw error;
    }
  }

  public async cleanupPendingPairings(opts: PairingsCleanupOpts = {}): Promise<void> {
    try {
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
    } catch (error) {
      this.logger.warn(error, "Failed to cleanup pending pairings");
    }
  }

  public abortPairingAttempt() {
    this.logger.warn("abortPairingAttempt is deprecated. This is now a no-op.");
  }

  // ---------- Private ----------------------------------------------- //

  private async checkStorage() {
    this.namespaces = (await this.getFromStore(`namespaces`)) || {};
    this.optionalNamespaces = (await this.getFromStore(`optionalNamespaces`)) || {};
    if (this.session) this.createProviders();
  }

  private async initialize() {
    this.logger.trace(`Initialized`);
    await this.createClient();
    await this.checkStorage();
    this.registerEventListeners();
  }

  private async createClient() {
    this.client =
      this.providerOpts.client ||
      (await SignClient.init({
        core: this.providerOpts.core,
        logger: this.providerOpts.logger || LOGGER,
        relayUrl: this.providerOpts.relayUrl || RELAY_URL,
        projectId: this.providerOpts.projectId,
        metadata: this.providerOpts.metadata,
        storageOptions: this.providerOpts.storageOptions,
        storage: this.providerOpts.storage,
        name: this.providerOpts.name,
        customStoragePrefix: this.providerOpts.customStoragePrefix,
        telemetryEnabled: this.providerOpts.telemetryEnabled,
      }));

    if (this.providerOpts.session) {
      try {
        this.session = this.client.session.get(this.providerOpts.session.topic);
      } catch (error) {
        this.logger.error(error, "Failed to get session");
        throw new Error(
          `The provided session: ${this.providerOpts?.session?.topic} doesn't exist in the Sign client`,
        );
      }
    } else {
      const sessions = this.client.session.getAll();
      this.session = sessions[0];
    }
    this.logger.trace(`SignClient Initialized`);
  }

  private createProviders(): void {
    if (!this.client) {
      throw new Error("Sign Client not initialized");
    }

    if (!this.session) {
      throw new Error("Session not initialized. Please call connect() before enable()");
    }

    const providersToCreate = [
      ...new Set(
        Object.keys(this.session.namespaces).map((namespace) => parseNamespaceKey(namespace)),
      ),
    ];

    setGlobal("client", this.client);
    setGlobal("events", this.events);
    setGlobal("disableProviderPing", this.disableProviderPing);

    providersToCreate.forEach((namespace) => {
      if (!this.session) return;
      const accounts = getAccountsFromSession(namespace, this.session);
      if (accounts?.length === 0) {
        return;
      }
      const approvedChains = getChainsFromApprovedSession(accounts);
      const mergedNamespaces = mergeRequiredOptionalNamespaces(
        this.namespaces,
        this.optionalNamespaces,
      );
      const combinedNamespace = {
        ...mergedNamespaces[namespace],
        accounts,
        chains: approvedChains,
      };
      switch (namespace) {
        case "eip155":
          this.rpcProviders[namespace] = new Eip155Provider({
            namespace: combinedNamespace,
          });
          break;
        default:
          this.rpcProviders[namespace] = new GenericProvider({
            namespace: combinedNamespace,
          });
      }
    });
  }

  private registerEventListeners(): void {
    if (typeof this.client === "undefined") {
      throw new Error("Sign Client is not initialized");
    }

    this.client.on("session_ping", (args) => {
      const { topic } = args;
      if (topic !== this.session?.topic) return;
      this.events.emit("session_ping", args);
    });

    this.client.on("session_event", (args) => {
      const { params, topic } = args;
      if (topic !== this.session?.topic) return;
      const { event } = params;
      if (event.name === "accountsChanged") {
        const accounts = event.data;
        if (accounts && isValidArray(accounts))
          this.events.emit("accountsChanged", accounts.map(parseCaip10Account));
      } else if (event.name === "chainChanged") {
        const requestChainId = params.chainId;
        const payloadChainId = params.event.data as number;
        const namespace = parseNamespaceKey(requestChainId);
        // chainIds might differ between the request & payload - request is always in CAIP2 format, while payload might be string, number, CAIP2 or hex
        // take priority of the payload chainId
        const chainIdToProcess =
          convertChainIdToNumber(requestChainId) !== convertChainIdToNumber(payloadChainId)
            ? `${namespace}:${convertChainIdToNumber(payloadChainId)}`
            : requestChainId;

        this.onChainChanged({ currentCaipChainId: chainIdToProcess });
      } else {
        this.events.emit(event.name, event.data);
      }

      this.events.emit("session_event", args);
    });

    this.client.on("session_update", ({ topic, params }) => {
      if (topic !== this.session?.topic) return;
      const { namespaces } = params;
      const _session = this.client?.session.get(topic);
      this.session = { ..._session, namespaces } as SessionTypes.Struct;
      this.onSessionUpdate();
      this.events.emit("session_update", { topic, params });
    });

    this.client.on("session_delete", async (payload) => {
      if (payload.topic !== this.session?.topic) return;
      await this.cleanup();
      this.events.emit("session_delete", payload);
      this.events.emit("disconnect", {
        ...getSdkError("USER_DISCONNECTED"),
        data: payload.topic,
      });
    });

    this.on(PROVIDER_EVENTS.DEFAULT_CHAIN_CHANGED, (params: DefaultChainChanged) => {
      this.onChainChanged({ ...params, internal: true });
    });
  }

  private getProvider(namespace: string): IProvider {
    return this.rpcProviders[namespace] || this.rpcProviders[GENERIC_SUBPROVIDER_NAME];
  }

  private onSessionUpdate(): void {
    Object.keys(this.rpcProviders).forEach((namespace: string) => {
      this.getProvider(namespace).updateNamespace(
        this.session?.namespaces[namespace] as SessionTypes.BaseNamespace,
      );
    });
  }

  private setNamespaces(params: ConnectParams): void {
    const {
      namespaces = {},
      optionalNamespaces = {},
      sessionProperties,
      scopedProperties,
    } = params;

    // requiredNamespaces are deprecated, assign them to optionalNamespaces
    this.optionalNamespaces = mergeRequiredOptionalNamespaces(namespaces, optionalNamespaces);
    this.sessionProperties = sessionProperties;
    this.scopedProperties = scopedProperties;
  }

  private validateChain(chain?: string): [string, string] {
    const [namespace, chainId] = chain?.split(":") || ["", ""];
    if (!this.namespaces || !Object.keys(this.namespaces).length) return [namespace, chainId];
    // validate namespace
    if (namespace) {
      if (
        // some namespaces might be defined with inline chainId e.g. eip155:1
        // and we need to parse them
        !Object.keys(this.namespaces || {})
          .map((key) => parseNamespaceKey(key))
          .includes(namespace)
      ) {
        throw new Error(
          `Namespace '${namespace}' is not configured. Please call connect() first with namespace config.`,
        );
      }
    }
    if (namespace && chainId) {
      return [namespace, chainId];
    }
    const defaultNamespace = parseNamespaceKey(Object.keys(this.namespaces)[0]);
    const defaultChain = this.rpcProviders[defaultNamespace].getDefaultChain();
    return [defaultNamespace, defaultChain];
  }

  private async requestAccounts(): Promise<string[]> {
    const [namespace] = this.validateChain();
    return await this.getProvider(namespace).requestAccounts();
  }

  private async onChainChanged({
    currentCaipChainId,
    previousCaipChainId,
    internal = false,
  }: OnChainChanged): Promise<void> {
    if (!this.namespaces) return;

    const [namespace, chainId] = this.validateChain(currentCaipChainId);

    if (!chainId) return;

    this.updateNamespaceChain(namespace, chainId);

    if (!internal) {
      this.getProvider(namespace).setDefaultChain(chainId);
    } else {
      // emit the events during the `internal` cycle of chain change
      // otherwise events are emitted twice
      // once on the chainChanged event and once triggered by `this.getProvider(namespace).setDefaultChain(chainId);`
      this.events.emit("chainChanged", chainId);
      this.emitAccountsChangedOnChainChange({
        namespace,
        currentCaipChainId,
        previousCaipChainId,
      });
    }

    await this.persist("namespaces", this.namespaces);
  }

  /**
   * Emits `accountsChanged` event when a chain is changed and there are new accounts on the new chain
   */
  private emitAccountsChangedOnChainChange({
    namespace,
    currentCaipChainId,
    previousCaipChainId,
  }: EmitAccountsChangedOnChainChange): void {
    try {
      if (previousCaipChainId === currentCaipChainId) {
        return;
      }

      const accounts = this.session?.namespaces[namespace]?.accounts;
      if (!accounts) return;
      const newChainIdAccounts = accounts
        .filter((account) => account.includes(`${currentCaipChainId}:`))
        .map(parseCaip10Account);
      if (!isValidArray(newChainIdAccounts)) return;
      this.events.emit("accountsChanged", newChainIdAccounts);
    } catch (error) {
      this.logger.warn(error, "Failed to emit accountsChanged on chain change");
    }
  }

  private updateNamespaceChain(namespace: string, chainId: string): void {
    if (!this.namespaces) return;

    const namespaceKey = this.namespaces[namespace] ? namespace : `${namespace}:${chainId}`;

    const defaultNamespace = {
      chains: [],
      methods: [],
      events: [],
      defaultChain: chainId,
    };

    if (!this.namespaces[namespaceKey]) {
      this.namespaces[namespaceKey] = defaultNamespace;
    } else if (this.namespaces[namespaceKey]) {
      this.namespaces[namespaceKey].defaultChain = chainId;
    }
  }

  private onConnect() {
    this.createProviders();
    this.events.emit("connect", { session: this.session });
  }

  private async cleanup() {
    this.namespaces = undefined;
    this.optionalNamespaces = undefined;
    this.sessionProperties = undefined;
    await this.deleteFromStore("namespaces");
    await this.deleteFromStore("optionalNamespaces");
    await this.deleteFromStore("sessionProperties");
    // reset the session after removing from store as the topic is used there
    this.session = undefined;
    this.cleanupPendingPairings({ deletePairings: true });
    await this.cleanupStorage();
  }

  private async persist(key: string, data: unknown) {
    const topic = this.session?.topic || "";
    await this.client.core.storage.setItem(`${STORAGE}/${key}${topic}`, data);
  }

  private async getFromStore(key: string) {
    const topic = this.session?.topic || "";
    return await this.client.core.storage.getItem(`${STORAGE}/${key}${topic}`);
  }

  private async deleteFromStore(key: string) {
    const topic = this.session?.topic || "";
    await this.client.core.storage.removeItem(`${STORAGE}/${key}${topic}`);
  }

  // remove all storage items if there are no sessions left
  private async cleanupStorage() {
    try {
      if (this.client?.session.length > 0) {
        return;
      }
      const keys = await this.client.core.storage.getKeys();
      for (const key of keys) {
        if (key.startsWith(STORAGE)) {
          await this.client.core.storage.removeItem(key);
        }
      }
    } catch (error) {
      this.logger.warn(error, "Failed to cleanup storage");
    }
  }
}
export default UniversalProvider;
