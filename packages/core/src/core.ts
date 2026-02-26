import { EventEmitter } from "events";

import { HeartBeat } from "@walletconnect/heartbeat";
import KeyValueStorage from "@walletconnect/keyvaluestorage";
import {
  ChunkLoggerController,
  generateChildLogger,
  generatePlatformLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import { CoreTypes, ICore } from "@walletconnect/types";

import {
  CORE_CONTEXT,
  CORE_DEFAULT,
  CORE_PROTOCOL,
  CORE_STORAGE_OPTIONS,
  CORE_VERSION,
  RELAYER_DEFAULT_RELAY_URL,
  TRANSPORT_TYPES,
  WALLETCONNECT_CLIENT_ID,
  WALLETCONNECT_LINK_MODE_APPS,
} from "./constants/index.js";
import {
  Crypto,
  EchoClient,
  EventClient,
  Expirer,
  JsonRpcHistory,
  Pairing,
  Relayer,
  Verify,
} from "./controllers/index.js";

export class Core extends ICore {
  public readonly protocol = CORE_PROTOCOL;
  public readonly version = CORE_VERSION;

  public readonly name: ICore["name"] = CORE_CONTEXT;
  public readonly relayUrl: ICore["relayUrl"];
  public readonly projectId: ICore["projectId"];
  public readonly customStoragePrefix: ICore["customStoragePrefix"];
  public events: ICore["events"] = new EventEmitter();
  public logger: ICore["logger"];
  public heartbeat: ICore["heartbeat"];
  public relayer: ICore["relayer"];
  public crypto: ICore["crypto"];
  public storage: ICore["storage"];
  public history: ICore["history"];
  public expirer: ICore["expirer"];
  public pairing: ICore["pairing"];
  public verify: ICore["verify"];
  public echoClient: ICore["echoClient"];
  public linkModeSupportedApps: ICore["linkModeSupportedApps"];
  public eventClient: ICore["eventClient"];

  private initialized = false;
  private logChunkController: ChunkLoggerController | null;

  static async init(opts?: CoreTypes.Options) {
    const core = new Core(opts);
    await core.initialize();
    const clientId = await core.crypto.getClientId();
    await core.storage.setItem(WALLETCONNECT_CLIENT_ID, clientId);

    return core;
  }

  constructor(opts?: CoreTypes.Options) {
    super(opts);

    const globalCore = this.getGlobalCore(opts?.customStoragePrefix);
    if (globalCore) {
      try {
        this.customStoragePrefix = globalCore.customStoragePrefix;
        this.logger = globalCore.logger;
        this.heartbeat = globalCore.heartbeat;
        this.crypto = globalCore.crypto;
        this.history = globalCore.history;
        this.expirer = globalCore.expirer;
        this.storage = globalCore.storage;
        this.relayer = globalCore.relayer;
        this.pairing = globalCore.pairing;
        this.verify = globalCore.verify;
        this.echoClient = globalCore.echoClient;
        this.linkModeSupportedApps = globalCore.linkModeSupportedApps;
        this.eventClient = globalCore.eventClient;
        this.initialized = globalCore.initialized;
        this.logChunkController = globalCore.logChunkController;
        return globalCore;
      } catch (error) {
        console.warn("Failed to copy global core", error);
      }
    }

    this.projectId = opts?.projectId;
    this.relayUrl = opts?.relayUrl || RELAYER_DEFAULT_RELAY_URL;
    this.customStoragePrefix = opts?.customStoragePrefix ? `:${opts.customStoragePrefix}` : "";

    const loggerOptions = getDefaultLoggerOptions({
      level: typeof opts?.logger === "string" && opts.logger ? opts.logger : CORE_DEFAULT.logger,
      name: CORE_CONTEXT,
    });

    const { logger, chunkLoggerController } = generatePlatformLogger({
      opts: loggerOptions,
      maxSizeInBytes: opts?.maxLogBlobSizeInBytes,
      loggerOverride: opts?.logger,
    });

    this.logChunkController = chunkLoggerController;

    if (this.logChunkController?.downloadLogsBlobInBrowser) {
      // @ts-ignore
      window.downloadLogsBlobInBrowser = async () => {
        // Have to null check twice because there is no guarantee
        // this.logChunkController.downloadLogsBlobInBrowser is always truthy
        if (this.logChunkController?.downloadLogsBlobInBrowser) {
          this.logChunkController?.downloadLogsBlobInBrowser({
            clientId: await this.crypto.getClientId(),
          });
        }
      };
    }

    this.logger = generateChildLogger(logger, this.name);
    this.heartbeat = new HeartBeat();
    this.crypto = new Crypto(this, this.logger, opts?.keychain);
    this.history = new JsonRpcHistory(this, this.logger);
    this.expirer = new Expirer(this, this.logger);
    this.storage = opts?.storage
      ? opts.storage
      : new KeyValueStorage({ ...CORE_STORAGE_OPTIONS, ...opts?.storageOptions });
    this.relayer = new Relayer({
      core: this,
      logger: this.logger,
      relayUrl: this.relayUrl,
      projectId: this.projectId,
    });
    this.pairing = new Pairing(this, this.logger);
    this.verify = new Verify(this, this.logger, this.storage);
    this.echoClient = new EchoClient(this.projectId || "", this.logger);
    this.linkModeSupportedApps = [];
    this.eventClient = new EventClient(this, this.logger, opts?.telemetryEnabled);
    this.setGlobalCore(this);
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  // ---------- Public ----------------------------------------------- //

  public async start() {
    if (this.initialized) return;
    await this.initialize();
  }

  public async getLogsBlob() {
    return this.logChunkController?.logsToBlob({
      clientId: await this.crypto.getClientId(),
    });
  }

  public async addLinkModeSupportedApp(universalLink: string) {
    if (this.linkModeSupportedApps.includes(universalLink)) return;
    this.linkModeSupportedApps.push(universalLink);
    await this.storage.setItem(WALLETCONNECT_LINK_MODE_APPS, this.linkModeSupportedApps);
  }

  // ---------- Events ----------------------------------------------- //

  public on = (name: any, listener: any) => {
    return this.events.on(name, listener);
  };

  public once = (name: any, listener: any) => {
    return this.events.once(name, listener);
  };

  public off = (name: any, listener: any) => {
    return this.events.off(name, listener);
  };

  public removeListener = (name: any, listener: any) => {
    return this.events.removeListener(name, listener);
  };

  // ---------- Link-mode ----------------------------------------------- //

  public dispatchEnvelope = ({
    topic,
    message,
    sessionExists,
  }: {
    topic: string;
    message: string;
    sessionExists: boolean;
  }) => {
    if (!topic || !message) return;

    const payload = {
      topic,
      message,
      publishedAt: Date.now(),
      transportType: TRANSPORT_TYPES.link_mode,
    };

    this.relayer.onLinkMessageEvent(payload, { sessionExists });
  };

  // ---------- Private ----------------------------------------------- //

  private async initialize() {
    this.logger.trace(`Initialized`);
    try {
      await this.crypto.init();
      await this.history.init();
      await this.expirer.init();
      await this.relayer.init();
      await this.heartbeat.init();
      await this.pairing.init();
      this.linkModeSupportedApps = (await this.storage.getItem(WALLETCONNECT_LINK_MODE_APPS)) || [];

      this.initialized = true;
      this.logger.info(`Core Initialization Success`);
    } catch (error) {
      this.logger.warn(error, `Core Initialization Failure at epoch ${Date.now()}`);
      this.logger.error((error as any).message);
      throw error;
    }
  }

  private getGlobalCore(customStoragePrefix = ""): Core | undefined {
    try {
      if (this.isGlobalCoreDisabled()) {
        return undefined;
      }
      const globalCorePrefix = `_walletConnectCore_${customStoragePrefix}`;

      const counterKey = `${globalCorePrefix}_count`;
      globalThis[counterKey] = (globalThis[counterKey] || 0) + 1;
      if (globalThis[counterKey] > 1) {
        console.warn(
          `WalletConnect Core is already initialized. This is probably a mistake and can lead to unexpected behavior. Init() was called ${globalThis[counterKey]} times.`,
        );
      }

      return globalThis[globalCorePrefix];
    } catch (error) {
      console.warn("Failed to get global WalletConnect core", error);
      return undefined;
    }
  }

  private setGlobalCore(core: Core) {
    try {
      if (this.isGlobalCoreDisabled()) {
        return;
      }
      const customStoragePrefix = core.opts?.customStoragePrefix || "";
      const globalCorePrefix = `_walletConnectCore_${customStoragePrefix}`;
      globalThis[globalCorePrefix] = core;
    } catch (error) {
      console.warn("Failed to set global WalletConnect core", error);
    }
  }

  private isGlobalCoreDisabled() {
    try {
      return typeof process !== "undefined" && process.env.DISABLE_GLOBAL_CORE === "true";
    } catch (error) {
      return true;
    }
  }
}
