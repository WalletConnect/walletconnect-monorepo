import { HeartBeat } from "@walletconnect/heartbeat";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import { AppMetadata, ClientOptions, ClientTypes, IClient, NewTypes } from "@walletconnect/types";
import { formatRelayRpcUrl, getAppMetadata } from "@walletconnect/utils";
import { EventEmitter } from "events";
import KeyValueStorage, { IKeyValueStorage } from "keyvaluestorage";
import pino, { Logger } from "pino";
import { CLIENT_DEFAULT, CLIENT_STORAGE_OPTIONS } from "./constants";
import { Crypto, Expirer, Pairing, Relayer, Session } from "./controllers";
import NewEngine from "./controllers/new_engine";

export class Client extends IClient {
  public readonly protocol = "wc";
  public readonly version = 2;
  public readonly name: string = CLIENT_DEFAULT.name;
  public readonly controller: boolean;
  public readonly metadata: AppMetadata | undefined;
  public readonly relayUrl: string | undefined;
  public readonly projectId: string | undefined;

  public expirer: Expirer;
  public pairing: Pairing;
  public session: Session;
  public logger: Logger;
  public heartbeat: HeartBeat;
  public events = new EventEmitter();
  public relayer: Relayer;
  public crypto: Crypto;
  public engine: NewEngine;
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
    this.expirer = new Expirer();
    this.pairing = new Pairing(this, this.logger);
    this.session = new Session(this, this.logger);
    this.relayer = new Relayer({
      rpcUrl: this.relayUrl,
      heartbeat: this.heartbeat,
      logger: this.logger,
      projectId: this.projectId,
      keyValueStorageOptions: storageOptions,
    });
    this.engine = new NewEngine(
      this.relayer,
      this.crypto,
      this.session,
      this.pairing,
      this.expirer,
    );
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  public on(event: string, listener: any) {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any) {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any) {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any) {
    this.events.removeListener(event, listener);
  }

  public async connect(params: NewTypes.CreateSessionParams) {
    try {
      await this.engine.createSession(params);
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async pair(params: ClientTypes.PairParams) {
    try {
      await this.engine.pair();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async approve(params: ClientTypes.ApproveParams) {
    try {
      await this.engine.approve();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async reject(params: ClientTypes.RejectParams) {
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

  public async request(params: ClientTypes.RequestParams) {
    try {
      await this.engine.request();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async respond(params: ClientTypes.RespondParams) {
    try {
      await this.engine.respond();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async ping(params: ClientTypes.PingParams) {
    try {
      await this.engine.ping();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async notify(params: ClientTypes.NotifyParams) {
    try {
      await this.engine.notify();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async disconnect(params: ClientTypes.DisconnectParams) {
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
