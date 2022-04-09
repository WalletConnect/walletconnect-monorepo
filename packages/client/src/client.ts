import { HeartBeat } from "@walletconnect/heartbeat";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import { AppMetadata, ClientOptions, EngineTypes, IClient } from "@walletconnect/types";
import { formatRelayRpcUrl, getAppMetadata } from "@walletconnect/utils";
import { EventEmitter } from "events";
import KeyValueStorage, { IKeyValueStorage } from "keyvaluestorage";
import pino, { Logger } from "pino";
import { CLIENT_DEFAULT, CLIENT_STORAGE_OPTIONS } from "./constants";
import { Crypto, Pairing, Relayer, Session } from "./controllers";
import Engine from "./controllers/engine";

export class Client extends IClient {
  public readonly protocol = "wc";
  public readonly version = 2;
  public readonly name: string = CLIENT_DEFAULT.name;
  public readonly controller: boolean;
  public readonly metadata: AppMetadata | undefined;
  public readonly relayUrl: string | undefined;
  public readonly projectId: string | undefined;

  public pairing: Pairing;
  public session: Session;
  public logger: Logger;
  public heartbeat: HeartBeat;
  public events = new EventEmitter();
  public relayer: Relayer;
  public crypto: Crypto;
  public engine: Engine;
  public keyValueStorage: IKeyValueStorage;

  static async init(opts?: ClientOptions) {
    const client = new Client(opts);
    await client.initialize();
    return client;
  }

  constructor(opts?: ClientOptions) {
    super(opts);
    const logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? opts.logger
        : pino(getDefaultLoggerOptions({ level: opts?.logger || CLIENT_DEFAULT.logger }));

    this.name = opts?.name || CLIENT_DEFAULT.name;
    this.controller = opts?.controller || CLIENT_DEFAULT.controller;
    this.metadata = opts?.metadata || getAppMetadata();
    this.projectId = opts?.projectId;
    this.relayUrl = formatRelayRpcUrl(
      this.protocol,
      this.version,
      opts?.relayUrl || CLIENT_DEFAULT.relayUrl,
      this.projectId,
    );
    const storageOptions = { ...CLIENT_STORAGE_OPTIONS, ...opts?.storageOptions };

    this.keyValueStorage = opts?.storage || new KeyValueStorage(storageOptions);
    this.logger = generateChildLogger(logger, this.name);
    this.heartbeat = new HeartBeat();
    this.crypto = new Crypto(this, this.logger, opts?.keychain);
    this.pairing = new Pairing(this, this.logger);
    this.session = new Session(this, this.logger);
    this.relayer = new Relayer({
      client: this,
      rpcUrl: this.relayUrl,
      heartbeat: this.heartbeat,
      logger: this.logger,
      projectId: this.projectId,
    });
    this.engine = new Engine(this.relayer, this.crypto, this.session, this.pairing);
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get storagePrefix(): string {
    return `${this.protocol}@${this.version}:${this.context}:`;
  }

  // ---------- Events ----------------------------------------------- //

  public on(event: string, listener: (...args: any[]) => void) {
    this.events.on(event, listener);
  }

  public once(event: string, listener: (...args: any[]) => void) {
    this.events.once(event, listener);
  }

  public off(event: string, listener: (...args: any[]) => void) {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: (...args: any[]) => void) {
    this.events.removeListener(event, listener);
  }

  // ---------- Engine ----------------------------------------------- //

  public async connect(params: EngineTypes.CreateSessionParams) {
    try {
      await this.engine.createSession(params);
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async pair(pairingUri: string) {
    try {
      await this.engine.pair(pairingUri);
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async approve() {
    try {
      await this.engine.approve();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async reject() {
    try {
      await this.engine.reject();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async updateAccounts() {
    try {
      await this.engine.updateAccounts();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async updateMethods() {
    try {
      await this.engine.updateMethods();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async updateEvents() {
    try {
      await this.engine.updateEvents();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async updateExpiry() {
    try {
      await this.engine.updateExpiry();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async request() {
    try {
      await this.engine.request();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async respond() {
    try {
      await this.engine.respond();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async ping() {
    try {
      await this.engine.ping();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async notify() {
    try {
      await this.engine.notify();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async disconnect() {
    try {
      await this.engine.disconnect();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  // ---------- Private ----------------------------------------------- //

  private async initialize() {
    this.logger.trace(`Initialized`);
    try {
      await this.pairing.init();
      await this.session.init();
      await this.crypto.init();
      await this.relayer.init();
      await this.heartbeat.init();
      this.logger.info(`Client Initilization Success`);
    } catch (err) {
      this.logger.info(`Client Initilization Failure`);
      this.logger.error(err);
      throw err;
    }
  }
}
