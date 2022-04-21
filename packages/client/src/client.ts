import KeyValueStorage from "@walletconnect/keyvaluestorage";
import { HeartBeat } from "@walletconnect/heartbeat";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import { ClientTypes, IClient, IClientEvents } from "@walletconnect/types";
import { formatRelayRpcUrl, getAppMetadata } from "@walletconnect/utils";
import { EventEmitter } from "events";
import pino from "pino";
import { Crypto, Pairing, Proposal, Relayer, Session, JsonRpcHistory } from "./controllers";
import Engine from "./controllers/engine";
import { CLIENT_DEFAULT, CLIENT_STORAGE_OPTIONS } from "./constants";

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
  public history: IClient["history"];

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
    this.heartbeat = new HeartBeat();
    this.crypto = new Crypto(this, this.logger, opts?.keychain);
    this.storage = new KeyValueStorage({ ...CLIENT_STORAGE_OPTIONS, ...opts?.storageOptions });
    this.pairing = new Pairing(this, this.logger);
    this.session = new Session(this, this.logger);
    this.proposal = new Proposal(this, this.logger);
    this.history = new JsonRpcHistory(this, this.logger, this.storage);

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
    this.engine = new Engine(this);
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  get storagePrefix() {
    return `${this.protocol}@${this.version}:${this.context}:`;
  }

  // ---------- Events ----------------------------------------------- //

  public on: IClientEvents["on"] = (name, listener) => {
    return this.events.on(name, listener);
  };

  public once: IClientEvents["once"] = (name, listener) => {
    return this.events.once(name, listener);
  };

  public off: IClientEvents["off"] = (name, listener) => {
    return this.events.off(name, listener);
  };

  public removeListener: IClientEvents["removeListener"] = (name, listener) => {
    return this.events.removeListener(name, listener);
  };

  // ---------- Engine ----------------------------------------------- //

  public connect: IClient["connect"] = async params => {
    try {
      return await this.engine.connect(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public pair: IClient["pair"] = async params => {
    try {
      return await this.engine.pair(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public approve: IClient["approve"] = async params => {
    try {
      return await this.engine.approve(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public reject: IClient["reject"] = async params => {
    try {
      return await this.engine.reject(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public updateAccounts: IClient["updateAccounts"] = async params => {
    try {
      return await this.engine.updateAccounts(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public updateMethods: IClient["updateMethods"] = async params => {
    try {
      return await this.engine.updateMethods(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public updateEvents: IClient["updateEvents"] = async params => {
    try {
      return await this.engine.updateEvents(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public updateExpiry: IClient["updateExpiry"] = async params => {
    try {
      return await this.engine.updateExpiry(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public request: IClient["request"] = async params => {
    try {
      return await this.engine.request(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public respond: IClient["respond"] = async params => {
    try {
      return await this.engine.respond(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public ping: IClient["ping"] = async params => {
    try {
      return await this.engine.ping(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public emit: IClient["emit"] = async params => {
    try {
      return await this.engine.emit(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public disconnect: IClient["disconnect"] = async params => {
    try {
      return await this.engine.disconnect(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  // ---------- Private ----------------------------------------------- //

  private async initialize() {
    this.logger.trace(`Initialized`);
    try {
      await Promise.all([
        this.pairing.init(),
        this.session.init(),
        this.proposal.init(),
        this.crypto.init(),
        this.relayer.init(),
        this.heartbeat.init(),
        this.history.init(),
      ]);
      this.logger.info(`Client Initilization Success`);
    } catch (error) {
      this.logger.info(`Client Initilization Failure`);
      this.logger.error((error as any).message);
      throw error;
    }
  }
}
