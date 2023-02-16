import { EventEmitter } from "events";
import pino from "pino";

import KeyValueStorage from "@walletconnect/keyvaluestorage";
import { HeartBeat } from "@walletconnect/heartbeat";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import { CoreTypes, ICore } from "@walletconnect/types";

import { Crypto, Relayer, Pairing, JsonRpcHistory, Expirer } from "./controllers";
import {
  CORE_CONTEXT,
  CORE_DEFAULT,
  CORE_PROTOCOL,
  CORE_STORAGE_OPTIONS,
  CORE_VERSION,
  RELAYER_DEFAULT_RELAY_URL,
} from "./constants";

export class Core extends ICore {
  public readonly protocol = CORE_PROTOCOL;
  public readonly version = CORE_VERSION;

  public readonly name: ICore["name"] = CORE_CONTEXT;
  public readonly relayUrl: ICore["relayUrl"];
  public readonly projectId: ICore["projectId"];
  public events: ICore["events"] = new EventEmitter();
  public logger: ICore["logger"];
  public heartbeat: ICore["heartbeat"];
  public relayer: ICore["relayer"];
  public crypto: ICore["crypto"];
  public storage: ICore["storage"];
  public history: ICore["history"];
  public expirer: ICore["expirer"];
  public pairing: ICore["pairing"];

  private initialized = false;

  static async init(opts?: CoreTypes.Options) {
    const core = new Core(opts);
    await core.initialize();

    return core;
  }

  constructor(opts?: CoreTypes.Options) {
    super(opts);

    this.projectId = opts?.projectId;
    this.relayUrl = opts?.relayUrl || RELAYER_DEFAULT_RELAY_URL;
    const logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? opts.logger
        : pino(getDefaultLoggerOptions({ level: opts?.logger || CORE_DEFAULT.logger }));
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
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  // ---------- Public ----------------------------------------------- //

  public async start() {
    if (this.initialized) return;
    await this.initialize();
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
      this.initialized = true;
      this.logger.info(`Core Initialization Success`);
    } catch (error) {
      this.logger.warn(`Core Initialization Failure at epoch ${Date.now()}`, error);
      this.logger.error((error as any).message);
      throw error;
    }
  }
}
