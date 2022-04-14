import { HeartBeat } from "@walletconnect/heartbeat";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import { ClientTypes, EngineTypes, IClient } from "@walletconnect/types";
import { formatRelayRpcUrl, getAppMetadata } from "@walletconnect/utils";
import { EventEmitter } from "events";
import KeyValueStorage from "keyvaluestorage";
import pino from "pino";
import { CLIENT_DEFAULT, CLIENT_STORAGE_OPTIONS } from "./constants";
import { Crypto, Pairing, Proposal, Relayer, Session } from "./controllers";
import Engine from "./controllers/engine";

export class Client extends IClient {
  public readonly protocol = "wc";
  public readonly version = 2;
  public readonly name: IClient["name"] = CLIENT_DEFAULT.name;
  public readonly metadata: IClient["metadata"];
  public readonly relayUrl: IClient["relayUrl"];
  public readonly projectId: IClient["projectId"];

  public pairing: IClient["pairing"];
  public session: IClient["session"];
  public proposal: IClient["proposal"];
  public logger: IClient["logger"];
  public heartbeat: IClient["heartbeat"];
  public events: IClient["events"] = new EventEmitter();
  public relayer: IClient["relayer"];
  public crypto: IClient["crypto"];
  public engine: IClient["engine"];
  public storage: IClient["storage"];

  static async init(opts?: ClientTypes.Options) {
    const client = new Client(opts);
    await client.initialize();

    return client;
  }

  constructor(opts?: ClientTypes.Options) {
    super(opts);

    this.name = opts?.name || CLIENT_DEFAULT.name;
    this.metadata = opts?.metadata || getAppMetadata();
    this.projectId = opts?.projectId;
    const logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? opts.logger
        : pino(getDefaultLoggerOptions({ level: opts?.logger || CLIENT_DEFAULT.logger }));
    this.logger = generateChildLogger(logger, this.name);
    const storageOptions = { ...CLIENT_STORAGE_OPTIONS, ...opts?.storageOptions };
    this.storage = opts?.storage || new KeyValueStorage(storageOptions);
    this.heartbeat = new HeartBeat();
    this.crypto = new Crypto(this, this.logger, opts?.keychain);
    this.pairing = new Pairing(this, this.logger);
    this.session = new Session(this, this.logger);
    this.proposal = new Proposal(this, this.logger);
    this.relayUrl = formatRelayRpcUrl(
      this.protocol,
      this.version,
      opts?.relayUrl || CLIENT_DEFAULT.relayUrl,
      this.projectId,
    );
    this.relayer = new Relayer({
      client: this,
      rpcUrl: this.relayUrl,
      heartbeat: this.heartbeat,
      logger: this.logger,
      projectId: this.projectId,
    });
    this.engine = new Engine(
      this.protocol,
      this.version,
      this.relayer,
      this.crypto,
      this.session,
      this.pairing,
      this.proposal,
      this.metadata,
    );
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
      return await this.engine.createSession(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async pair(pairingUri: string) {
    try {
      await this.engine.pair(pairingUri);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async approve() {
    try {
      await this.engine.approve();
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async reject() {
    try {
      await this.engine.reject();
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async updateAccounts() {
    try {
      await this.engine.updateAccounts();
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async updateMethods() {
    try {
      await this.engine.updateMethods();
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async updateEvents() {
    try {
      await this.engine.updateEvents();
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async updateExpiry() {
    try {
      await this.engine.updateExpiry();
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async request() {
    try {
      await this.engine.request();
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async respond() {
    try {
      await this.engine.respond();
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async ping() {
    try {
      await this.engine.ping();
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async emit() {
    try {
      await this.engine.emit();
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  }

  public async disconnect() {
    try {
      await this.engine.disconnect();
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
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
    } catch (error) {
      this.logger.info(`Client Initilization Failure`);
      this.logger.error((error as any).message);
      throw error;
    }
  }
}
