import pino from "pino";
import { EventEmitter } from "events";
import KeyValueStorage from "@walletconnect/keyvaluestorage";
import { HeartBeat } from "@walletconnect/heartbeat";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import { CoreTypes, ICore } from "@walletconnect/types";

import { Crypto, Relayer } from "./controllers";
import {
  CORE_CONTEXT,
  CORE_DEFAULT,
  CORE_PROTOCOL,
  CORE_STORAGE_OPTIONS,
  CORE_VERSION,
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

  private initialized = false;

  static async init(opts?: CoreTypes.Options) {
    const core = new Core(opts);
    await core.initialize();

    return core;
  }

  constructor(opts?: CoreTypes.Options) {
    super(opts);

    this.projectId = opts?.projectId;
    const logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? opts.logger
        : pino(getDefaultLoggerOptions({ level: opts?.logger || CORE_DEFAULT.logger }));
    this.logger = generateChildLogger(logger, this.name);
    this.heartbeat = new HeartBeat();
    this.crypto = new Crypto(this, this.logger, opts?.keychain);
    this.storage = opts?.storage
      ? opts.storage
      : new KeyValueStorage({ ...CORE_STORAGE_OPTIONS, ...opts?.storageOptions });
    this.relayer = new Relayer({
      core: this,
      logger: this.logger,
      protocol: this.protocol,
      version: this.version,
      relayUrl: opts?.relayUrl,
      projectId: this.projectId,
    });
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
      await Promise.all([this.crypto.init(), this.relayer.init(), this.heartbeat.init()]);
      this.initialized = true;
      this.logger.info(`Core Initilization Success`);
    } catch (error) {
      this.logger.info(`Core Initilization Failure`);
      this.logger.error((error as any).message);
      throw error;
    }
  }
}
